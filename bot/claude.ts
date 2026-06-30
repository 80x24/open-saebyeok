// Claude Code 엔진 — `claude -p`(파이프 모드)를 구독 인증으로 spawn한다.
//
// 비용의 핵심: ANTHROPIC_API_KEY를 환경에서 제거하고 Claude의 구독 OAuth(Keychain)로만
// 인증시킨다. 키가 떠 있으면 OAuth보다 우선해 "조용히 종량제로 과금"되므로 반드시 지운다.

import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { DATA_DIR } from './config'
import { buildSkillIndex } from './skill-index'

const SESSION_FILE = join(DATA_DIR, '.session') // 데이터 폴더에 — 코드/데이터 분리 (인스턴스별 격리)
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS) || 1_800_000 // 30분
const GRACEFUL_KILL_MS = 10_000
const AUTOCOMPACT_PCT = process.env.CLAUDE_AUTOCOMPACT_PCT || '85'

// 코어 시스템 프롬프트 = 번들 SYSTEM.md(git 전파) + 정체성(SOUL/IDENTITY/USER) + 활성 스킬 인덱스.
// Hermes "slot #1 frozen prefix" 원칙: 프로세스 시작 시 1회 조립해 세션 내내 고정(프리픽스 캐시 보존).
// → 인격·사용자모델·스킬을 에이전트의 "알아서 읽기"에 맡기지 않고 항상 컨텍스트에 보장한다.
//   (cwd 의 ~/.nuanua/CLAUDE.md 는 claude 가 자동 로드하지만 SOUL/USER/스킬은 아니므로 여기서 주입)
function buildSystemPrompt(): string {
  const parts: string[] = []
  try { parts.push(readFileSync(join(import.meta.dir, '..', 'identity', 'SYSTEM.md'), 'utf-8').trim()) } catch {}
  // 정체성·사용자 (데이터 폴더) — 인격·사용자모델 연속성 보장
  const idFiles: [string, string][] = [
    ['정체성 — SOUL', join(DATA_DIR, 'identity', 'SOUL.md')],
    ['정체성 — IDENTITY', join(DATA_DIR, 'identity', 'IDENTITY.md')],
    ['사용자 — USER', join(DATA_DIR, 'USER.md')],
  ]
  for (const [label, p] of idFiles) {
    try { const t = readFileSync(p, 'utf-8').trim(); if (t) parts.push(`# ${label}\n${t}`) } catch {}
  }
  // 활성 스킬 인덱스 (progressive disclosure: 이름+요약만, 전문은 필요시 Read. requires 게이트로 환경 안 맞는 건 제외)
  const skillLines = buildSkillIndex(join(DATA_DIR, 'skills', 'active'))
  if (skillLines.length) {
    parts.push(`# 활성 스킬 (관련 작업이면 \`skills/active/<이름>.md\` 또는 \`skills/active/<이름>/SKILL.md\` 를 Read 해 따르라)\n${skillLines.join('\n')}`)
  }
  return parts.join('\n\n---\n\n')
}
const SYSTEM_PROMPT = buildSystemPrompt()

// SIGTERM 후 유예시간 내 안 죽으면 SIGKILL — spawn 종료 공통 로직 (값 통일)
function killGracefully(proc: ReturnType<typeof Bun.spawn> | null, graceMs = GRACEFUL_KILL_MS) {
  if (!proc) return
  try {
    proc.kill('SIGTERM')
    setTimeout(() => { try { if (proc.exitCode === null) proc.kill('SIGKILL') } catch {} }, graceMs)
  } catch {}
}

let sessionId: string | null = null
let sessionCreated = false
let busy = false
let cancelled = false
let currentProc: ReturnType<typeof Bun.spawn> | null = null

// --- 세션 영속 (대화 맥락을 재시작 너머로 유지) ---

function loadSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      const data = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'))
      if (data.id) { sessionId = data.id; sessionCreated = true; return }
      unlinkSync(SESSION_FILE)
    }
  } catch {}
}
function saveSession() {
  if (!sessionId) return
  try { writeFileSync(SESSION_FILE, JSON.stringify({ id: sessionId, ts: Date.now() })) } catch {}
}
loadSession()

export function getSessionId() { return sessionId }
export function ensureSessionId() { if (!sessionId) sessionId = randomUUID(); return sessionId }
export function isBusy() { return busy }
export function clearSession() {
  sessionId = null; sessionCreated = false
  try { unlinkSync(SESSION_FILE) } catch {}
}

// 세션 전환 — 다음 호출부터 해당 id 로 --resume (8자 단축 id 도 그대로 전달; claude 가 해석)
export function resumeSession(id: string) {
  sessionId = id; sessionCreated = true; saveSession()
}
// 현재 세션 상태 (/status 표시용)
export function sessionStatus(): { id: string | null; active: boolean; busy: boolean } {
  return { id: sessionId, active: sessionCreated, busy }
}
export function cancelStream(): boolean {
  if (!busy || !currentProc) return false
  cancelled = true
  killGracefully(currentProc)
  busy = false
  return true
}

// --- tool hint (스트리밍 중 어떤 도구를 쓰는지 가볍게 표시) ---

const TOOL_ICONS: Record<string, string> = {
  Bash: '$ ', Read: '📄 ', Edit: '✏️ ', Write: '📝 ', Grep: '🔍 ',
  Glob: '📂 ', WebSearch: '🌐 ', WebFetch: '🌐 ', Task: '🤖 ',
}
function formatToolHint(name: string, input: string): string {
  if (name === 'TodoWrite') return ''
  const icon = TOOL_ICONS[name] ?? '🔧 '
  try {
    const o = JSON.parse(input)
    const hint =
      name === 'Bash' ? o.command?.slice(0, 80)
      : (name === 'Read' || name === 'Edit' || name === 'Write') ? o.file_path?.split('/').pop()
      : (o.pattern || o.query || o.url || o.description || '')?.toString().slice(0, 60)
    return `${icon}${hint || name}`
  } catch { return `${icon}${name}` }
}

// --- 메인 스트리밍 호출 ---

export async function chatStream(
  message: string,
  onChunk: (displayText: string) => void,
  opts: { isolated?: boolean } = {}
): Promise<{ response: string; display: string }> {
  if (busy) throw new Error('이전 응답 처리 중...')
  cancelled = false
  busy = true
  const isolated = opts.isolated === true // 격리: 메인 대화 세션과 분리된 새 세션 (하트비트 등 자율 루틴)
  let proc: ReturnType<typeof Bun.spawn> | null = null
  let timeout: Timer | null = null

  try {
    const args = [
      '-p', '--model', process.env.CLAUDE_MODEL || 'opus',
      '--output-format', 'stream-json',
      '--verbose', '--include-partial-messages',
      '--dangerously-skip-permissions',
    ]
    if (isolated) {
      args.push('--session-id', randomUUID()) // 매번 새 세션 — 사용자 대화 맥락 오염 X (정체성·기억은 SYSTEM_PROMPT+cwd 로 그대로)
    } else {
      ensureSessionId()
      args.push(sessionCreated ? '--resume' : '--session-id', sessionId!)
    }
    if (SYSTEM_PROMPT) args.push('--append-system-prompt', SYSTEM_PROMPT)

    const env = { ...process.env }
    delete env.CLAUDECODE
    delete env.ANTHROPIC_API_KEY // ★ 구독 OAuth만 쓰도록 — 종량제 누수 차단
    env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = AUTOCOMPACT_PCT

    currentProc = proc = Bun.spawn(['claude', ...args], {
      cwd: DATA_DIR, env, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    })
    proc.stdin.write(message)
    proc.stdin.end()

    timeout = setTimeout(() => killGracefully(proc), TIMEOUT_MS)

    const stderrPromise = new Response(proc.stderr).text()
    let response = '', display = '', toolLabel = '', toolInput = '', resultErrorMsg = ''
    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          const se = event.type === 'stream_event' ? event.event : null
          if (!se) {
            if (event.type === 'result' && event.is_error)
              resultErrorMsg = typeof event.result === 'string' ? event.result : JSON.stringify(event.result ?? '')
            continue
          }
          if (se.type === 'content_block_delta' && se.delta?.type === 'text_delta') {
            response += se.delta.text; display += se.delta.text; onChunk(display)
          }
          if (se.type === 'content_block_start' && se.content_block?.type === 'tool_use') {
            toolLabel = se.content_block.name || 'tool'; toolInput = ''
          }
          if (se.type === 'content_block_delta' && se.delta?.type === 'input_json_delta') {
            toolInput += se.delta.partial_json || ''
          }
          if (se.type === 'content_block_stop' && toolLabel) {
            const hint = formatToolHint(toolLabel, toolInput)
            if (hint) { display += `\n\`${hint}\`\n`; onChunk(display) }
            toolLabel = ''; toolInput = ''
          }
        } catch {}
      }
    }

    if (timeout) clearTimeout(timeout)
    const [errText, exitCode] = await Promise.all([stderrPromise, proc.exited])

    if (cancelled) {
      if (!isolated) { sessionCreated = true; saveSession() }
      const p = response.trim()
      return { response: p ? p + '\n\n(취소됨)' : '(취소됨)', display: (display.trim() || '') + '\n\n(취소됨)' }
    }
    if (exitCode !== 0) {
      const stderr = errText.trim()
      const isHookError = (stderr.includes('hook') || stderr.includes('Hook')) && !resultErrorMsg
      if (!(isHookError && response.trim())) {
        const errMsg = resultErrorMsg.slice(0, 300) || stderr.slice(0, 300) || `exit code ${exitCode}`
        const error = new Error(errMsg) as Error & { exitCode: number; isUsageLimit?: boolean }
        error.exitCode = exitCode ?? -1
        if (resultErrorMsg && /hit your limit|out of extra usage|out of usage|does not have access|login again/i.test(resultErrorMsg))
          error.isUsageLimit = true
        throw error
      }
    }

    if (!isolated) { sessionCreated = true; saveSession() }
    return { response: response.trim() || '(응답 없음)', display: display.trim() }
  } finally {
    busy = false; currentProc = null
    if (timeout) clearTimeout(timeout)
    if (proc && proc.exitCode === null) killGracefully(proc)
  }
}

// 세션 에러 / OOM(137) 시 새 세션으로 1회 재시도. 사용량 한도·인증 만료는 재시도 안 함.
export async function chatStreamWithRetry(
  message: string,
  onChunk: (displayText: string) => void,
  opts: { isolated?: boolean } = {}
): Promise<{ response: string; display: string }> {
  try {
    return await chatStream(message, onChunk, opts)
  } catch (err: any) {
    if (err.isUsageLimit) throw err
    const msg = err.message || ''
    const isHookError = msg.includes('hook') || msg.includes('Hook')
    const isSessionError = !isHookError && /session|resume/i.test(msg)
    const isOOMKill = err.exitCode === 137 || msg.includes('exit code 137')
    if (isSessionError || isOOMKill) {
      if (!opts.isolated) clearSession() // 격리 세션은 매번 새 id 라 clearSession 불필요
      return await chatStream(message, onChunk, opts)
    }
    throw err
  }
}

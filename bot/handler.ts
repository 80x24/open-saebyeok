// 메시지 핸들러 — 채널/엔진과 분리된 순수 흐름 (의존성 주입으로 테스트 가능)
import { basename } from 'path'
import type { IncomingMessage, ReplyHandle } from './channels/channel'
import { withBootstrap } from './bootstrap'
import { handleSkillCommand } from './skills'

// 첨부·답장을 프롬프트로 조립 (이미지=claude Read 도구, 텍스트=인라인, 답장=문맥 주입)
function composeUserPrompt(msg: IncomingMessage): string {
  const parts: string[] = []
  if (msg.replyTo) parts.push(`[답장 대상 (from: ${msg.replyTo.from})]\n${msg.replyTo.text}\n`)
  for (const a of msg.attachments ?? []) {
    if (a.kind === 'image') parts.push(`[첨부 이미지: ${a.path} — Read 도구로 열어 보세요]`)
    else if (a.kind === 'text') parts.push(`<file name="${basename(a.path)}">\n${a.content ?? ''}\n</file>`)
    else parts.push(`[첨부: ${basename(a.path)} — 지원하지 않는 형식이에요 (jpg/png/txt/md/json 등만)]`)
  }
  parts.push(msg.text || '(첨부만 보냈어요)')
  return parts.join('\n')
}

// claude 응답에서 [[do:name arg]] 디렉티브를 추출하고 본문에서 제거 (자연어 → 동작)
export function parseDirectives(text: string): { cleaned: string; directives: { name: string; arg: string }[] } {
  const directives: { name: string; arg: string }[] = []
  const cleaned = text
    .replace(/\[\[do:(\w+)([^\]]*)\]\]/g, (_m, name, arg) => { directives.push({ name, arg: String(arg).trim() }); return '' })
    .replace(/\n{3,}/g, '\n\n').trim()
  return { cleaned, directives }
}

export interface HandlerDeps {
  claudeHome: string
  /** 프롬프트를 claude 로 흘려보내는 함수 (테스트에서 mock) */
  chat: (prompt: string, onChunk: (display: string) => void) => Promise<{ response: string; display: string }>
  cancel: () => boolean
  clear: () => void
  isBusy: () => boolean
  /** 봇 프로세스 재시작 (run.sh 가 다시 띄움). 미주입이면 /restart 비활성 */
  restart?: () => void
  /** 세션 전환 (/resume <id>) */
  resume?: (id: string) => void
  /** 세션 상태 (/status, 헤더 표시) */
  status?: () => { id: string | null; active: boolean; busy: boolean }
}

export function createMessageHandler(deps: HandlerDeps) {
  // 명령어(/x)와 자연어([[do:x]])가 공유하는 액션 — 단일 출처(SSOT)
  const ACTIONS: Record<string, (arg: string) => string> = {
    clear: () => { deps.clear(); return '🗑 대화 기억을 초기화했어요.' },
    status: () => {
      const s = deps.status?.()
      return `🪪 세션 \`${s?.id ? s.id.slice(0, 8) : '없음(새 대화)'}\` · ${s?.busy ? '처리 중' : '대기'}`
    },
    resume: (arg) => {
      if (!arg) return '사용법: `/resume <세션id>` (또는 "그 세션으로 돌아가줘")'
      deps.resume?.(arg); return `🔄 세션 \`${arg.slice(0, 8)}\` 로 전환했어요.`
    },
    restart: () => {
      if (!deps.restart) return '재시작이 지원되지 않는 환경이에요.'
      setTimeout(() => deps.restart!(), 400); return '🔄 재시작할게요. 잠시 후 다시 인사드릴게요.'
    },
  }

  // 현재 세션 id 를 메시지 상단 헤더로 (#abc12345) — 무슨 세션인지 보고 전환할 수 있게
  const header = () => { const id = deps.status?.().id; return id ? `#${id.slice(0, 8)}\n` : '' }

  return async (msg: IncomingMessage, reply: ReplyHandle): Promise<void> => {
    if (!msg.isOwner) return
    const text = msg.text.trim()

    // --- 슬래시 명령 (직접 실행) ---
    if (text === '/cancel') { deps.cancel(); await reply.final('취소했어요.'); return }
    if (text === '/clear') { await reply.final(ACTIONS.clear('')); return }
    if (text === '/status') { await reply.final(ACTIONS.status('')); return }
    if (text.startsWith('/resume')) { await reply.final(ACTIONS.resume(text.replace('/resume', '').trim())); return }
    if (text === '/restart') { await reply.final(ACTIONS.restart('')); return }
    if (text === '/compact') {
      if (deps.isBusy()) { await reply.final('처리 중이에요. 잠시 후 다시 시도해 주세요.'); return }
      await reply.update('🗜 대화를 압축하는 중…')
      try { await deps.chat('/compact', () => {}); await reply.final('✅ 대화를 압축했어요. 맥락은 유지돼요.') }
      catch (e: any) { await reply.final(`⚠️ 압축 실패: ${(e?.message || String(e)).slice(0, 150)}`) }
      return
    }
    const skillReply = handleSkillCommand(deps.claudeHome, text)
    if (skillReply !== null) { await reply.final(skillReply); return }

    if (deps.isBusy()) { await reply.final('아직 이전 응답을 처리 중이에요. 잠시만요.'); return }

    // --- 일반 대화: 즉시 응답 표시 → 진행 스트리밍 → 자연어 디렉티브 실행 ---
    await reply.update(header() + '⏳')  // 첫 답장 즉시 (claude 첫 토큰까지의 갭 체감 제거)
    const prompt = withBootstrap(deps.claudeHome, composeUserPrompt(msg))
    let last = 0
    try {
      const { response } = await deps.chat(prompt, (display) => {
        const now = Date.now()
        if (now - last > 1500) { last = now; reply.update(header() + display).catch(() => {}) }
      })
      // 자연어 요청을 claude 가 [[do:x]] 로 표시했으면 실행하고 본문에서 제거
      const { cleaned, directives } = parseDirectives(response)
      let extra = ''
      for (const d of directives) if (ACTIONS[d.name]) extra += '\n' + ACTIONS[d.name](d.arg)
      await reply.final(header() + (cleaned || '(완료)') + extra)
    } catch (err: any) {
      const m = err.message || String(err)
      const hint = /login|auth|credit|limit|access|인증/i.test(m)
        ? '\n\n💡 구독 로그인이 필요하거나 사용량 한도일 수 있어요. 터미널에서 `claude` 로그인 상태를 확인해보세요.'
        : ''
      await reply.final(header() + `⚠️ 오류: ${m.slice(0, 300)}${hint}`)
    }
  }
}

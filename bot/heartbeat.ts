// 하트비트 (Crons) — 주기적으로 HEARTBEAT.md 지침을 claude -p 로 실행한다.
// 기본 OFF: HEARTBEAT_CRON 이 설정돼야만 돈다 (always-on 비용·행동 통제).
import { Cron } from 'croner'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { curate } from './curator'

export interface HeartbeatDeps {
  claudeHome: string
  chat: (prompt: string, onChunk: (d: string) => void) => Promise<{ response: string; display: string }>
  notify: (text: string) => Promise<void>
  isBusy: () => boolean
}

export type HeartbeatResult = 'busy' | 'no-file' | 'ok' | 'error'

/** 하트비트 1회 실행 (테스트 가능하도록 cron 과 분리) */
export async function runHeartbeatOnce(deps: HeartbeatDeps): Promise<HeartbeatResult> {
  if (deps.isBusy()) { console.log('[heartbeat] 사용 중 — 건너뜀'); return 'busy' }
  const hbPath = join(deps.claudeHome, 'HEARTBEAT.md')
  if (!existsSync(hbPath)) { console.log('[heartbeat] HEARTBEAT.md 없음 — 건너뜀'); return 'no-file' }

  const instructions = readFileSync(hbPath, 'utf-8')
  console.log('[heartbeat] 실행')
  try {
    // 1) Curator — 오래된 기억·스킬을 archive 로 (결정적, claude 호출 전)
    const { archived } = curate(deps.claudeHome)
    if (archived.length) console.log(`[heartbeat] curator archived: ${archived.join(', ')}`)

    // 2) HEARTBEAT.md 지침을 claude 로 실행
    const { response } = await deps.chat(
      `[자동 하트비트] 아래 지침을 수행하세요. 끝에 결과를 한 줄로 요약 보고하세요. 보고(요약)는 반드시 한국어로 작성하세요.\n\n${instructions}`,
      () => {}
    )
    const summary = response?.trim() || ''
    const curNote = archived.length ? ` (정리 ${archived.length}건)` : ''
    if (summary && summary.length < 1500) await deps.notify(`💓 ${summary.slice(0, 1000)}${curNote}`)
    return 'ok'
  } catch (e: any) {
    const m = e?.message || String(e)
    // 실행 직전 사용자 메시지에 선점(busy)된 경우는 실패가 아니므로 조용히 skip (오탐 알림 방지)
    if (m.includes('이전 응답 처리 중')) { console.log('[heartbeat] 실행 직전 선점 — 건너뜀'); return 'busy' }
    await deps.notify(`💔 하트비트 실패: ${m.slice(0, 200)}`)
    return 'error'
  }
}

/** cron 표현식이 있으면 스케줄을 건다. 없으면(기본) null 반환 — 비활성. */
export function startHeartbeat(cronExpr: string, deps: HeartbeatDeps): Cron | null {
  if (!cronExpr || !cronExpr.trim()) {
    console.log('[heartbeat] 비활성 (HEARTBEAT_CRON 미설정)')
    return null
  }
  const job = new Cron(cronExpr, () => { void runHeartbeatOnce(deps) })
  console.log(`[heartbeat] 스케줄 등록: ${cronExpr}`)
  return job
}

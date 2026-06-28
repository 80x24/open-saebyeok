// 메시지 핸들러 — 채널/엔진과 분리된 순수 흐름 (의존성 주입으로 테스트 가능)
import type { IncomingMessage, ReplyHandle } from './channels/channel'
import { withBootstrap } from './bootstrap'
import { handleSkillCommand } from './skills'

export interface HandlerDeps {
  claudeHome: string
  /** 프롬프트를 claude 로 흘려보내는 함수 (테스트에서 mock) */
  chat: (prompt: string, onChunk: (display: string) => void) => Promise<{ response: string; display: string }>
  cancel: () => boolean
  clear: () => void
  isBusy: () => boolean
  /** 봇 프로세스 재시작 (run.sh 가 다시 띄움). 미주입이면 /restart 비활성 */
  restart?: () => void
}

export function createMessageHandler(deps: HandlerDeps) {
  return async (msg: IncomingMessage, reply: ReplyHandle): Promise<void> => {
    if (!msg.isOwner) return
    const text = msg.text.trim()

    if (text === '/cancel') { deps.cancel(); await reply.final('취소했어요.'); return }
    if (text === '/clear') { deps.clear(); await reply.final('세션을 초기화했어요.'); return }
    if (text === '/restart') {
      if (deps.restart) { await reply.final('🔄 재시작할게요. 잠시 후 다시 인사드릴게요.'); deps.restart() }
      else { await reply.final('재시작이 지원되지 않는 환경이에요.') }
      return
    }

    // /skill 명령 — 스킬 승인 게이트 (busy 와 무관하게 처리)
    const skillReply = handleSkillCommand(deps.claudeHome, text)
    if (skillReply !== null) { await reply.final(skillReply); return }

    if (deps.isBusy()) { await reply.final('아직 이전 응답을 처리 중이에요. 잠시만요.'); return }

    const prompt = withBootstrap(deps.claudeHome, text)
    let last = 0
    try {
      const { response } = await deps.chat(prompt, (display) => {
        const now = Date.now()
        if (now - last > 1500) { last = now; reply.update(display).catch(() => {}) }
      })
      await reply.final(response)
    } catch (err: any) {
      const m = err.message || String(err)
      const hint = /login|auth|credit|limit|access|인증/i.test(m)
        ? '\n\n💡 구독 로그인이 필요하거나 사용량 한도일 수 있어요. 터미널에서 `claude` 로그인 상태를 확인해보세요.'
        : ''
      await reply.final(`⚠️ 오류: ${m.slice(0, 300)}${hint}`)
    }
  }
}

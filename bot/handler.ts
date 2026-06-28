// 메시지 핸들러 — 채널/엔진과 분리된 순수 흐름 (의존성 주입으로 테스트 가능)
import type { IncomingMessage, ReplyHandle } from './channels/channel'
import { withBootstrap } from './bootstrap'

export interface HandlerDeps {
  claudeHome: string
  /** 프롬프트를 claude 로 흘려보내는 함수 (테스트에서 mock) */
  chat: (prompt: string, onChunk: (display: string) => void) => Promise<{ response: string; display: string }>
  cancel: () => boolean
  clear: () => void
  isBusy: () => boolean
}

export function createMessageHandler(deps: HandlerDeps) {
  return async (msg: IncomingMessage, reply: ReplyHandle): Promise<void> => {
    if (!msg.isOwner) return
    const text = msg.text.trim()

    if (text === '/cancel') { deps.cancel(); await reply.final('취소했어요.'); return }
    if (text === '/clear') { deps.clear(); await reply.final('세션을 초기화했어요.'); return }
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
      await reply.final(`⚠️ 오류: ${(err.message || String(err)).slice(0, 300)}`)
    }
  }
}

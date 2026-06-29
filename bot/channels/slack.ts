// 슬랙 어댑터 (@slack/bolt, Socket Mode)
// 의존성은 선택적 — 슬랙을 쓸 때만 `bun add @slack/bolt`
import type { Channel, IncomingMessage, ReplyHandle } from './channel'
import { resolveOwner } from './owner'

export async function createSlackChannel(): Promise<Channel> {
  const botToken = process.env.SLACK_BOT_TOKEN
  const appToken = process.env.SLACK_APP_TOKEN
  if (!botToken || !appToken) throw new Error('SLACK_BOT_TOKEN / SLACK_APP_TOKEN 가 필요합니다')
  if (!process.env.SLACK_OWNER_ID) {
    console.warn('[slack] ⚠️ SLACK_OWNER_ID 미설정 — 소유자가 정해질 때까지 메시지를 처리하지 않습니다(fail-closed).')
  }

  let App: any
  try {
    ({ App } = await import('@slack/bolt'))
  } catch {
    throw new Error('슬랙 SDK가 설치돼 있지 않습니다. 설치하세요: cd bot && bun add @slack/bolt')
  }
  const app = new App({ token: botToken, appToken, socketMode: true })

  const notify = async (text: string) => {
    const ownerId = process.env.SLACK_OWNER_ID || ''
    if (!ownerId) return
    try { await app.client.chat.postMessage({ channel: ownerId, text }) } catch {}
  }

  return {
    name: 'slack',
    notify,
    async start(handler) {
      app.message(async ({ message, say, client }: any) => {
        try {
          if (message.subtype) return // 봇 메시지·편집 등 무시 (echo 루프 방지)
          const { allowed, ownerSet } = resolveOwner(process.env.SLACK_OWNER_ID, message.user)
          if (!ownerSet) {
            await say(`🔒 아직 소유자가 설정되지 않았어요. 당신의 user id: ${message.user}\nSLACK_OWNER_ID 에 넣고 /restart 해주세요.`)
            return
          }
          if (!allowed) return

          let ts: string | null = null
          const ensure = async (text: string) => {
            const t = text.slice(-3900) || '...' // telegram 과 통일 — 스트리밍 중 최신(뒤쪽) 표시
            if (!ts) { try { const r: any = await say(t); ts = r.ts } catch {} }
            else { try { await client.chat.update({ channel: message.channel, ts, text: t }) } catch {} }
          }
          const reply: ReplyHandle = { update: ensure, final: ensure }
          const msg: IncomingMessage = { text: message.text || '', userId: message.user, isOwner: true }
          await handler(msg, reply)
        } catch (e: any) {
          console.error('[slack] 처리 오류', e)
          try { await say(`⚠️ 처리 중 오류가 났어요: ${(e?.message || String(e)).slice(0, 200)}`) } catch {}
        }
      })
      await app.start()
      console.log('[slack] Socket Mode 시작')
    },
  }
}

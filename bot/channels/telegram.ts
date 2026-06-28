// 텔레그램 어댑터 (grammY)
import { Bot } from 'grammy'
import { autoRetry } from '@grammyjs/auto-retry'
import type { Channel, IncomingMessage, ReplyHandle } from './channel'
import { resolveOwner } from './owner'

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const

export function createTelegramChannel(): Channel {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 가 없습니다')
  if (!process.env.TELEGRAM_CHAT_ID) {
    console.warn('[telegram] ⚠️ TELEGRAM_CHAT_ID 미설정 — 소유자가 정해질 때까지 메시지를 처리하지 않습니다(fail-closed).')
  }

  const bot = new Bot(token)
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }))

  const notify = async (text: string) => {
    const ownerId = Number(process.env.TELEGRAM_CHAT_ID || 0)
    if (!ownerId) return
    try { await bot.api.sendMessage(ownerId, text, NO_PREVIEW) } catch {}
  }

  return {
    name: 'telegram',
    notify,
    async start(handler) {
      bot.on('message:text', async (ctx) => {
        const { allowed, ownerSet } = resolveOwner(process.env.TELEGRAM_CHAT_ID, ctx.chat.id)
        if (!ownerSet) {
          // 소유자 미설정 — 발신자에게 본인 chat id 를 알려주고 처리하지 않음
          await ctx.reply(
            `🔒 아직 소유자가 설정되지 않았어요.\n당신의 chat id: ${ctx.chat.id}\n` +
            `이 값을 .env 의 TELEGRAM_CHAT_ID 에 넣고 /restart 해주세요.`,
            NO_PREVIEW
          )
          return
        }
        if (!allowed) return // 소유자 아님 — 무시

        let messageId: number | null = null
        const ensure = async (text: string) => {
          const t = text.slice(-3900) || '...'
          if (messageId == null) {
            const m = await ctx.reply(t, NO_PREVIEW)
            messageId = m.message_id
          } else {
            try { await ctx.api.editMessageText(ctx.chat.id, messageId, t, NO_PREVIEW) } catch {}
          }
        }
        const reply: ReplyHandle = { update: ensure, final: ensure }
        const msg: IncomingMessage = { text: ctx.message.text, userId: String(ctx.chat.id), isOwner: true }
        await handler(msg, reply)
      })
      console.log('[telegram] long polling 시작')
      void bot.start()
    },
  }
}

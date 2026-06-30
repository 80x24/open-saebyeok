// 텔레그램 어댑터 (grammY) — 텍스트·이미지·파일·답장(인용)을 IncomingMessage 로 정규화한다.
import { Bot } from 'grammy'
import { autoRetry } from '@grammyjs/auto-retry'
import type { Channel, IncomingMessage, ReplyHandle } from './channel'
import { resolveOwner } from './owner'
import { classifyExt, saveAttachment, readTextSafe } from '../media'
import { toTelegramHtml } from './tg-format'

const NO_PREVIEW = { link_preview_options: { is_disabled: true } } as const
const HTML = { ...NO_PREVIEW, parse_mode: 'HTML' as const }

// 마크다운→HTML 로 보내되, 텔레그램이 엔티티 파싱에 실패하면 평문으로 폴백.
const isParseErr = (e: any) => /can't parse entities|parse_mode|entities/i.test(e?.description || e?.message || '')

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
    try { await bot.api.sendMessage(ownerId, toTelegramHtml(text), HTML) }
    catch (e: any) {
      if (!isParseErr(e)) return
      try { await bot.api.sendMessage(ownerId, text, NO_PREVIEW) } catch {}
    }
  }

  // reply_to_message → replyTo 정규화
  const extractReply = (ctx: any): IncomingMessage['replyTo'] => {
    const r = ctx.message?.reply_to_message
    if (!r) return undefined
    return { text: r.text || r.caption || '', from: r.from?.first_name || '상대' }
  }
  const fileUrl = (filePath: string) => `https://api.telegram.org/file/bot${token}/${filePath}`

  return {
    name: 'telegram',
    notify,
    async start(handler) {
      // 공통: 소유자 게이트 + 스트리밍 reply + handler 호출 (모든 메시지 타입 공유 — DRY)
      const run = async (ctx: any, build: () => Promise<IncomingMessage> | IncomingMessage) => {
        const { allowed, ownerSet } = resolveOwner(process.env.TELEGRAM_CHAT_ID, ctx.chat.id)
        if (!ownerSet) {
          await ctx.reply(
            `🔒 아직 소유자가 설정되지 않았어요.\n당신의 chat id: ${ctx.chat.id}\n` +
            `이 값을 .env 의 TELEGRAM_CHAT_ID 에 넣고 /restart 해주세요.`,
            NO_PREVIEW,
          )
          return
        }
        if (!allowed) return

        let messageId: number | null = null
        const ensure = async (text: string) => {
          const t = text.slice(-3900) || '...'
          const html = toTelegramHtml(t)
          if (messageId == null) {
            try {
              const m = await ctx.reply(html, HTML); messageId = m.message_id
            } catch (e: any) {
              if (!isParseErr(e)) throw e
              const m = await ctx.reply(t, NO_PREVIEW); messageId = m.message_id
            }
          } else {
            try { await ctx.api.editMessageText(ctx.chat.id, messageId, html, HTML) }
            catch (e: any) {
              if (isParseErr(e)) { try { await ctx.api.editMessageText(ctx.chat.id, messageId, t, NO_PREVIEW) } catch {} }
            }
          }
        }
        const reply: ReplyHandle = { update: ensure, final: ensure }
        try {
          await handler(await build(), reply)
        } catch (e: any) {
          await ensure(`⚠️ 처리 중 오류: ${(e?.message || String(e)).slice(0, 200)}`)
        }
      }

      const base = (ctx: any) => ({ userId: String(ctx.chat.id), isOwner: true, replyTo: extractReply(ctx) })

      bot.on('message:text', (ctx) =>
        run(ctx, () => ({ ...base(ctx), text: ctx.message.text })))

      bot.on('message:photo', (ctx) =>
        run(ctx, async () => {
          const file = await ctx.getFile()
          const path = await saveAttachment(fileUrl(file.file_path!), `photo-${file.file_unique_id}.jpg`)
          return { ...base(ctx), text: ctx.message.caption || '', attachments: [{ path, kind: 'image' as const }] }
        }))

      bot.on('message:document', (ctx) =>
        run(ctx, async () => {
          const doc = ctx.message.document
          const file = await ctx.getFile()
          const name = doc.file_name || `file-${file.file_unique_id}`
          const path = await saveAttachment(fileUrl(file.file_path!), name)
          const kind = classifyExt(name)
          return {
            ...base(ctx), text: ctx.message.caption || '',
            attachments: [{ path, kind, content: kind === 'text' ? readTextSafe(path) : undefined }],
          }
        }))

      console.log('[telegram] long polling 시작 (text·photo·document·reply)')
      void bot.start()
    },
  }
}

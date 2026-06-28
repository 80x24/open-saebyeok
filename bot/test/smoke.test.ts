// 스모크 테스트 — claude 를 실제로 부르지 않는다. ~/.claude 도 건드리지 않는다.
// 임시 디렉토리(CLAUDE_HOME)만 써서 골격이 의도대로 도는지 빠르게 검증한다.
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, cpSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { needsBootstrap, withBootstrap, markerPath } from '../bootstrap'
import { createMessageHandler } from '../handler'
import { createTelegramChannel } from '../channels/telegram'
import { createSlackChannel } from '../channels/slack'
import type { ReplyHandle } from '../channels/channel'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'osb-smoke-'))
  mkdirSync(join(home, 'identity'), { recursive: true })
  // 실제 BOOTSTRAP.md 를 임시 홈에 복사 (repo: ../../identity/BOOTSTRAP.md)
  cpSync(join(import.meta.dir, '..', '..', 'identity', 'BOOTSTRAP.md'), join(home, 'identity', 'BOOTSTRAP.md'))
})
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

const noopReply = (): ReplyHandle & { last: () => string } => {
  let final = ''
  return { update: async () => {}, final: async (t: string) => { final = t }, last: () => final } as any
}

describe('① 부트스트랩 로직', () => {
  test('마커 없으면 needsBootstrap = true', () => {
    expect(needsBootstrap(home)).toBe(true)
  })
  test('마커 있으면 false', () => {
    writeFileSync(markerPath(home), '')
    expect(needsBootstrap(home)).toBe(false)
  })
  test('부트스트랩 시 BOOTSTRAP 지시 + 사용자 텍스트가 프롬프트에 들어간다', () => {
    const p = withBootstrap(home, '안녕하세요')
    expect(p).toContain('이름')        // BOOTSTRAP.md 의 "이름부터 묻기" 지시
    expect(p).toContain('안녕하세요')   // 사용자 첫 메시지
  })
  test('마커 있으면 원문 그대로 (지시 안 붙음)', () => {
    writeFileSync(markerPath(home), '')
    expect(withBootstrap(home, '안녕하세요')).toBe('안녕하세요')
  })
})

describe('② 채널 어댑터', () => {
  test('텔레그램: 토큰 없으면 throw', () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    expect(() => createTelegramChannel()).toThrow()
  })
  test('텔레그램: 토큰 있으면 name = telegram', () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:fake'
    const ch = createTelegramChannel()
    expect(ch.name).toBe('telegram')
    delete process.env.TELEGRAM_BOT_TOKEN
  })
  test('슬랙: 토큰 없으면 reject', async () => {
    delete process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_APP_TOKEN
    await expect(createSlackChannel()).rejects.toThrow()
  })
})

describe('③ 이름 온보딩 흐름 (claude mock)', () => {
  test('첫 메시지 → 프롬프트에 부트스트랩 주입 → mock 응답 전달', async () => {
    let captured = ''
    const chat = async (prompt: string, onChunk: (d: string) => void) => {
      captured = prompt
      onChunk('이름을')
      return { response: '안녕하세요! 저를 뭐라고 부를까요?', display: '안녕하세요! 저를 뭐라고 부를까요?' }
    }
    const handler = createMessageHandler({ claudeHome: home, chat, cancel: () => true, clear: () => {}, isBusy: () => false })
    const reply = noopReply()
    await handler({ text: '안녕', userId: 'u1', isOwner: true }, reply)
    expect(captured).toContain('이름')          // 부트스트랩 주입 확인
    expect(reply.last()).toContain('부를까요')   // 응답 전달 확인
  })
  test('소유자가 아니면 무시 (chat 호출 안 됨)', async () => {
    let called = false
    const chat = async () => { called = true; return { response: '', display: '' } }
    const handler = createMessageHandler({ claudeHome: home, chat, cancel: () => true, clear: () => {}, isBusy: () => false })
    await handler({ text: 'hi', userId: 'x', isOwner: false }, noopReply())
    expect(called).toBe(false)
  })
  test('/clear 명령 → clear 호출 + 안내', async () => {
    let cleared = false
    const handler = createMessageHandler({
      claudeHome: home, chat: async () => ({ response: '', display: '' }),
      cancel: () => true, clear: () => { cleared = true }, isBusy: () => false,
    })
    const reply = noopReply()
    await handler({ text: '/clear', userId: 'u1', isOwner: true }, reply)
    expect(cleared).toBe(true)
    expect(reply.last()).toContain('초기화')
  })
  test('이름 설정 후(마커 생성) → 부트스트랩 안 붙고 원문만 전달', async () => {
    writeFileSync(markerPath(home), '') // 온보딩 완료 가정
    let captured = ''
    const chat = async (prompt: string) => { captured = prompt; return { response: 'ok', display: 'ok' } }
    const handler = createMessageHandler({ claudeHome: home, chat, cancel: () => true, clear: () => {}, isBusy: () => false })
    await handler({ text: '오늘 날씨 어때?', userId: 'u1', isOwner: true }, noopReply())
    expect(captured).toBe('오늘 날씨 어때?')   // 지시 없이 원문 그대로
  })
})

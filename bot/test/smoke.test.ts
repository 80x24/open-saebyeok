// 스모크 테스트 — claude 를 실제로 부르지 않는다. ~/.claude 도 건드리지 않는다.
// 임시 디렉토리(CLAUDE_HOME)만 써서 골격이 의도대로 도는지 빠르게 검증한다.
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, cpSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { needsBootstrap, withBootstrap, markerPath } from '../bootstrap'
import { createMessageHandler, parseDirectives } from '../handler'
import { createTelegramChannel } from '../channels/telegram'
import { createSlackChannel } from '../channels/slack'
import type { ReplyHandle, IncomingMessage } from '../channels/channel'

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
  test('/restart → restart 콜백 호출 + 안내', async () => {
    let restarted = false
    const handler = createMessageHandler({
      claudeHome: home, chat: async () => ({ response: '', display: '' }),
      cancel: () => true, clear: () => {}, isBusy: () => false, restart: () => { restarted = true },
    })
    const reply = noopReply()
    await handler({ text: '/restart', userId: 'u1', isOwner: true }, reply)
    expect(reply.last()).toContain('재시작')          // 안내 메시지 먼저 전송
    await new Promise((r) => setTimeout(r, 450))       // 재시작은 메시지 전송 보장 후(400ms)
    expect(restarted).toBe(true)
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

describe('④ 첨부·답장 (1단계 리치 기능)', () => {
  const mk = (overrides: Partial<IncomingMessage>) => {
    writeFileSync(markerPath(home), '') // 온보딩 완료 가정 (부트스트랩 지시 배제)
    let captured = ''
    const chat = async (p: string) => { captured = p; return { response: 'ok', display: 'ok' } }
    const handler = createMessageHandler({ claudeHome: home, chat, cancel: () => true, clear: () => {}, isBusy: () => false })
    const msg = { text: '', userId: 'u1', isOwner: true, ...overrides } as IncomingMessage
    return { handler, msg, get: () => captured }
  }
  test('답장 문맥이 프롬프트에 주입된다', async () => {
    const s = mk({ text: '이거 뭐야', replyTo: { text: '원본메시지', from: '철수' } })
    await s.handler(s.msg, noopReply())
    expect(s.get()).toContain('원본메시지'); expect(s.get()).toContain('철수'); expect(s.get()).toContain('이거 뭐야')
  })
  test('이미지 첨부 → Read 도구 안내로 주입', async () => {
    const s = mk({ attachments: [{ path: '/tmp/x.jpg', kind: 'image' }] })
    await s.handler(s.msg, noopReply())
    expect(s.get()).toContain('/tmp/x.jpg'); expect(s.get()).toContain('Read')
  })
  test('텍스트 파일 → 인라인 주입', async () => {
    const s = mk({ attachments: [{ path: '/tmp/a.txt', kind: 'text', content: '파일내용입니다' }] })
    await s.handler(s.msg, noopReply())
    expect(s.get()).toContain('파일내용입니다'); expect(s.get()).toContain('a.txt')
  })
  test('미지원 파일 → 거부 안내', async () => {
    const s = mk({ attachments: [{ path: '/tmp/x.zip', kind: 'unsupported' }] })
    await s.handler(s.msg, noopReply())
    expect(s.get()).toContain('지원하지 않는')
  })
})

describe('⑤ 세션 명령', () => {
  const mkh = (extra: any = {}) => createMessageHandler({
    claudeHome: home, chat: async () => ({ response: 'ok', display: 'ok' }),
    cancel: () => true, clear: () => {}, isBusy: () => false, ...extra,
  })
  test('/status → 세션 id·상태 표시', async () => {
    const h = mkh({ status: () => ({ id: 'abcd1234efgh5678', active: true, busy: false }) })
    const r = noopReply(); await h({ text: '/status', userId: 'u1', isOwner: true }, r)
    expect(r.last()).toContain('abcd1234')
  })
  test('/resume <id> → 전환 콜백 호출 + 안내', async () => {
    let resumed = ''
    const h = mkh({ resume: (id: string) => { resumed = id } })
    const r = noopReply(); await h({ text: '/resume xyz789abc', userId: 'u1', isOwner: true }, r)
    expect(resumed).toBe('xyz789abc'); expect(r.last()).toContain('전환')
  })
  test('/resume 인자 없으면 사용법 안내', async () => {
    const r = noopReply(); await mkh({ resume: () => {} })({ text: '/resume', userId: 'u1', isOwner: true }, r)
    expect(r.last()).toContain('사용법')
  })
  test('/compact → chat 에 /compact 전달 + 완료 표시', async () => {
    let sent = ''
    const h = mkh({ chat: async (p: string) => { sent = p; return { response: '', display: '' } } })
    const r = noopReply(); await h({ text: '/compact', userId: 'u1', isOwner: true }, r)
    expect(sent).toBe('/compact'); expect(r.last()).toContain('압축')
  })
})

describe('⑥ dual interface (자연어 → 디렉티브) + 세션 헤더', () => {
  test('parseDirectives: [[do:clear]] 추출 + 본문 제거', () => {
    const { cleaned, directives } = parseDirectives('기억 비울게요. [[do:clear]]')
    expect(cleaned).toBe('기억 비울게요.')
    expect(directives).toEqual([{ name: 'clear', arg: '' }])
  })
  test('parseDirectives: arg 포함', () => {
    const { directives } = parseDirectives('전환할게요 [[do:resume abc123]]')
    expect(directives[0]).toEqual({ name: 'resume', arg: 'abc123' })
  })
  test('자연어 응답의 [[do:clear]] → clear 실행 + 본문에서 디렉티브 제거', async () => {
    let cleared = false
    const chat = async () => ({ response: '기억을 비웠어요. [[do:clear]]', display: '' })
    const h = createMessageHandler({ claudeHome: home, chat, cancel: () => true, clear: () => { cleared = true }, isBusy: () => false })
    writeFileSync(markerPath(home), '')
    const r = noopReply()
    await h({ text: '기억 지워줘', userId: 'u1', isOwner: true }, r)
    expect(cleared).toBe(true)
    expect(r.last()).toContain('기억을 비웠어요')
    expect(r.last()).not.toContain('[[do:')
  })
  test('세션 id 헤더가 응답 상단에 표시', async () => {
    const chat = async () => ({ response: '답변이에요', display: '' })
    const h = createMessageHandler({ claudeHome: home, chat, cancel: () => true, clear: () => {}, isBusy: () => false, status: () => ({ id: 'sess1234xxxx', active: true, busy: false }) })
    writeFileSync(markerPath(home), '')
    const r = noopReply()
    await h({ text: '안녕', userId: 'u1', isOwner: true }, r)
    expect(r.last()).toContain('#sess1234')
  })
})

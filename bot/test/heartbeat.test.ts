// 하트비트 스모크 테스트 — 실제 claude 호출 없음, 임시 CLAUDE_HOME 사용
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { runHeartbeatOnce, startHeartbeat, type HeartbeatDeps } from '../heartbeat'

let home: string
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'osb-hb-')) })
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

function deps(over: Partial<HeartbeatDeps> = {}): HeartbeatDeps {
  return {
    claudeHome: home,
    chat: async () => ({ response: '정리 완료', display: '정리 완료' }),
    notify: async () => {},
    isBusy: () => false,
    ...over,
  }
}

describe('하트비트', () => {
  test('HEARTBEAT.md 없으면 no-file (chat 호출 안 됨)', async () => {
    let called = false
    const r = await runHeartbeatOnce(deps({ chat: async () => { called = true; return { response: '', display: '' } } }))
    expect(r).toBe('no-file')
    expect(called).toBe(false)
  })
  test('사용 중이면 busy (chat 호출 안 됨)', async () => {
    writeFileSync(join(home, 'HEARTBEAT.md'), '메모리 정리하기')
    let called = false
    const r = await runHeartbeatOnce(deps({ isBusy: () => true, chat: async () => { called = true; return { response: '', display: '' } } }))
    expect(r).toBe('busy')
    expect(called).toBe(false)
  })
  test('HEARTBEAT.md 있으면 지침을 chat 으로 보내고 ok', async () => {
    writeFileSync(join(home, 'HEARTBEAT.md'), '오늘의 메모리를 정리하라')
    let captured = ''
    let notified = ''
    const r = await runHeartbeatOnce(deps({
      chat: async (p) => { captured = p; return { response: '정리 끝', display: '정리 끝' } },
      notify: async (t) => { notified = t },
    }))
    expect(r).toBe('ok')
    expect(captured).toContain('오늘의 메모리를 정리하라') // 지침 주입
    expect(notified).toContain('정리 끝')                   // 요약 보고
  })
  test('chat 실패하면 error + 실패 알림', async () => {
    writeFileSync(join(home, 'HEARTBEAT.md'), 'x')
    let notified = ''
    const r = await runHeartbeatOnce(deps({
      chat: async () => { throw new Error('타임아웃') },
      notify: async (t) => { notified = t },
    }))
    expect(r).toBe('error')
    expect(notified).toContain('실패')
  })
  test('HEARTBEAT_CRON 없으면 스케줄 비활성 (null)', () => {
    expect(startHeartbeat('', deps())).toBeNull()
  })
  test('cron 표현식 있으면 Cron 인스턴스 반환', () => {
    const job = startHeartbeat('0 */2 * * *', deps())
    expect(job).not.toBeNull()
    job?.stop()
  })
})

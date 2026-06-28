// 채널 로더 테스트 — 미설정/알 수 없는 채널 처리
import { test, expect, describe } from 'bun:test'
import { loadChannel } from '../channels/load'

describe('loadChannel', () => {
  test('빈 채널 → 셋업 위자드로 유도하는 에러', async () => {
    await expect(loadChannel('')).rejects.toThrow(/설정/)
  })
  test('공백만 있어도 미설정 취급', async () => {
    await expect(loadChannel('   ')).rejects.toThrow(/설정/)
  })
  test('알 수 없는 채널 → 에러', async () => {
    await expect(loadChannel('discord')).rejects.toThrow(/알 수 없는/)
  })
})

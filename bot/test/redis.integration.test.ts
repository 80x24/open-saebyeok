// relay/worker Redis 통합 테스트 — 로컬 Redis 가 있을 때만 실제 검증 (없으면 자동 통과).
//   실행: redis-server 띄운 뒤 `bun test`  (또는 REDIS_TEST_URL 지정)
import { test, expect, beforeAll, afterAll } from 'bun:test'
import IORedis from 'ioredis'
import type { IncomingMessage, ReplyHandle } from '../channels/channel'
import { processJob, JOBS_QUEUE, doneKey } from '../channels/redis'
import { delegateJob } from '../relay'

const URL = process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6379'
let redis: IORedis, blocking: IORedis, ok = false

beforeAll(async () => {
  try {
    redis = new IORedis(URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    blocking = new IORedis(URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    await redis.connect(); await blocking.connect(); await redis.ping()
    ok = true
  } catch { ok = false }
})
afterAll(async () => { try { await redis?.quit(); await blocking?.quit() } catch {} })

// 코어 handler 대역 — claude 호출 없이 에코
const mockHandler = async (msg: IncomingMessage, reply: ReplyHandle) => {
  await reply.final(`echo:${msg.text}`)
}

test('worker: processJob 이 결과를 done 큐에 push', async () => {
  if (!ok) { console.log('[skip] redis 없음'); return }
  await redis.del(doneKey('t1'))
  await processJob(redis, { id: 't1', text: '안녕', userId: 'u1' }, mockHandler)
  const r = await redis.brpop(doneKey('t1'), 2)
  expect(r?.[1]).toBe('echo:안녕')
})

test('relay→worker: 위임한 job 을 worker 가 처리해 결과를 회수', async () => {
  if (!ok) return
  await redis.del(JOBS_QUEUE, doneKey('t2'))
  const job = { id: 't2', text: '하이', userId: 'u1' }
  const relayPromise = delegateJob(redis, blocking, job, 3)  // 위임 + 결과 대기
  const wpop = new IORedis(URL)
  const popped = await wpop.brpop(JOBS_QUEUE, 2)             // worker 가 큐에서 꺼냄
  await processJob(redis, JSON.parse(popped![1]), mockHandler)
  await wpop.quit()
  expect(await relayPromise).toBe('echo:하이')
})

test('relay deferred: worker 오프라인이면 타임아웃 null + job 은 큐에 남음', async () => {
  if (!ok) return
  await redis.del(JOBS_QUEUE, doneKey('t3'))
  const result = await delegateJob(redis, blocking, { id: 't3', text: '늦음', userId: 'u1' }, 1)
  expect(result).toBeNull()                                  // 아무도 처리 안 함
  expect(await redis.llen(JOBS_QUEUE)).toBeGreaterThan(0)    // job 은 남아 worker 가 나중에 가져감
})

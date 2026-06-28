// Redis worker 어댑터 — Redis 큐를 "메신저"처럼 취급하는 Channel 구현.
//
// relay(외부서버)가 'jobs' 큐에 일감을 넣으면, worker(로컬)가 brpop 으로 꺼내 코어 handler 로
// 처리하고 결과를 'done:<id>' 로 돌려준다. 코어 흐름(handler)은 그대로 재사용한다.

import IORedis from 'ioredis'
import type { Channel, IncomingMessage, ReplyHandle } from './channel'

export interface Job { id: string; text: string; userId: string }

export const JOBS_QUEUE = 'jobs'
export const doneKey = (id: string) => `done:${id}`
const RESULT_TTL = 300 // 결과는 5분 보관 (relay 가 가져가면 소비됨)

/**
 * job 하나를 코어 handler 로 처리하고 결과를 Redis 에 push 한다 (순수 로직 — 테스트용 분리).
 * worker 는 중간 스트리밍을 생략하고 최종 응답만 relay 로 전달한다.
 */
export async function processJob(
  redis: IORedis,
  job: Job,
  handler: (msg: IncomingMessage, reply: ReplyHandle) => Promise<void>
): Promise<void> {
  let acc = ''
  const reply: ReplyHandle = {
    update: async () => {},
    final: async (text) => { acc = text },
  }
  const msg: IncomingMessage = { text: job.text, userId: job.userId, isOwner: true }
  try {
    await handler(msg, reply)
  } catch (e: any) {
    acc = `⚠️ 오류: ${(e?.message || String(e)).slice(0, 300)}`
  }
  await redis.lpush(doneKey(job.id), acc || '(응답 없음)')
  await redis.expire(doneKey(job.id), RESULT_TTL)
}

export function createRedisWorkerChannel(): Channel {
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL 가 없습니다 (worker 모드 필수)')
  const redis = new IORedis(url, { maxRetriesPerRequest: null })
  const blocking = new IORedis(url, { maxRetriesPerRequest: null }) // brpop 전용 연결

  return {
    name: 'redis-worker',
    // worker 는 메신저 채널이 없다 — 능동 알림 경로 없음(relay 가 채널을 보유).
    async notify() {},
    async start(handler) {
      console.log('[worker] Redis 큐 폴링 시작 (brpop jobs)')
      while (true) {
        let popped: [string, string] | null = null
        try {
          popped = await blocking.brpop(JOBS_QUEUE, 0)
        } catch (e) {
          console.error('[worker] brpop 오류 — 1초 후 재시도', e)
          await Bun.sleep(1000)
          continue
        }
        if (!popped) continue
        let job: Job
        try { job = JSON.parse(popped[1]) } catch { continue }
        console.log(`[worker] job ${job.id} 처리`)
        await processJob(redis, job, handler)
      }
    },
  }
}

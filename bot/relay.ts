// relay 위임 — 외부서버(항상 켜짐)가 메신저 입구를 쥐고, 실제 처리는 로컬 worker 에 맡긴다.
//
// 흐름: 메시지 수신 → 'jobs' 큐에 위임 → 결과 대기(타임아웃)
//   - 결과 도착(worker 살아있음) → 그대로 답
//   - 타임아웃(worker 오프라인) → deferred: "나중에 처리" 안내 + 백그라운드로 늦은 결과 대기 → 도착 시 능동 알림
//
// 정책(b, deferred): relay 는 claude 를 직접 돌리지 않는다(데이터가 로컬에만 있으므로).
// 알려진 한계(MVP): worker 가 job 을 가져간 뒤 처리 중 죽으면 그 job 은 유실된다(lease/재큐 미구현).

import IORedis from 'ioredis'
import { randomUUID } from 'crypto'
import type { Channel, IncomingMessage, ReplyHandle } from './channels/channel'
import { JOBS_QUEUE, doneKey, type Job } from './channels/redis'

const RELAY_TIMEOUT = Number(process.env.RELAY_TIMEOUT_SEC) || 8

/**
 * job 을 큐에 넣고 결과를 timeoutSec 까지 기다린다 (순수 로직 — 테스트용 분리).
 * 결과 문자열 또는 타임아웃 시 null.
 */
export async function delegateJob(
  redis: IORedis,
  blocking: IORedis,
  job: Job,
  timeoutSec: number
): Promise<string | null> {
  await redis.lpush(JOBS_QUEUE, JSON.stringify(job))
  const res = await blocking.brpop(doneKey(job.id), timeoutSec)
  return res ? res[1] : null
}

export function createRelayHandler(channel: Channel, redisUrl: string) {
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null })
  const blocking = new IORedis(redisUrl, { maxRetriesPerRequest: null })

  return async (msg: IncomingMessage, reply: ReplyHandle): Promise<void> => {
    if (!msg.isOwner) return
    const job: Job = { id: randomUUID(), text: msg.text, userId: msg.userId }

    const result = await delegateJob(redis, blocking, job, RELAY_TIMEOUT)
    if (result !== null) { await reply.final(result); return }

    // deferred — worker(로컬) 오프라인. job 은 큐에 남아 worker 가 켜지면 가져간다.
    await reply.final('💤 지금은 로컬(노트북)이 꺼져 있어 바로 처리하지 못해요. 켜지면 이어서 답해드릴게요.')

    // 늦은 결과를 별도 연결로 계속 기다렸다가, 도착하면 능동 알림 (현 프로세스가 살아있는 동안)
    const late = new IORedis(redisUrl, { maxRetriesPerRequest: null })
    late.brpop(doneKey(job.id), 0)
      .then((r) => { if (r) return channel.notify(`⏰ (늦게 도착한 답)\n${r[1]}`) })
      .catch(() => {})
      .finally(() => { void late.quit() })
  }
}

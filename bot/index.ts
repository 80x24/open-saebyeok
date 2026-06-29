// 진입점
// MODE 로 실행 형태를 고른다 (입구만 다르고 코어 흐름·정체성/기억은 동일):
//   standalone (기본) — 한 대에서 메신저 입구+처리 모두 (로컬 1대)
//   worker            — Redis 큐를 듣고 처리만 (로컬, 데이터 보유). relay 와 짝
//   relay             — 메신저 입구만 쥐고 worker 에 위임 (외부 상시 서버, 데이터 없음)

import { chatStreamWithRetry, cancelStream, clearSession, isBusy, resumeSession, sessionStatus } from './claude'
import { createMessageHandler } from './handler'
import { needsBootstrap } from './bootstrap'
import { startHeartbeat } from './heartbeat'
import { loadChannel } from './channels/load'
import { APP_NAME, DATA_DIR } from './config'

const MODE = (process.env.MODE || 'standalone').toLowerCase()

// 코어 메시지 핸들러 (standalone·worker 공용)
const buildHandler = () => createMessageHandler({
  claudeHome: DATA_DIR,
  chat: chatStreamWithRetry,
  cancel: cancelStream,
  clear: clearSession,
  isBusy,
  restart: () => { setTimeout(() => process.exit(0), 500) }, // run.sh 가 다시 띄운다
  resume: resumeSession,
  status: sessionStatus,
})

const startHb = (notify: (t: string) => Promise<void>) =>
  startHeartbeat(process.env.HEARTBEAT_CRON || '', {
    claudeHome: DATA_DIR, chat: chatStreamWithRetry, notify, isBusy,
  })

// 프로세스 치명 오류 → 소유자에게 알리고 종료 (run.sh 가 자동 재시작)
let activeChannel: { notify: (t: string) => Promise<void> } | null = null
process.on('uncaughtException', (e: any) => {
  console.error('✗ uncaughtException:', e)
  Promise.resolve(activeChannel?.notify(`⚠️ 오류가 나서 재시작할게요.\n${(e?.message || String(e)).slice(0, 200)}`))
    .catch(() => {}).finally(() => setTimeout(() => process.exit(1), 800))
})
process.on('unhandledRejection', (e: any) => {
  console.error('✗ unhandledRejection:', e) // 치명 아닐 수 있어 로그만 (반복되면 uncaughtException 으로 드러남)
})

const main = async () => {
  // worker — Redis 큐를 듣고 코어 handler 로 처리 (정체성·기억은 이 로컬에)
  if (MODE === 'worker') {
    const { createRedisWorkerChannel } = await import('./channels/redis')
    const channel = createRedisWorkerChannel()
    activeChannel = channel
    startHb(channel.notify.bind(channel))
    console.log(`[${APP_NAME}] MODE=worker DATA_DIR=${DATA_DIR}`)
    await channel.start(buildHandler())
    return
  }

  // relay — 메신저 입구만 쥐고 worker 에 위임 (외부 상시 서버)
  if (MODE === 'relay') {
    if (!process.env.REDIS_URL) throw new Error('relay 모드는 REDIS_URL 가 필요합니다')
    const channel = await loadChannel(process.env.CHANNEL || '')
    activeChannel = channel
    const { createRelayHandler } = await import('./relay')
    console.log(`[${APP_NAME}] MODE=relay channel=${channel.name}`)
    await channel.start(createRelayHandler(channel, process.env.REDIS_URL))
    return
  }

  // standalone (기본) — 한 대에서 입구+처리 모두
  const channel = await loadChannel(process.env.CHANNEL || '')
  activeChannel = channel
  console.log(`[${APP_NAME}] MODE=standalone channel=${channel.name} DATA_DIR=${DATA_DIR}`)

  if (needsBootstrap(DATA_DIR)) {
    await channel.notify(
      `🌱 ${APP_NAME} 설치 완료!\n\n` +
      '저는 아직 이름이 없어요. 먼저 저를 뭐라고 부를지 정해주세요.\n' +
      '메시지로 이름을 보내주시면 정체성을 설정할게요. (다른 걸 먼저 물어봐도 괜찮아요.)'
    )
  }

  startHb(channel.notify.bind(channel))
  await channel.start(buildHandler())
}

main().catch((e) => {
  // 설정 오류 등은 스택 없이 메시지만 깔끔하게 (비개발자 배려)
  console.error('✗ ' + (e?.message || e))
  process.exit(1)
})

// 진입점
// MODE 로 실행 형태를 고른다 (입구만 다르고 코어 흐름·정체성/기억은 동일):
//   standalone (기본) — 한 대에서 메신저 입구+처리 모두 (로컬 1대)
//   worker            — Redis 큐를 듣고 처리만 (로컬, 데이터 보유). relay 와 짝
//   relay             — 메신저 입구만 쥐고 worker 에 위임 (외부 상시 서버, 데이터 없음)

import { chatStreamWithRetry, cancelStream, clearSession, isBusy, resumeSession, sessionStatus } from './claude'
import { createMessageHandler } from './handler'
import { needsBootstrap } from './bootstrap'
import { startHeartbeat } from './heartbeat'
import { loadChannel, loadChannels } from './channels/load'
import { checkUpdate } from './version'
import { APP_NAME, DATA_DIR } from './config'
import { join } from 'path'

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

// 하트비트 — 기본 ON (relay 외 모든 기능 기본 ON 정책). 끄려면 HEARTBEAT_CRON=off, 주기 변경은 cron 값 지정.
const DEFAULT_HEARTBEAT_CRON = '0 */2 * * *' // 매 2시간 (HEARTBEAT.md 기준)
const heartbeatCron = process.env.HEARTBEAT_CRON === 'off' ? '' : (process.env.HEARTBEAT_CRON || DEFAULT_HEARTBEAT_CRON)
const startHb = (notify: (t: string) => Promise<void>) =>
  startHeartbeat(heartbeatCron, {
    // 하트비트는 격리 세션으로 실행 — 사용자 대화 맥락을 오염시키지 않음 (Hermes: cron 마다 fresh instance)
    claudeHome: DATA_DIR, chat: (m, cb) => chatStreamWithRetry(m, cb, { isolated: true }), notify, isBusy,
  })

// 시작/재시작 인사 — 기본 ON (relay 외 모든 기능 기본 ON 정책).
// STARTUP_GREETING=off 로 끄거나, 임의 문구로 덮어쓸 수 있다. (최초 설치=bootstrap 안내가 따로 나가므로 그땐 생략)
const greetStartup = async (notify: (t: string) => Promise<void>) => {
  const g = process.env.STARTUP_GREETING
  if (g === 'off') return
  const msg = g && g.trim() ? g : '🌅 다시 깨어났어요!'
  try { await notify(msg) } catch {}
}

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

// 시작 후 하루 1회 버전 체크 — 기본 자동 업그레이드 ON (relay 외 모든 기능 기본 ON 정책). 끄려면 AUTO_UPGRADE=false (알림만 하고 "업데이트해줘" 유도).
const REPO_DIR = join(import.meta.dir, '..')
const versionCheck = () => checkUpdate(REPO_DIR).then(async (r) => {
  if (!r || r.behind <= 0) return
  if (process.env.AUTO_UPGRADE !== 'false') {
    await activeChannel?.notify(`🆕 새 버전(${r.behind}개 커밋) — 자동 업데이트할게요…`)
    const p = Bun.spawn(['bash', join(REPO_DIR, 'scripts', 'upgrade.sh')], { stdout: 'inherit', stderr: 'inherit' })
    await p.exited
    await activeChannel?.notify('✅ 업데이트 완료. 재시작해요.')
    setTimeout(() => process.exit(0), 500) // run.sh 가 새 코드로 재시작
  } else {
    await activeChannel?.notify(`🆕 새 버전이 있어요 (${r.behind}개 커밋 뒤처짐). "업데이트해줘" 라고 하면 적용할게요.`)
  }
}).catch(() => {})

const main = async () => {
  setTimeout(() => void versionCheck(), 5000) // 시작 5초 후 백그라운드 버전 체크 (하루 1회)
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

  // standalone (기본) — 한 대에서 입구+처리 모두.
  // CHANNEL 콤마구분 시 여러 메신저 동시 (CHANNEL=telegram,slack). 받은 채널로 답하고(자동), 엔진·세션·기억은 공유.
  const channels = await loadChannels(process.env.CHANNEL || '')
  // 능동 알림(하트비트·시작인사·업데이트)은 모든 채널로 브로드캐스트. reply 는 채널별 자동.
  const broadcast = (t: string) => Promise.allSettled(channels.map((c) => c.notify(t))).then(() => {})
  activeChannel = { notify: broadcast }
  console.log(`[${APP_NAME}] MODE=standalone channels=${channels.map((c) => c.name).join('+')} DATA_DIR=${DATA_DIR}`)

  if (needsBootstrap(DATA_DIR)) {
    await broadcast(
      `🌱 ${APP_NAME} 설치 완료!\n\n` +
      '저는 아직 이름이 없어요. 먼저 저를 뭐라고 부를지 정해주세요.\n' +
      '메시지로 이름을 보내주시면 정체성을 설정할게요. (다른 걸 먼저 물어봐도 괜찮아요.)'
    )
  } else {
    await greetStartup(broadcast) // 시작/재시작 인사
  }

  startHb(broadcast)
  const handler = buildHandler() // 모든 채널이 같은 핸들러(=공유 엔진/세션) 사용
  await Promise.all(channels.map((c) => c.start(handler)))
}

main().catch((e) => {
  // 설정 오류 등은 스택 없이 메시지만 깔끔하게 (비개발자 배려)
  console.error('✗ ' + (e?.message || e))
  process.exit(1)
})

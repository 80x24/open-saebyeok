// open-saebyeok 진입점
// 1) CHANNEL 환경변수로 메신저 어댑터를 고른다 (미설정이면 셋업 위자드로 유도)
// 2) 아직 이름이 없으면(부트스트랩 미완료) 최우선으로 이름부터 묻는다
// 3) 메시지를 claude -p 로 흘려보내고 스트리밍 응답을 돌려준다

import { join } from 'path'
import { homedir } from 'os'
import { chatStreamWithRetry, cancelStream, clearSession, isBusy } from './claude'
import { createMessageHandler } from './handler'
import { needsBootstrap } from './bootstrap'
import { startHeartbeat } from './heartbeat'
import { loadChannel } from './channels/load'

const CLAUDE_HOME = process.env.CLAUDE_HOME || join(homedir(), '.claude')

const main = async () => {
  const channel = await loadChannel(process.env.CHANNEL || '')
  console.log(`[open-saebyeok] channel=${channel.name} CLAUDE_HOME=${CLAUDE_HOME}`)

  if (needsBootstrap(CLAUDE_HOME)) {
    await channel.notify(
      '🌱 open-saebyeok 설치 완료!\n\n' +
      '저는 아직 이름이 없어요. 먼저 저를 뭐라고 부를지 정해주세요.\n' +
      '메시지로 이름을 보내주시면 정체성을 설정할게요. (다른 걸 먼저 물어봐도 괜찮아요.)'
    )
  }

  const handler = createMessageHandler({
    claudeHome: CLAUDE_HOME,
    chat: chatStreamWithRetry,
    cancel: cancelStream,
    clear: clearSession,
    isBusy,
    restart: () => { setTimeout(() => process.exit(0), 500) }, // run.sh 가 다시 띄운다
  })

  // 하트비트 (기본 OFF — HEARTBEAT_CRON 설정 시에만)
  startHeartbeat(process.env.HEARTBEAT_CRON || '', {
    claudeHome: CLAUDE_HOME,
    chat: chatStreamWithRetry,
    notify: channel.notify.bind(channel),
    isBusy,
  })

  await channel.start(handler)
}

main().catch((e) => { console.error(e); process.exit(1) })

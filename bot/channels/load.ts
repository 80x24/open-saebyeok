// 채널 로더 — CHANNEL 값으로 어댑터를 고른다. 미설정이면 셋업 위자드로 유도.
import type { Channel } from './channel'

export async function loadChannel(channelName: string): Promise<Channel> {
  const name = (channelName || '').trim().toLowerCase()
  if (!name) {
    throw new Error(
      '채널이 설정되지 않았습니다. Claude Code 에서 "설정 시작" 이라고 하면 ' +
      '채널·토큰을 대화로 안내합니다 (identity/SETUP.md).'
    )
  }
  if (name === 'telegram') return (await import('./telegram')).createTelegramChannel()
  if (name === 'slack') return (await import('./slack')).createSlackChannel()
  throw new Error(`알 수 없는 CHANNEL: ${name} (telegram | slack)`)
}

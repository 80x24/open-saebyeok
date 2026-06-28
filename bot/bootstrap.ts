// 부트스트랩 — 첫 실행 시 "이름부터 묻기" 를 위한 순수 로직 (claude 호출 없음, 테스트 쉬움)
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export function markerPath(claudeHome: string): string {
  return join(claudeHome, '.open-saebyeok-bootstrapped')
}

/** 아직 이름이 설정되지 않았는가 (마커 파일 부재) */
export function needsBootstrap(claudeHome: string): boolean {
  return !existsSync(markerPath(claudeHome))
}

/** 부트스트랩 미완료면 프롬프트 앞에 "이름부터 물어라" 지시를 붙인다 */
export function withBootstrap(claudeHome: string, userText: string): string {
  if (!needsBootstrap(claudeHome)) return userText
  try {
    const guide = readFileSync(join(claudeHome, 'identity', 'BOOTSTRAP.md'), 'utf-8')
    return `${guide}\n\n---\n사용자의 첫 메시지: "${userText}"`
  } catch {
    return userText
  }
}

// 소유자 판정 — fail-closed. 소유자가 설정 안 됐으면 아무도 통과 못 한다.
// (봇은 --dangerously-skip-permissions 로 claude 를 띄우므로, 미설정 시 누구나 조작하면 RCE 위험)
export interface OwnerCheck {
  /** 이 발신자가 소유자인가 */
  allowed: boolean
  /** 소유자 자체가 설정돼 있는가 (false면 아무에게도 응답 안 함) */
  ownerSet: boolean
}

export function resolveOwner(configuredOwnerId: string | number | undefined, senderId: string | number): OwnerCheck {
  const owner = String(configuredOwnerId ?? '').trim()
  if (!owner) return { allowed: false, ownerSet: false }
  return { allowed: String(senderId).trim() === owner, ownerSet: true }
}

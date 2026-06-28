// 소유자 판정 fail-closed 테스트 (보안)
import { test, expect, describe } from 'bun:test'
import { resolveOwner } from '../channels/owner'

describe('resolveOwner — fail-closed', () => {
  test('소유자 미설정 → ownerSet=false, allowed=false (아무도 통과 못 함)', () => {
    expect(resolveOwner('', 123)).toEqual({ allowed: false, ownerSet: false })
    expect(resolveOwner(undefined, 'U123')).toEqual({ allowed: false, ownerSet: false })
    expect(resolveOwner('   ', 1)).toEqual({ allowed: false, ownerSet: false })
  })
  test('소유자 설정 + 일치 → allowed', () => {
    expect(resolveOwner('123', 123)).toEqual({ allowed: true, ownerSet: true })
    expect(resolveOwner('U1', 'U1')).toEqual({ allowed: true, ownerSet: true })
  })
  test('소유자 설정 + 불일치 → 거부(하지만 ownerSet=true)', () => {
    expect(resolveOwner('123', 999)).toEqual({ allowed: false, ownerSet: true })
  })
  test('숫자/문자열 혼용도 문자열 비교로 정확히 일치', () => {
    expect(resolveOwner(123, '123').allowed).toBe(true)
    expect(resolveOwner('456', 456).allowed).toBe(true)
  })
})

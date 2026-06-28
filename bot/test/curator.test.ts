// Curator 테스트 — now 를 미래로 주입해 "오래됨"을 시뮬 (실제 mtime 조작 불필요)
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { curate } from '../curator'

let home: string
const DAY = 86_400_000
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'osb-cur-'))
  mkdirSync(join(home, 'memory', 'active'), { recursive: true })
  mkdirSync(join(home, 'skills', 'active'), { recursive: true })
})
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

const memo = (n: string) => writeFileSync(join(home, 'memory', 'active', `${n}.md`), '#')
const skill = (n: string) => writeFileSync(join(home, 'skills', 'active', `${n}.md`), '#')

describe('Curator', () => {
  test('기본(now=현재)에는 갓 만든 파일을 건드리지 않는다', () => {
    memo('today'); skill('fresh')
    const { archived } = curate(home)
    expect(archived).toHaveLength(0)
    expect(existsSync(join(home, 'memory', 'active', 'today.md'))).toBe(true)
  })
  test('30일 지난 기억은 archive 로 이동 (비파괴)', () => {
    memo('old')
    const { archived } = curate(home, { now: Date.now() + 40 * DAY })
    expect(archived).toContain('memory:old')
    expect(existsSync(join(home, 'memory', 'active', 'old.md'))).toBe(false)
    expect(existsSync(join(home, 'memory', 'archive', 'old.md'))).toBe(true) // 삭제 아님
  })
  test('스킬은 90일 기준 — 40일로는 안 옮겨짐', () => {
    skill('keep')
    const { archived } = curate(home, { now: Date.now() + 40 * DAY })
    expect(archived).not.toContain('skill:keep')
  })
  test('스킬도 100일 지나면 archive', () => {
    skill('stale')
    const { archived } = curate(home, { now: Date.now() + 100 * DAY })
    expect(archived).toContain('skill:stale')
    expect(existsSync(join(home, 'skills', 'archive', 'stale.md'))).toBe(true)
  })
})

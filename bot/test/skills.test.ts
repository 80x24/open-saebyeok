// 스킬 승인 게이트 테스트
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { listSkills, approveSkill, rejectSkill, handleSkillCommand } from '../skills'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'osb-skill-'))
  mkdirSync(join(home, 'skills', 'pending'), { recursive: true })
  mkdirSync(join(home, 'skills', 'active'), { recursive: true })
})
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

const pending = (name: string) => writeFileSync(join(home, 'skills', 'pending', `${name}.md`), `# ${name}`)

describe('스킬 승인 게이트', () => {
  test('초안은 pending 에만 보이고 active 엔 없다', () => {
    pending('deploy')
    const { active, pending: pend } = listSkills(home)
    expect(pend).toContain('deploy')
    expect(active).not.toContain('deploy')
  })
  test('approve 시 pending → active 이동', () => {
    pending('deploy')
    expect(approveSkill(home, 'deploy')).toBe(true)
    const { active, pending: pend } = listSkills(home)
    expect(active).toContain('deploy')
    expect(pend).not.toContain('deploy')
  })
  test('없는 스킬 approve 는 false', () => {
    expect(approveSkill(home, 'nope')).toBe(false)
  })
  test('reject 는 삭제가 아니라 archive 로 이동 (비파괴)', () => {
    pending('risky')
    expect(rejectSkill(home, 'risky')).toBe(true)
    expect(existsSync(join(home, 'skills', 'archive', 'risky.md'))).toBe(true)
    expect(listSkills(home).pending).not.toContain('risky')
  })
})

describe('/skill 명령', () => {
  test('비-skill 텍스트는 null (일반 메시지로 흘러감)', () => {
    expect(handleSkillCommand(home, '안녕')).toBeNull()
  })
  test('/skill list 는 대기 목록을 보여준다', () => {
    pending('deploy')
    const out = handleSkillCommand(home, '/skill list')!
    expect(out).toContain('deploy')
    expect(out).toContain('승인')
  })
  test('/skill approve <이름> 동작', () => {
    pending('deploy')
    const out = handleSkillCommand(home, '/skill approve deploy')!
    expect(out).toContain('활성화')
    expect(listSkills(home).active).toContain('deploy')
  })
})

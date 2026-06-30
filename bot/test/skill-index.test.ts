// 스킬 인덱스 — frontmatter 파싱 + requires 게이트 + 플랫/디렉토리 인덱싱
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseFrontmatter, skillReqsMet, buildSkillIndex } from '../skill-index'

describe('parseFrontmatter', () => {
  test('name/description 추출 + 따옴표 제거', () => {
    const fm = parseFrontmatter('---\nname: deploy\ndescription: "배포 절차"\n---\n본문')
    expect(fm.name).toBe('deploy')
    expect(fm.description).toBe('배포 절차')
  })
  test('frontmatter 없으면 빈 객체', () => {
    expect(parseFrontmatter('# 그냥 마크다운')).toEqual({})
  })
})

describe('requires 게이트', () => {
  test('없는 바이너리 요구면 false', () => {
    expect(skillReqsMet({ 'requires-bins': 'definitely-not-a-real-bin-xyz' })).toBe(false)
  })
  test('있는 바이너리(sh)면 true', () => {
    expect(skillReqsMet({ 'requires-bins': 'sh' })).toBe(true)
  })
  test('없는 env 요구면 false', () => {
    expect(skillReqsMet({ 'requires-env': 'NUANUA_DEFINITELY_UNSET_ENV' })).toBe(false)
  })
  test('os 불일치면 false', () => {
    expect(skillReqsMet({ 'requires-os': 'plan9' })).toBe(false)
  })
  test('게이트 없으면 true', () => {
    expect(skillReqsMet({})).toBe(true)
  })
})

describe('buildSkillIndex', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'osb-skidx-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  test('플랫 + 디렉토리 스킬 모두 인덱싱, 게이트 탈락은 제외', () => {
    writeFileSync(join(dir, 'plain.md'), '---\nname: plain\ndescription: 게이트 없음\n---\n본문')
    mkdirSync(join(dir, 'has-sh'))
    writeFileSync(join(dir, 'has-sh', 'SKILL.md'), '---\nname: has-sh\ndescription: sh 필요\nrequires-bins: sh\n---\n본문')
    writeFileSync(join(dir, 'missing.md'), '---\nname: missing\ndescription: 없는바이너리\nrequires-bins: nope-xyz\n---\n본문')

    const lines = buildSkillIndex(dir)
    expect(lines).toContain('- plain: 게이트 없음')
    expect(lines).toContain('- has-sh: sh 필요')
    expect(lines.join('\n')).not.toContain('missing')
  })
  test('.gitkeep 무시', () => {
    writeFileSync(join(dir, '.gitkeep'), '')
    expect(buildSkillIndex(dir)).toEqual([])
  })
  test('없는 디렉토리는 빈 배열', () => {
    expect(buildSkillIndex(join(dir, 'nope'))).toEqual([])
  })
})

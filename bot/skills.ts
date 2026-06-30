// 스킬 — 반복 작업을 재사용 절차(마크다운)로 굳힌다.
// drift 방지: 에이전트는 skills/pending/ 에 '초안'만 만들고,
// 사용자가 승인해야 skills/active/ 로 이동한다. 거절은 삭제가 아니라 archive(비파괴).
import { readdirSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

function skillsDir(claudeHome: string, sub: string): string {
  return join(claudeHome, 'skills', sub)
}
function ensureDirs(claudeHome: string) {
  for (const s of ['active', 'pending', 'archive']) mkdirSync(skillsDir(claudeHome, s), { recursive: true })
}
// 플랫 <name>.md 와 AgentSkills 디렉토리 <name>/SKILL.md 둘 다 인식
function listSkillNames(p: string): string[] {
  if (!existsSync(p)) return []
  const out = new Set<string>()
  for (const e of readdirSync(p, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.md') && e.name !== '.gitkeep') out.add(e.name.replace(/\.md$/, ''))
    else if (e.isDirectory() && existsSync(join(p, e.name, 'SKILL.md'))) out.add(e.name)
  }
  return [...out]
}
// name 의 실제 엔트리(<name>.md 또는 <name> 디렉토리) — 없으면 null
function skillEntry(dir: string, name: string): string | null {
  if (existsSync(join(dir, `${name}.md`))) return `${name}.md`
  if (existsSync(join(dir, name, 'SKILL.md'))) return name
  return null
}
function moveSkill(claudeHome: string, name: string, from: string, to: string): boolean {
  ensureDirs(claudeHome)
  const entry = skillEntry(skillsDir(claudeHome, from), name)
  if (!entry) return false
  renameSync(join(skillsDir(claudeHome, from), entry), join(skillsDir(claudeHome, to), entry))
  return true
}

export function listSkills(claudeHome: string): { active: string[]; pending: string[] } {
  return {
    active: listSkillNames(skillsDir(claudeHome, 'active')),
    pending: listSkillNames(skillsDir(claudeHome, 'pending')),
  }
}

/** 대기 중 스킬을 활성화 (pending → active). 플랫·디렉토리 스킬 모두. */
export function approveSkill(claudeHome: string, name: string): boolean {
  return moveSkill(claudeHome, name, 'pending', 'active')
}

/** 대기 중 스킬을 거절 — 삭제하지 않고 archive 로 (비파괴). */
export function rejectSkill(claudeHome: string, name: string): boolean {
  return moveSkill(claudeHome, name, 'pending', 'archive')
}

/** /skill 명령 처리 — 처리했으면 응답 문자열, 아니면 null */
export function handleSkillCommand(claudeHome: string, text: string): string | null {
  if (!text.startsWith('/skill')) return null
  const [, sub, name] = text.split(/\s+/)
  if (!sub || sub === 'list') {
    const { active, pending } = listSkills(claudeHome)
    return `🧩 활성 스킬: ${active.join(', ') || '(없음)'}\n⏳ 승인 대기: ${pending.join(', ') || '(없음)'}` +
      (pending.length ? `\n\n승인: /skill approve <이름>  ·  거절: /skill reject <이름>` : '')
  }
  if (sub === 'approve' && name) return approveSkill(claudeHome, name) ? `✅ '${name}' 활성화했어요.` : `'${name}' 대기 스킬이 없어요.`
  if (sub === 'reject' && name) return rejectSkill(claudeHome, name) ? `🗑 '${name}' 거절(archive로 이동).` : `'${name}' 대기 스킬이 없어요.`
  return '사용법: /skill list | /skill approve <이름> | /skill reject <이름>'
}

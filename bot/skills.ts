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
function listMd(p: string): string[] {
  if (!existsSync(p)) return []
  return readdirSync(p).filter((f) => f.endsWith('.md') && f !== '.gitkeep').map((f) => f.replace(/\.md$/, ''))
}

export function listSkills(claudeHome: string): { active: string[]; pending: string[] } {
  return {
    active: listMd(skillsDir(claudeHome, 'active')),
    pending: listMd(skillsDir(claudeHome, 'pending')),
  }
}

/** 대기 중 스킬을 활성화 (pending → active) */
export function approveSkill(claudeHome: string, name: string): boolean {
  ensureDirs(claudeHome)
  const from = join(skillsDir(claudeHome, 'pending'), `${name}.md`)
  if (!existsSync(from)) return false
  renameSync(from, join(skillsDir(claudeHome, 'active'), `${name}.md`))
  return true
}

/** 대기 중 스킬을 거절 — 삭제하지 않고 archive 로 보낸다 (비파괴) */
export function rejectSkill(claudeHome: string, name: string): boolean {
  ensureDirs(claudeHome)
  const from = join(skillsDir(claudeHome, 'pending'), `${name}.md`)
  if (!existsSync(from)) return false
  renameSync(from, join(skillsDir(claudeHome, 'archive'), `${name}.md`))
  return true
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

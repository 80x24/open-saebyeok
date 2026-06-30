// 스킬 인덱스 — AgentSkills 호환 (frontmatter name/description + requires 게이트).
// 활성 스킬을 이름+요약으로만 시스템 프롬프트에 노출(progressive disclosure), 전문은 에이전트가 필요시 Read.
// 플랫 <name>.md 와 디렉토리 <name>/SKILL.md 둘 다 지원 (ClawHub·Claude Code 스킬 import 가능).
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

export function parseFrontmatter(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  const m = body.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (m) for (const line of m[1].split('\n')) {
    const mm = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (mm) out[mm[1].toLowerCase()] = mm[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

export function firstProseLine(body: string): string {
  const after = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  return after.split('\n').find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('-'))?.trim() || ''
}

function binOnPath(bin: string): boolean {
  return (process.env.PATH || '').split(':').some((d) => { try { return existsSync(join(d, bin)) } catch { return false } })
}

// requires 게이트 — bins(모두 PATH) · env(모두 설정) · os(일치) 안 맞으면 인덱스에서 제외
export function skillReqsMet(fm: Record<string, string>): boolean {
  const csv = (k: string) => (fm[k] || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (csv('requires-bins').some((b) => !binOnPath(b))) return false
  if (csv('requires-env').some((e) => !process.env[e])) return false
  const os = (fm['requires-os'] || '').trim()
  if (os && os !== process.platform) return false
  return true
}

// active 스킬 1건 → 인덱스 줄 (게이트 통과 못하면 null)
export function skillIndexLine(activeDir: string, entryName: string, isDir: boolean): string | null {
  try {
    const file = isDir ? join(activeDir, entryName, 'SKILL.md') : join(activeDir, entryName)
    const body = readFileSync(file, 'utf-8')
    const fm = parseFrontmatter(body)
    if (!skillReqsMet(fm)) return null
    const name = fm.name || entryName.replace(/\.md$/, '')
    const d = fm.description
    const desc = (d && d !== '>' && d !== '|' ? d : firstProseLine(body)).slice(0, 120)
    return `- ${name}: ${desc}`
  } catch { return null }
}

/** active 스킬 디렉토리 → 게이트 통과한 인덱스 줄 배열. 플랫 <name>.md + 디렉토리 <name>/SKILL.md. */
export function buildSkillIndex(activeDir: string): string[] {
  try {
    return readdirSync(activeDir, { withFileTypes: true })
      .filter((e) => (e.isFile() && e.name.endsWith('.md') && e.name !== '.gitkeep') || (e.isDirectory() && existsSync(join(activeDir, e.name, 'SKILL.md'))))
      .map((e) => skillIndexLine(activeDir, e.name, e.isDirectory()))
      .filter((l): l is string => l !== null)
  } catch { return [] }
}

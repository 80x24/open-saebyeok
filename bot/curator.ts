// Curator — 오래된(미사용 추정) 기억·스킬을 정리한다.
// 비파괴 원칙: 절대 삭제하지 않고 archive 로 이동(복구 가능). signal-to-noise 개선.
import { readdirSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { join } from 'path'

const DAY_MS = 86_400_000

export interface CurateResult { archived: string[] }

function moveOld(srcDir: string, archiveDir: string, maxAgeDays: number, now: number): string[] {
  if (!existsSync(srcDir)) return []
  mkdirSync(archiveDir, { recursive: true })
  const moved: string[] = []
  for (const f of readdirSync(srcDir)) {
    if (!f.endsWith('.md') || f === '.gitkeep') continue
    const p = join(srcDir, f)
    const ageDays = (now - statSync(p).mtimeMs) / DAY_MS
    if (ageDays > maxAgeDays) {
      renameSync(p, join(archiveDir, f)) // 비파괴: 이동만
      moved.push(f.replace(/\.md$/, ''))
    }
  }
  return moved
}

/** 오래된 기억(기본 30일)·스킬(기본 90일)을 archive 로 이동. 삭제하지 않는다. */
export function curate(
  claudeHome: string,
  opts?: { memoryDays?: number; skillDays?: number; now?: number }
): CurateResult {
  const now = opts?.now ?? Date.now()
  const memDays = opts?.memoryDays ?? 30
  const skillDays = opts?.skillDays ?? 90
  const archived: string[] = []
  archived.push(
    ...moveOld(join(claudeHome, 'memory', 'active'), join(claudeHome, 'memory', 'archive'), memDays, now)
      .map((n) => `memory:${n}`)
  )
  archived.push(
    ...moveOld(join(claudeHome, 'skills', 'active'), join(claudeHome, 'skills', 'archive'), skillDays, now)
      .map((n) => `skill:${n}`)
  )
  return { archived }
}

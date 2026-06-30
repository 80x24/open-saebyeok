// 버전 체크 — 하루 1회 GitHub 최신과 비교(upgrade.sh --check). 구버전이면 알림/자동 업그레이드 유도.
// (Hermes 의 `update --check` 벤치마크: fetch + origin/main 비교, 파일 변경 없음)
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { DATA_DIR } from './config'

const STAMP = join(DATA_DIR, '.last-version-check')
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 마지막 체크가 24시간 전이면(또는 force) upgrade.sh --check 로 최신 여부 확인.
 * 뒤처졌으면 { behind }, 최신/스킵/실패면 null.
 */
export async function checkUpdate(repoDir: string, force = false): Promise<{ behind: number } | null> {
  if (!force) {
    try { if (existsSync(STAMP) && Date.now() - Number(readFileSync(STAMP, 'utf-8')) < DAY_MS) return null } catch {}
  }
  try { writeFileSync(STAMP, String(Date.now())) } catch {}
  try {
    const proc = Bun.spawn(['bash', join(repoDir, 'upgrade.sh'), '--check'], { stdout: 'pipe', stderr: 'ignore' })
    const out = (await new Response(proc.stdout).text()).trim()
    await proc.exited
    const m = out.match(/BEHIND (\d+)/)
    return m ? { behind: Number(m[1]) } : null
  } catch { return null }
}

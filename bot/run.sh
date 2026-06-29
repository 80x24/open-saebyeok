#!/bin/bash
# 재시작 래퍼 — 크래시·재시작에도 봇이 계속 살아있게 한다 (프로세스 매니저 불필요)
cd "$(dirname "$0")"
unset CLAUDECODE

# bun 이 PATH 에 없으면 기본 설치 위치를 추가 (install.sh 가 방금 깔았는데 셸 rc 가 아직 로드 안 된 경우 대비)
command -v bun >/dev/null 2>&1 || export PATH="$HOME/.bun/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  echo "✗ bun 을 찾을 수 없습니다. 새 터미널을 열거나 'source ~/.zshrc' 후 다시 실행하세요. (설치: https://bun.sh)"
  exit 1
fi

BOT_DIR="$(pwd)"
APP_NAME="${APP_NAME:-nuanua}"   # config.ts 와 같은 잠정 이름 (셸/TS 경계라 값 공유 불가 — 리네이밍 시 양쪽 함께)
LOCKFILE="/tmp/${APP_NAME}.lock"

cleanup_all() {
  for pid in $(pgrep -f "run\\.sh.*$BOT_DIR" 2>/dev/null); do
    [ "$pid" != "$$" ] && kill -9 "$pid" 2>/dev/null
  done
  for pid in $(pgrep -f "bun.*$BOT_DIR/index\\.ts" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
  rm -f "$LOCKFILE"; sleep 1
}
cleanup_all
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

FAIL_COUNT=0
MAX_FAILS=10
while true; do
  echo "[$(date '+%H:%M:%S')] 봇 시작 (연속 실패 $FAIL_COUNT/$MAX_FAILS)"
  START_TS=$(date +%s)
  bun run index.ts 2>&1
  EXIT_CODE=${PIPESTATUS[0]}
  RUNTIME=$(( $(date +%s) - START_TS ))
  echo "[$(date '+%H:%M:%S')] 봇 종료 (exit $EXIT_CODE, ${RUNTIME}s)"

  if [ "$EXIT_CODE" -eq 2 ]; then echo "⚠️ 409 Conflict — 10초 대기"; sleep 10; fi
  if [ "$EXIT_CODE" -eq 0 ]; then
    [ "$RUNTIME" -ge 5 ] && FAIL_COUNT=0
    sleep 2
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    [ "$FAIL_COUNT" -ge "$MAX_FAILS" ] && { echo "❌ 연속 실패 ${FAIL_COUNT}회 — 중단"; break; }
    DELAY=$((FAIL_COUNT * 5)); [ "$DELAY" -gt 120 ] && DELAY=120
    echo "재시작 대기 ${DELAY}s"; sleep "$DELAY"
  fi
done

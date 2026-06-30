#!/bin/bash
# CLI opt-in 토글 — 터미널 claude 에서도 nuanua 데이터를 참조하게 ~/.claude/CLAUDE.md 에
# 마커 블록을 add/remove 한다. 봇은 영향 없음(봇은 cwd+SYSTEM.md 로 이미 적용).
#   bash scripts/setup-cli.sh on    (추가, 기본 — install.sh 가 설치 시 자동 실행)
#   bash scripts/setup-cli.sh off   (제거, opt-out)
set -e

source "$(cd "$(dirname "$0")/.." && pwd)/lib.sh"   # APP_NAME
GLOBAL="$HOME/.claude/CLAUDE.md"
BEGIN="# >>> $APP_NAME (CLI 참조) >>>"
END="# <<< $APP_NAME <<<"
ACTION="${1:-on}"

# 마커 블록 제거 (멱등 · macOS/Linux sed 호환)
remove_block() {
  [ -f "$GLOBAL" ] || return 0
  if sed --version >/dev/null 2>&1; then sed -i "/$BEGIN/,/$END/d" "$GLOBAL"
  else sed -i '' "/$BEGIN/,/$END/d" "$GLOBAL"; fi
}

if [ "$ACTION" = "off" ]; then
  remove_block
  echo "✓ CLI 참조 제거됨 ($GLOBAL)"
  exit 0
fi

mkdir -p "$HOME/.claude"; touch "$GLOBAL"
remove_block   # 중복 방지 (재실행 멱등)
cat >> "$GLOBAL" <<EOF

$BEGIN
$APP_NAME 봇 관련 대화면 ~/.$APP_NAME/CLAUDE.md 와 ~/.$APP_NAME/memory/MEMORY.md(인덱스)를 먼저 Read 해서 맥락을 잡고, 필요한 memory 파일을 읽어라. 기억할 건 ~/.$APP_NAME/memory 에 써라. ($APP_NAME 무관한 작업이면 무시.)
$END
EOF
echo "✓ CLI 참조 추가됨 ($GLOBAL)"
echo "  끄려면: bash scripts/setup-cli.sh off"

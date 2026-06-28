#!/bin/bash
# open-saebyeok 설치 — ~/.claude 에 정체성·기억 골격을 배치하고 봇 의존성을 설치한다.
# 기존 파일은 절대 덮어쓰지 않는다 (이미 쓰던 .claude 를 보호).
set -e

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "▶ open-saebyeok 설치 → $CLAUDE_HOME"

# 1) claude CLI 확인
if ! command -v claude >/dev/null 2>&1; then
  echo "✗ claude CLI 가 없습니다. https://claude.com/claude-code 에서 설치하고 로그인(구독 OAuth)하세요."
  exit 1
fi
echo "✓ claude CLI: $(claude --version 2>/dev/null | head -1)"

# 2) 종량제 키 경고 (비용의 핵심)
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY 가 환경에 설정돼 있습니다."
  echo "    이게 있으면 구독이 아니라 '종량제(API 과금)'로 청구됩니다."
  echo "    봇은 spawn 시 자동 제거하지만, 셸에서 'unset ANTHROPIC_API_KEY' 를 권장합니다."
fi

# 3) 봇 의존성
echo "▶ 봇 의존성 설치 (bun)..."
( cd "$REPO_DIR/bot" && bun install )

# 4) 골격 배치 — 기존 파일 보존
copy_if_absent() {
  if [ ! -e "$2" ]; then cp "$1" "$2"; echo "  + $2"; else echo "  = $2 (이미 있음 → 보존)"; fi
}
mkdir -p "$CLAUDE_HOME/identity" \
         "$CLAUDE_HOME/memory/active" "$CLAUDE_HOME/memory/semantic" "$CLAUDE_HOME/memory/archive"
copy_if_absent "$REPO_DIR/identity/CLAUDE.template.md"   "$CLAUDE_HOME/CLAUDE.md"
copy_if_absent "$REPO_DIR/identity/SOUL.template.md"     "$CLAUDE_HOME/identity/SOUL.md"
copy_if_absent "$REPO_DIR/identity/IDENTITY.template.md" "$CLAUDE_HOME/identity/IDENTITY.md"
cp "$REPO_DIR/identity/BOOTSTRAP.md" "$CLAUDE_HOME/identity/BOOTSTRAP.md"   # 항상 최신 유지
cp "$REPO_DIR/identity/SETUP.md"     "$CLAUDE_HOME/identity/SETUP.md"       # 셋업 위자드

# 5) .env 준비
if [ ! -e "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"; echo "  + .env (토큰을 채우세요)"
fi

cat <<EOF

✅ 설치 완료. 다음 단계:
  1) Claude Code 에서 "설정 시작" 이라고 하세요 — 채널·토큰을 대화로 안내합니다.
     (또는 직접 $REPO_DIR/.env 에 CHANNEL·토큰 입력)
  2) cd $REPO_DIR/bot && ./run.sh
  3) 메신저로 첫 메시지를 보내면 — 에이전트가 가장 먼저 "이름"을 물어봅니다.
EOF

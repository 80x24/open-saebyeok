#!/bin/bash
# 설치 — 전용 데이터 폴더(~/.<APP_NAME>)에 정체성·기억 골격을 배치하고 봇 의존성을 설치한다.
# 기존 파일은 절대 덮어쓰지 않는다 (이미 쓰던 데이터를 보호).
set -e

# 이름·데이터 경로는 bot/config.ts 와 동일 규칙 (리네이밍 시 양쪽 함께)
APP_NAME="${APP_NAME:-nuanua}"
# 데이터 홈 우선순위: AGENT_HOME > CLAUDE_HOME(레거시 호환) > ~/.${APP_NAME}
DATA_DIR="${AGENT_HOME:-${CLAUDE_HOME:-$HOME/.$APP_NAME}}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "▶ $APP_NAME 설치 → $DATA_DIR"

# 1) claude CLI 확인
if ! command -v claude >/dev/null 2>&1; then
  echo "✗ claude CLI 가 없습니다. https://claude.com/claude-code 에서 설치하고 로그인(구독 OAuth)하세요."
  exit 1
fi
echo "✓ claude CLI: $(claude --version 2>/dev/null | head -1)"

# 1-b) bun 확인 — 없으면 자동 설치 (비개발자가 런타임을 의식하지 않게)
if ! command -v bun >/dev/null 2>&1; then
  echo "▶ bun 런타임이 없어 자동 설치합니다..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun >/dev/null 2>&1; then
    echo "✗ bun 자동 설치 실패. 수동 설치 후 다시 실행: https://bun.sh"
    exit 1
  fi
fi
echo "✓ bun: $(bun --version)"

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
mkdir -p "$DATA_DIR/identity" \
         "$DATA_DIR/memory/active" "$DATA_DIR/memory/semantic" "$DATA_DIR/memory/archive"
copy_if_absent "$REPO_DIR/identity/CLAUDE.template.md"   "$DATA_DIR/CLAUDE.md"
copy_if_absent "$REPO_DIR/identity/SOUL.template.md"     "$DATA_DIR/identity/SOUL.md"
copy_if_absent "$REPO_DIR/identity/IDENTITY.template.md" "$DATA_DIR/identity/IDENTITY.md"
cp "$REPO_DIR/identity/BOOTSTRAP.md" "$DATA_DIR/identity/BOOTSTRAP.md"   # 항상 최신 유지
cp "$REPO_DIR/identity/SETUP.md"     "$DATA_DIR/identity/SETUP.md"       # 셋업 위자드

# 봇 설치 경로를 기록 — 셋업 위자드(에이전트)가 bot/.env·run.sh 위치를 알 수 있게
echo "$REPO_DIR" > "$DATA_DIR/.$APP_NAME-path"
echo "  + $DATA_DIR/.$APP_NAME-path → $REPO_DIR"

# 5) .env 준비 — 봇은 bot/.env 를 읽는다 (run.sh 가 bot/ 에서 실행)
if [ ! -e "$REPO_DIR/bot/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/bot/.env"; echo "  + bot/.env (셋업 위자드가 채웁니다)"
fi

cat <<EOF

✅ 설치 완료. 다음 단계:
  1) Claude Code 에서 "설정 시작" 이라고 하세요 — 채널·토큰을 대화로 안내합니다.
     (또는 직접 $REPO_DIR/.env 에 CHANNEL·토큰 입력)
  2) cd $REPO_DIR/bot && ./run.sh
  3) 메신저로 첫 메시지를 보내면 — 에이전트가 가장 먼저 "이름"을 물어봅니다.
EOF

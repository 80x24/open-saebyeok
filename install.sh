#!/bin/bash
# 설치 — 전용 데이터 폴더(~/.<APP_NAME>)에 정체성·기억 골격을 배치하고 봇 의존성을 설치한다.
# 기존 파일은 절대 덮어쓰지 않는다 (이미 쓰던 데이터를 보호).
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$REPO_DIR/lib.sh"   # APP_NAME, DATA_DIR (SSOT)

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

# 5-b) CLI 참조 — 기본 ON (opt-out). 터미널 claude 에서도 nuanua 데이터를 참조하게 한다.
#       끄려면: CLI_REF=off ./install.sh  또는  bash scripts/setup-cli.sh off
if [ "${CLI_REF:-on}" = "off" ]; then
  echo "▶ CLI 참조 비활성(off) — 건너뜀"
else
  bash "$REPO_DIR/scripts/setup-cli.sh" on
fi

# 5-c) 상시 데몬 — 기본 ON (opt-out). 재부팅·로그인 후 자동 시작 (macOS launchd / Linux systemd).
#       채널이 설정돼 있을 때만 등록 (미설정 시 크래시루프 방지 — 신규 설치는 셋업 위자드가 채널 설정 후 등록).
#       끄려면: DAEMON=off ./install.sh  또는  bash scripts/install-daemon.sh uninstall
CH="$(grep -E '^CHANNEL=' "$REPO_DIR/bot/.env" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/#.*//' | tr -d '[:space:]')"
if [ "${DAEMON:-on}" = "off" ]; then
  echo "▶ 상시 데몬 비활성(off) — 건너뜀 (수동 실행: bot/run.sh)"
elif [ -z "$CH" ]; then
  echo "▶ 채널 미설정 — 상시 데몬은 채널 설정(\"설정 시작\") 후 자동 등록됩니다."
else
  bash "$REPO_DIR/scripts/install-daemon.sh"
fi

if [ -z "$QUIET" ]; then
cat <<EOF

✅ 설치 완료. 다음 단계:
  1) 채널·토큰 설정 — 편한 방법 하나:
     · 빠른 CLI 위자드(언어 선택 → 1/2/3):  bash $REPO_DIR/scripts/setup.sh
     · 대화로:  Claude Code 에서 "설정 시작"
     · 수동:  $REPO_DIR/bot/.env 직접 편집
  2) 채널이 설정되면 상시 데몬이 봇을 자동 실행합니다 (재부팅·로그인 후 자동 시작).
     데몬 없이 한 번만 띄우려면: cd $REPO_DIR/bot && ./run.sh
  3) 메신저로 첫 메시지를 보내면 — 에이전트가 가장 먼저 "이름"을 물어봅니다.

ℹ️  relay(유료) 외 기능은 모두 기본 ON 입니다 (대화로 끌 수 있음):
    · 터미널 claude 의 nuanua 참조 — 끄기: bash $REPO_DIR/scripts/setup-cli.sh off
    · 상시 데몬(자동시작) — 끄기: bash $REPO_DIR/scripts/install-daemon.sh uninstall
    · 하트비트(자율 루틴, 매 2시간) — 끄기: bot/.env 에 HEARTBEAT_CRON=off
    · 자동 업그레이드 — 끄기: bot/.env 에 AUTO_UPGRADE=false
EOF
fi

#!/bin/bash
# relay 셋업 위자드 — 외출 중 노트북을 꺼도 작동하게 relay(외부) + worker(이 컴퓨터) 구조를 만든다.
#
# 사용법:
#   bash setup-relay.sh                      # 대화형 위자드
#   bash setup-relay.sh worker redis://...   # 비대화: 이 컴퓨터를 worker 로만 전환
#
# 정책: worker 전환(.env 설정)은 자동. relay 배포는 Fly 명령을 안내한다(실배포는 사용자 확인).
set -e

APP_NAME="${APP_NAME:-nuanua}"
BOT_ENV="${BOT_ENV:-$(cd "$(dirname "$0")" && pwd)/bot/.env}"

# .env 키 설정 — 있으면 교체, 없으면 추가 (BSD/GNU 공통)
set_env() {
  local key="$1" val="$2"
  touch "$BOT_ENV"
  if grep -q "^${key}=" "$BOT_ENV" 2>/dev/null; then
    grep -v "^${key}=" "$BOT_ENV" > "$BOT_ENV.tmp" && mv "$BOT_ENV.tmp" "$BOT_ENV"
  fi
  echo "${key}=${val}" >> "$BOT_ENV"
}

to_worker() {
  local url="$1"
  set_env MODE worker
  set_env REDIS_URL "$url"
  echo "✓ 이 컴퓨터를 worker 로 전환했습니다 ($BOT_ENV: MODE=worker)"
}

# --- 비대화 모드: setup-relay.sh worker <redis_url> ---
if [ "$1" = "worker" ] && [ -n "$2" ]; then
  to_worker "$2"
  echo "  ⚠ 메신저 토큰은 relay 에만 두세요(이중 수신 방지). worker 는 Redis 만 봅니다."
  exit 0
fi

# --- 대화형 위자드 ---
echo "▶ $APP_NAME relay 셋업 위자드"
echo ""
echo "기본(standalone)은 이 컴퓨터가 켜져 있을 때만 답합니다."
echo "relay 구조: 메신저 → relay(외부 상시) → worker(이 컴퓨터)가 켜져 있으면 위임,"
echo "            꺼져 있으면 '나중에 처리'(켜지면 이어서 답)."
echo "필요한 것: Redis 하나(예: Upstash 무료) + 작은 상시 서버(예: Fly, 월 ~\$2)."
echo ""
read -r -p "relay 구조를 설정할까요? (y/N) " yn
case "$yn" in [Yy]*) ;; *) echo "standalone 유지. 종료."; exit 0;; esac

echo ""
read -r -p "Redis 연결 URL (redis://...) : " REDIS_URL
[ -z "$REDIS_URL" ] && { echo "✗ Redis URL 이 필요합니다 (Upstash 등에서 먼저 생성하세요)."; exit 1; }

# 1) 이 컴퓨터 → worker (자동)
echo ""
to_worker "$REDIS_URL"

# 2) relay 배포 (외부 상시 서버) — 안내. 실제 배포는 사용자 확인.
echo ""
read -r -p "relay 를 Fly 에 배포할 준비를 할까요? (y/N) " dep
if [[ "$dep" =~ ^[Yy] ]]; then
  if ! command -v flyctl >/dev/null; then
    echo "✗ flyctl 이 없습니다 → 설치: brew install flyctl  (또는 https://fly.io/docs/flyctl/install/)"
    exit 1
  fi
  echo ""
  echo "다음 명령을 순서대로 실행하세요 (대화형 입력이 있어 직접 실행합니다):"
  echo ""
  echo "  flyctl launch --no-deploy        # 앱 이름·리전 선택 (fly.toml 골격 이미 있음)"
  echo "  flyctl secrets set REDIS_URL='$REDIS_URL' CHANNEL=slack \\"
  echo "      SLACK_BOT_TOKEN=xoxb-... SLACK_APP_TOKEN=xapp-... SLACK_OWNER_ID=U..."
  echo "  flyctl deploy"
  echo ""
  echo "  (텔레그램이면 CHANNEL=telegram, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 로)"
else
  echo "ℹ relay 배포는 나중에 — fly.toml/Dockerfile 골격이 준비돼 있습니다."
fi

echo ""
echo "✅ 완료. 이 컴퓨터는 worker 입니다."
echo "   메신저 토큰은 relay 에만 두고, 이 컴퓨터 worker 시작: cd $(dirname "$BOT_ENV") && ./run.sh"

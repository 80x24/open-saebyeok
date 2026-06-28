#!/bin/bash
# 업그레이드 — 코드만 갱신하고 사용자 데이터(~/.<APP_NAME>)는 절대 건드리지 않는다.
#
# 원리: 코드(repo)와 데이터(~/.<APP_NAME>)가 분리돼 있으므로,
#   git pull 로 코드만 갱신하고, install.sh 를 다시 돌려(copy_if_absent = 멱등)
#   새로 생긴 기본 템플릿만 보충한다. 기존 정체성·기억은 그대로 보존된다.
set -e

APP_NAME="${APP_NAME:-mure}"
DATA_DIR="${AGENT_HOME:-${CLAUDE_HOME:-$HOME/.$APP_NAME}}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "▶ $APP_NAME 업그레이드"
echo "   코드(갱신): $REPO_DIR"
echo "   데이터(보존): $DATA_DIR"
echo ""

cd "$REPO_DIR"

# 로컬 코드 변경이 있으면 보호 (stash)
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "⚠ 코드 폴더에 커밋되지 않은 변경이 있어 stash 합니다 (git stash list 로 확인)."
  git stash push -u -m "upgrade-autostash" >/dev/null 2>&1 || true
fi

BEFORE="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
if ! git pull --ff-only; then
  echo "✗ git pull 실패 (충돌 또는 네트워크). 수동 확인이 필요합니다."
  exit 1
fi
AFTER="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
echo "  코드: $BEFORE → $AFTER"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "ℹ 이미 최신입니다."
fi

# install.sh 재실행 = 의존성 갱신 + 새 기본 템플릿만 보충 (기존 데이터는 copy_if_absent 로 보존)
echo ""
echo "▶ 의존성·기본 템플릿 동기화 (기존 데이터 보존)"
APP_NAME="$APP_NAME" AGENT_HOME="$AGENT_HOME" CLAUDE_HOME="$CLAUDE_HOME" bash "$REPO_DIR/install.sh"

echo ""
echo "✅ 업그레이드 완료. 데이터($DATA_DIR)는 그대로입니다."
echo "   적용: cd $REPO_DIR/bot && ./run.sh   (또는 메신저에서 /restart)"

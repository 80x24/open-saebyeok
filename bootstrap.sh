#!/bin/bash
# nuanua bootstrap — 콜드스타트 설치 + 재설치/업그레이드 (한 줄).
#   curl -fsSL https://raw.githubusercontent.com/80x24/nuanua/main/bootstrap.sh | bash
# 검수하고 싶으면:
#   curl -fsSL https://raw.githubusercontent.com/80x24/nuanua/main/bootstrap.sh -o nuanua-install.sh
#   less nuanua-install.sh && bash nuanua-install.sh
#
# 얇은 래퍼다 — repo 를 clone(신규) 또는 git pull(재설치/업그레이드) 한 뒤 install.sh 에 위임한다.
# 정체성·기억(~/.nuanua)은 install.sh 가 보존한다. claude CLI·bun 확인도 install.sh 가 한다.
set -euo pipefail

REPO="${NUANUA_REPO:-https://github.com/80x24/nuanua}"
DIR="${NUANUA_DIR:-$HOME/nuanua}"
BRANCH="${NUANUA_BRANCH:-main}"

echo "▶ nuanua bootstrap → $DIR"

# 1) git 확인 (clone 에 필요)
if ! command -v git >/dev/null 2>&1; then
  echo "✗ git 이 필요합니다. 먼저 설치하세요 (macOS: xcode-select --install · Linux: apt/dnf install git)."
  exit 1
fi

# 2) clone(신규) 또는 update(재설치/업그레이드)
if [ -d "$DIR/.git" ]; then
  echo "▶ 기존 설치 발견 — 최신으로 업데이트"
  git -C "$DIR" fetch --quiet origin "$BRANCH"
  if git -C "$DIR" merge --ff-only "origin/$BRANCH" >/dev/null 2>&1; then
    echo "  ✓ 코드 최신화 (데이터는 그대로)"
  else
    echo "  ⚠️ 로컬 변경이 있어 자동 업데이트를 건너뜁니다. 수동: cd $DIR && git pull"
  fi
elif [ -e "$DIR" ]; then
  echo "✗ $DIR 가 git 저장소가 아닌데 이미 존재합니다."
  echo "  옮기거나 NUANUA_DIR=다른경로 로 지정 후 다시 실행하세요."
  exit 1
else
  echo "▶ 새로 받기 (git clone)"
  git clone --quiet --branch "$BRANCH" "$REPO" "$DIR"
fi

# 3) 설치 위임 — claude·bun 확인, 의존성 설치, 골격 배치, CLI 참조·데몬(채널 설정 시)까지 install.sh 가 처리
echo "▶ 설치 실행..."
exec bash "$DIR/install.sh"

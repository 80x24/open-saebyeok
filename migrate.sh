#!/bin/bash
# 레거시 데이터 이전 — 예전에 ~/.claude 에 설치한 데이터를 전용 폴더 ~/.<APP_NAME> 로 옮긴다.
#
# 안전 원칙 (중요):
#  - "복사"만 한다 (cp -n). 원본은 절대 건드리지 않는다 → 잘못 돌려도 데이터가 사라지지 않는다.
#  - open-saebyeok 설치 흔적(옛 마커)이 없으면 거부한다 → Claude Code 본체/다른 에이전트 폴더 보호.
#  - CLAUDE.md 는 자동 복사하지 않는다 (Claude Code 전역 지침과 섞일 수 있어 사용자 판단에 맡김).
set -e

APP_NAME="${APP_NAME:-mure}"
SRC="${1:-$HOME/.claude}"
DST="${2:-$HOME/.$APP_NAME}"

echo "▶ 레거시 데이터 이전 (복사·비파괴)"
echo "   from: $SRC"
echo "   to:   $DST"
echo ""

# 안전장치 — open-saebyeok 설치 흔적이 없으면 중단 (본체 폴더 오인 방지)
if [ ! -e "$SRC/.open-saebyeok-bootstrapped" ] && [ ! -e "$SRC/.open-saebyeok-path" ] \
   && [ ! -e "$SRC/.$APP_NAME-bootstrapped" ] && [ ! -e "$SRC/.$APP_NAME-path" ]; then
  echo "✗ $SRC 에서 설치 흔적(마커)을 찾지 못했습니다."
  echo "  이 폴더는 마이그레이션 대상이 아닙니다 (Claude Code 본체 등 다른 데이터를 보호합니다)."
  echo "  대상이 맞다면: APP_NAME=$APP_NAME bash migrate.sh <소스경로> <대상경로>"
  exit 1
fi

if [ "$SRC" = "$DST" ]; then
  echo "✗ 소스와 대상이 같습니다 ($SRC). 이전할 필요가 없습니다."
  exit 1
fi

mkdir -p "$DST"

# 옮길 항목만 명시적으로 (cp -n: 대상에 이미 있으면 보존)
copied=0
for item in identity memory skills HEARTBEAT.md; do
  if [ -e "$SRC/$item" ]; then
    cp -Rn "$SRC/$item" "$DST/" 2>/dev/null && echo "  + $item" && copied=$((copied+1))
  fi
done

# 부트스트랩 마커 → 새 이름으로 복사 (있으면 재부트스트랩 방지)
if [ -e "$SRC/.open-saebyeok-bootstrapped" ] || [ -e "$SRC/.$APP_NAME-bootstrapped" ]; then
  : > "$DST/.$APP_NAME-bootstrapped"
  echo "  + 부트스트랩 마커 (.$APP_NAME-bootstrapped)"
fi

# CLAUDE.md 는 자동 복사 안 함 — 안내만
if [ -e "$SRC/CLAUDE.md" ] && [ ! -e "$DST/CLAUDE.md" ]; then
  echo ""
  echo "  ⚠ $SRC/CLAUDE.md 는 자동 복사하지 않았습니다 (Claude Code 전역 지침일 수 있음)."
  echo "    이 봇 전용 운영 규칙이 맞다면 직접 복사하세요:  cp \"$SRC/CLAUDE.md\" \"$DST/CLAUDE.md\""
fi

echo ""
if [ "$copied" -eq 0 ]; then
  echo "ℹ 옮길 항목이 없었습니다 (이미 이전됐거나 비어 있음)."
else
  echo "✅ 완료. 원본($SRC)은 그대로 보존했습니다."
  echo "   봇을 재시작해 동작을 확인한 뒤, 원본 정리는 직접 판단하세요."
fi

#!/bin/bash
# memory.sh — nuanua 기억 검색·기록 (markdown 3계층, 무거운 DB 없음).
# Hermes 의 selective-retrieval / 구조화 memory 연산을 가벼운 ripgrep 으로.
#   search <키워드...>                  : active·semantic·archive 전부에서 검색 (회상 — archive 무덤도)
#   add <active|semantic:주제> "텍스트"  : 중복 없이 한 줄 추가 (구조화 기록)
# 데이터 폴더: AGENT_HOME (기본 ~/.nuanua). remove/replace 는 에이전트가 Edit 로 직접(더 유연).
set -euo pipefail
DATA="${AGENT_HOME:-$HOME/.nuanua}"
MEM="$DATA/memory"
cmd="${1:-}"; shift || true

case "$cmd" in
  search)
    q="$*"; [ -n "$q" ] || { echo "usage: memory.sh search <키워드>" >&2; exit 2; }
    [ -d "$MEM" ] || { echo "(memory 폴더 없음: $MEM)"; exit 0; }
    if command -v rg >/dev/null 2>&1; then
      rg -i -n --no-heading -S "$q" "$MEM" 2>/dev/null || echo "(매칭 없음: $q)"
    else
      grep -rin "$q" "$MEM" 2>/dev/null || echo "(매칭 없음: $q)"
    fi
    ;;
  add)
    dest="${1:-}"; shift || true; text="$*"
    [ -n "$dest" ] && [ -n "$text" ] || { echo 'usage: memory.sh add <active|semantic:주제> "텍스트"' >&2; exit 2; }
    case "$dest" in
      active)      f="$MEM/active/$(date +%Y-%m-%d).md";;
      semantic:*)  f="$MEM/semantic/${dest#semantic:}.md";;
      *) echo "dest 는 active 또는 semantic:<주제>" >&2; exit 2;;
    esac
    mkdir -p "$(dirname "$f")"; touch "$f"
    if grep -Fqx "- $text" "$f" 2>/dev/null; then
      echo "(중복 — 건너뜀)"
    else
      printf '%s\n' "- $text" >> "$f"; echo "✓ 기록: $f"
    fi
    ;;
  *)
    echo 'usage: memory.sh {search <키워드> | add <active|semantic:주제> "텍스트"}' >&2; exit 2;;
esac

#!/bin/bash
# setup.sh — 대화형 채널 세팅 위자드 (CLI). 평문 .env 편집 대신 1,2,3 선택.
#
# i18n: 영어가 소스, 나머지 언어는 Claude 가 번역(하드코딩 X). 언어는 "입력 우선, locale 기본값".
#       claude 가 없거나 로그인 전이면 영어로 폴백(안전). 번역은 키별로 실패 시 영어 폴백.
# 안전: 빈 입력은 기존 값을 보존(set_if) — 실수로 토큰 날리는 사고 방지. 기존 설정도 덮지 않음.
set -e
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/bot/.env"

# ---------- 영어 카탈로그 (소스) : "key 한칸 뒤 문장" ----------
ENG="$(mktemp)"; TRANS=""
cat > "$ENG" <<'EOF'
where Where do you want to talk to this bot?
o1 Telegram (easy, on your phone)
o2 Slack (for teams)
o3 Later - set it up by chatting (in Claude Code, say "start setup")
note_lang The bot answers in whatever language you message it; this only sets the wizard language.
tg_intro [Telegram] I'll guide you. Open the Telegram app.
tg1 1/2) In @BotFather send /newbot, name your bot (username must end with 'bot'), then copy the long token it gives you.
tg2 2/2) Send any message to @userinfobot - it replies with your chat id (a number).
ask_tgtok Paste your bot token (hidden):
ask_tgchat Your chat id (the number):
sl_intro [Slack] I'll guide you step by step. Open https://api.slack.com/apps in your browser.
sl1 1/6) Create New App -> From scratch -> name it and pick your workspace.
sl2 2/6) Socket Mode -> Enable -> create a token with connections:write -> copy the xapp- token.
sl3 3/6) Event Subscriptions -> Enable -> Subscribe to bot events -> add message.im -> Save.
sl4 4/6) OAuth & Permissions -> Bot Token Scopes -> make sure chat:write is there (add it if missing).
sl5 5/6) Install to Workspace -> Allow -> copy the xoxb- Bot Token.
sl6 6/6) Open your Slack profile -> More -> Copy member ID (it starts with U).
ask_xapp Paste the xapp- token (hidden):
ask_xoxb Paste the xoxb- token (hidden):
ask_owner Your Slack member id (U...):
enter_done Press Enter when this step is done.
bolt Installing the Slack SDK (@slack/bolt)...
already Already configured. Leave a field blank to keep its current value.
kept left blank - kept the existing value.
keep_tg Keep Telegram too and run both? [Y/n]
keep_sl Keep Slack too and run both? [Y/n]
saved Saved to bot/.env (your other settings are preserved).
later OK. Open Claude Code and say "start setup" - the agent will walk you through it by chat.
start_q Start the bot now and keep it always on? [Y/n]
started Done! The bot is running. Send it a message on your messenger.
manual Done. To start it later, run run.sh inside the bot folder.
notok Tokens are missing, so I won't start the bot yet. Re-run setup and paste the tokens.
invalid That is not one of the options.
translating Translating the wizard into your language with Claude (a few seconds)...
trans_off Claude is unavailable or not signed in - continuing in English.
EOF

# ---------- 언어: 입력 우선, locale 기본값 ----------
loc="${NUANUA_LANG:-${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}}"; loc="${loc%%.*}"; loc="${loc%%_*}"
case "$loc" in C|POSIX) loc="" ;; esac
def="${loc:-English}"
echo "Language? [$def]  — Enter to accept, or type one (한국어 · 日本語 · Español · ...):"
printf "> "; read -r LANG_IN || true
LANG_SEL="${LANG_IN:-$def}"

# ---------- 비영어면 Claude 로 번역 ----------
case "$(printf '%s' "$LANG_SEL" | tr 'A-Z' 'a-z')" in
  en|eng|english) : ;;   # 소스가 영어 — 번역 불필요
  *)
    if command -v claude >/dev/null 2>&1; then
      echo "$(grep '^translating ' "$ENG" | cut -d' ' -f2-)"
      TRANS="$(mktemp)"
      claude -p "$(printf 'Translate the text after the first space on each line into this language: "%s". Keep the first word (the key) unchanged. Keep URLs, @handles, ->, [..], xoxb-, xapp-, message.im, numbers, slashes and punctuation intact. Output ONLY lines of "key<space>translation", same keys, same number of lines, nothing else.\n\n%s' "$LANG_SEL" "$(cat "$ENG")")" </dev/null 2>/dev/null > "$TRANS" || TRANS=""
      # 번역이 비었으면 영어로 (trans_off 안내)
      [ -s "${TRANS:-/nonexistent}" ] || { TRANS=""; echo "$(grep '^trans_off ' "$ENG" | cut -d' ' -f2-)"; }
    else
      echo "$(grep '^trans_off ' "$ENG" | cut -d' ' -f2-)"
    fi
    ;;
esac

# 번역(있으면) → 없으면 영어. 키별 폴백.
t() {
  local l=""
  [ -n "$TRANS" ] && l="$(grep -m1 "^$1 " "$TRANS" 2>/dev/null || true)"
  [ -z "$l" ] && l="$(grep -m1 "^$1 " "$ENG" 2>/dev/null || true)"
  printf '%s' "${l#* }"
}

# ---------- .env 헬퍼 ----------
set_env() { grep -vE "^$1=" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true; printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE.tmp"; mv "$ENV_FILE.tmp" "$ENV_FILE"; }
set_if()  { if [ -n "$2" ]; then set_env "$1" "$2"; else echo "$(t kept)"; fi; }
has_env() { [ -n "$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/#.*//' | tr -d '[:space:]')" ]; }
touch "$ENV_FILE"

# ---------- 채널 선택 ----------
echo; echo "($(t note_lang))"
echo; echo "$(t where)"
echo "  1) $(t o1)"
echo "  2) $(t o2)"
echo "  3) $(t o3)"
printf "> "; read -r ch || true

case "$ch" in
  1)
    echo; echo "$(t tg_intro)"
    has_env TELEGRAM_BOT_TOKEN && echo "$(t already)"
    echo; echo "$(t tg1)"; printf '%s ' "$(t ask_tgtok)";  read -r -s tok;  echo
    echo "$(t tg2)";       printf '%s ' "$(t ask_tgchat)"; read -r chat
    set_if TELEGRAM_BOT_TOKEN "$tok"
    set_if TELEGRAM_CHAT_ID "$chat"
    set_env MODE standalone
    if has_env SLACK_BOT_TOKEN; then
      echo; printf '%s ' "$(t keep_sl)"; read -r ks || true
      case "$ks" in n|N|no|No) set_env CHANNEL telegram ;; *) set_env CHANNEL telegram,slack ;; esac
    else set_env CHANNEL telegram; fi
    echo; echo "$(t saved)"
    ;;
  2)
    echo; echo "$(t sl_intro)"
    has_env SLACK_BOT_TOKEN && echo "$(t already)"
    echo; echo "$(t sl1)"; printf '%s' "$(t enter_done)"; read -r _ || true
    echo "$(t sl2)"; printf '%s ' "$(t ask_xapp)";  read -r -s xapp; echo
    echo "$(t sl3)"; printf '%s' "$(t enter_done)"; read -r _ || true
    echo "$(t sl4)"; printf '%s' "$(t enter_done)"; read -r _ || true
    echo "$(t sl5)"; printf '%s ' "$(t ask_xoxb)";  read -r -s xoxb; echo
    echo "$(t sl6)"; printf '%s ' "$(t ask_owner)"; read -r owner
    if [ ! -d "$REPO_DIR/bot/node_modules/@slack/bolt" ]; then echo "$(t bolt)"; ( cd "$REPO_DIR/bot" && bun add @slack/bolt >/dev/null 2>&1 ) || true; fi
    set_if SLACK_BOT_TOKEN "$xoxb"
    set_if SLACK_APP_TOKEN "$xapp"
    set_if SLACK_OWNER_ID "$owner"
    set_env MODE standalone
    if has_env TELEGRAM_BOT_TOKEN; then
      echo; printf '%s ' "$(t keep_tg)"; read -r kt || true
      case "$kt" in n|N|no|No) set_env CHANNEL slack ;; *) set_env CHANNEL telegram,slack ;; esac
    else set_env CHANNEL slack; fi
    echo; echo "$(t saved)"
    ;;
  3|"")
    echo; echo "$(t later)"; rm -f "$ENG" "${TRANS:-}"; exit 0 ;;
  *)
    echo "$(t invalid)"; rm -f "$ENG" "${TRANS:-}"; exit 1 ;;
esac

# ---------- 시작 (토큰 있을 때만 — 크래시루프 방지) ----------
ch_now="$(grep -E '^CHANNEL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')"
ready=yes
case "$ch_now" in *telegram*) has_env TELEGRAM_BOT_TOKEN || ready=no ;; esac
case "$ch_now" in *slack*)    has_env SLACK_BOT_TOKEN    || ready=no ;; esac
echo
if [ "$ready" = no ]; then
  echo "$(t notok)"
else
  printf '%s ' "$(t start_q)"; read -r yn || true
  case "$yn" in
    n|N|no|No) echo "$(t manual)"; echo "  cd $REPO_DIR/bot && ./run.sh" ;;
    *) bash "$REPO_DIR/scripts/install-daemon.sh" >/dev/null 2>&1 || bash "$REPO_DIR/scripts/install-daemon.sh"; echo "$(t started)" ;;
  esac
fi
rm -f "$ENG" "${TRANS:-}"

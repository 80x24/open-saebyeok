# 셋업 위자드 — 채널 설정 (최초 1회)

아직 메신저 채널이 설정되지 않았습니다 (`bot/.env` 의 `CHANNEL` 이 비어 있음).
사용자를 아래 순서로 **대화로** 안내하세요. 한 번에 다 묻지 말고, 한 단계씩 친절하게.

> **봇 설치 경로**: `cat ~/.claude/.open-saebyeok-path` 로 확인하세요 (보통 `~/.claude/open-saebyeok`).
> 아래 `<설치경로>` 는 모두 이 값으로 치환합니다. `bot/.env` 는 `<설치경로>/bot/.env` 입니다.

## 1. 채널 선택
"어느 메신저로 대화할까요? **텔레그램**과 **슬랙** 중 고를 수 있어요." 라고 물어보세요.

## 2. 토큰 발급 안내

### 텔레그램을 고르면
1. 텔레그램에서 **@BotFather** 를 열고 `/newbot` → 이름·username 정하면 **봇 토큰**을 받습니다.
2. **@userinfobot** 에게 아무 메시지나 보내면 본인 **chat id** 를 알려줍니다.
3. 두 값을 받아 `bot/.env` 에 기록: `CHANNEL=telegram`, `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_CHAT_ID=...`

### 슬랙을 고르면
0. 슬랙 SDK 설치: `cd <설치경로>/bot && bun add @slack/bolt`
1. https://api.slack.com/apps → **Create New App** → From scratch
2. **Socket Mode** 켜기 → App-Level Token(`xapp-...`) 생성 (scope: `connections:write`)
3. **OAuth & Permissions** → Bot Token Scopes 에 `chat:write`, `im:history`, `im:read`, `im:write` 추가 → 워크스페이스 설치 → Bot Token(`xoxb-...`)
4. **Event Subscriptions** → `message.im` 구독
5. 본인 Slack member id (프로필 → More → Copy member ID)
6. 값을 `bot/.env` 에 기록: `CHANNEL=slack`, `SLACK_BOT_TOKEN=xoxb-...`, `SLACK_APP_TOKEN=xapp-...`, `SLACK_OWNER_ID=...`

## 3. 기록 방법
토큰은 `<설치경로>/bot/.env` 에 씁니다 (`.claude/` 가 아님).

- **처음 설치**(빈 .env)면 아래처럼 전체를 써도 됩니다.
- **이미 설정이 있으면**(채널 전환 등) 기존 값을 보존하도록 **해당 줄만** 갱신하세요. `HEARTBEAT_CRON` 같은 다른 설정을 날리지 않게.

Write/Edit 가 막히면 Bash 로:

```bash
cd <설치경로>/bot

# 텔레그램이면
cat > .env <<'EOF'
CHANNEL=telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
EOF

# 슬랙이면
cat > .env <<'EOF'
CHANNEL=slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_OWNER_ID=...
EOF
```

> 일부만 바꿀 땐 전체 덮어쓰기 대신 해당 줄만 수정하세요 (기존 `.env` 를 읽어 그 줄만 교체).

## 4. 봇 기동
- 처음이면: `cd bot && ./run.sh`
- 이미 떠 있으면: 메신저에서 `/restart`

## 5. 다음 단계
봇이 뜨면 메신저로 첫 메시지를 보내라고 안내하세요 → `BOOTSTRAP.md` 의 **이름 온보딩**으로 이어집니다.

---
유연하게. 토큰 발급에서 막히면 단계별로 도와주고, 다 되면 직접 `.env` 를 채워주세요.

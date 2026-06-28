# 셋업 위자드 — 채널 설정 (최초 1회)

아직 메신저 채널이 설정되지 않았습니다 (`bot/.env` 의 `CHANNEL` 이 비어 있음).
사용자를 아래 순서로 **대화로** 안내하세요. 한 번에 다 묻지 말고, 한 단계씩 친절하게.

## 1. 채널 선택
"어느 메신저로 대화할까요? **텔레그램**과 **슬랙** 중 고를 수 있어요." 라고 물어보세요.

## 2. 토큰 발급 안내

### 텔레그램을 고르면
1. 텔레그램에서 **@BotFather** 를 열고 `/newbot` → 이름·username 정하면 **봇 토큰**을 받습니다.
2. **@userinfobot** 에게 아무 메시지나 보내면 본인 **chat id** 를 알려줍니다.
3. 두 값을 받아 `bot/.env` 에 기록: `CHANNEL=telegram`, `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_CHAT_ID=...`

### 슬랙을 고르면
1. https://api.slack.com/apps → **Create New App** → From scratch
2. **Socket Mode** 켜기 → App-Level Token(`xapp-...`) 생성 (scope: `connections:write`)
3. **OAuth & Permissions** → Bot Token Scopes 에 `chat:write`, `im:history`, `im:read`, `im:write` 추가 → 워크스페이스 설치 → Bot Token(`xoxb-...`)
4. **Event Subscriptions** → `message.im` 구독
5. 본인 Slack member id (프로필 → More → Copy member ID)
6. 값을 `bot/.env` 에 기록: `CHANNEL=slack`, `SLACK_BOT_TOKEN=xoxb-...`, `SLACK_APP_TOKEN=xapp-...`, `SLACK_OWNER_ID=...`

## 3. 기록 방법
`.claude/` 가 아니라 **`bot/.env`** 에 씁니다. Write/Edit 가 막히면 Bash 로 (기존 .env 가 있으면 해당 줄만 갱신):

```bash
cd <설치경로>/bot
cat > .env <<'EOF'
CHANNEL=telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
EOF
```

## 4. 봇 기동
- 처음이면: `cd bot && ./run.sh`
- 이미 떠 있으면: 메신저에서 `/restart`

## 5. 다음 단계
봇이 뜨면 메신저로 첫 메시지를 보내라고 안내하세요 → `BOOTSTRAP.md` 의 **이름 온보딩**으로 이어집니다.

---
유연하게. 토큰 발급에서 막히면 단계별로 도와주고, 다 되면 직접 `.env` 를 채워주세요.

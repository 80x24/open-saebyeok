# 셋업 위자드 — 메신저 연결하기 (처음 한 번)

아직 어느 메신저로 대화할지 안 정해졌어요 (`bot/.env` 의 `CHANNEL` 이 비어 있음).
사용자를 아래 순서로 **친절하게, 한 단계씩** 안내하세요. 어려운 용어는 풀어서 설명하고, 막히면 같이 풀어주세요.

> 봇 설치 경로: `cat ~/.mure/.mure-path` 로 확인 (보통 `~/mure`). 아래 `<설치경로>` 는 이 값입니다.

## 1단계 — 어디서 대화할까요?

"텔레그램과 슬랙 중 어디서 저랑 대화하고 싶으세요?" 라고 물어보세요.
- 폰에서 가볍게 쓰기 좋은 건 **텔레그램** (설정이 더 쉬워요).
- 회사·팀에서 슬랙을 쓰면 **슬랙**.

## 2단계 — 연결 "키" 받기

메신저와 연결하려면 메신저가 주는 **키**(비밀번호 같은 것) 몇 개가 필요해요. 사용자가 직접 발급하도록 아래를 보며 도와주세요.

### 📱 텔레그램이면 (쉬움)
1. 텔레그램에서 **@BotFather** 를 검색해 대화를 엽니다.
2. `/newbot` 을 보내고, 봇 이름과 사용자명(끝이 `bot` 이어야 함)을 정합니다.
3. BotFather 가 긴 **봇 토큰**(키)을 줍니다 → 복사.
4. **@userinfobot** 을 검색해 아무 메시지나 보내면, 본인 **chat id**(숫자)를 알려줍니다 → 복사.

→ 필요한 것: **봇 토큰**, **chat id**.

### 💬 슬랙이면 (단계가 조금 많아요 — 천천히 같이)
슬랙은 "앱"을 하나 만들어 연결해요. 브라우저에서 진행합니다.

1. **앱 만들기** — https://api.slack.com/apps → **Create New App** → **From scratch** → 앱 이름 짓고 워크스페이스 선택.
2. **실시간 연결 켜기** — 왼쪽 메뉴 **Socket Mode** → **Enable Socket Mode** 를 켭니다.
   - 켜면 토큰을 만들라고 해요 → 권한 **`connections:write`** 선택 → 생성하면 **`xapp-`** 로 시작하는 키가 나옵니다 → 복사.
3. **메시지 받기 설정** — 왼쪽 **Event Subscriptions** → **Enable Events** 켜기 → **Subscribe to bot events** → **Add Bot User Event** → **`message.im`** 을 추가.
   - 슬랙이 "이 권한이 필요해요" 라고 안내하면 그대로 따라 추가하세요(저장).
4. **답장 권한 확인** — 왼쪽 **OAuth & Permissions** → **Bot Token Scopes** 에 **`chat:write`** 가 있는지 봅니다(없으면 **Add an OAuth Scope** 로 추가).
5. **워크스페이스에 설치** — 같은 페이지 위쪽 **Install to Workspace** → 허용 → **`xoxb-`** 로 시작하는 **Bot Token** 이 나옵니다 → 복사.
6. **본인 ID 복사** — 슬랙 앱에서 본인 프로필 → **⋯ (More)** → **Copy member ID** (예: `U01ABC...`).
7. **슬랙 SDK 설치** — 터미널에서 `cd <설치경로>/bot && bun add @slack/bolt`

→ 필요한 것: **`xoxb-` 토큰**, **`xapp-` 토큰**, **member id**.

## 3단계 — 키 저장하기

받은 값을 `<설치경로>/bot/.env` 에 적습니다 (데이터 폴더 `~/.mure/` 가 아니라 봇 폴더예요).
처음이면 전체를 써도 되고, **이미 설정이 있으면 해당 줄만** 바꿔 다른 설정(`HEARTBEAT_CRON` 등)을 지우지 마세요.

```bash
cd <설치경로>/bot

# 텔레그램이면
cat > .env <<'EOF'
CHANNEL=telegram
TELEGRAM_BOT_TOKEN=여기에-봇-토큰
TELEGRAM_CHAT_ID=여기에-chat-id
EOF

# 슬랙이면
cat > .env <<'EOF'
CHANNEL=slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_OWNER_ID=U01ABC...
EOF
```

## 4단계 — 봇 켜기

- 처음이면: `cd <설치경로>/bot && ./run.sh`
- 이미 켜져 있으면: 메신저에서 `/restart`

## 5단계 — 첫 인사

봇이 켜지면 메신저로 아무 메시지나 보내라고 안내하세요.
- 슬랙이면, 먼저 슬랙 앱에서 **만든 봇을 찾아 DM(다이렉트 메시지)** 을 여세요.
- 그러면 봇이 가장 먼저 **"저를 뭐라고 부를까요?"** 하고 이름을 물어봅니다 (다음 단계: `BOOTSTRAP.md`).

---

## (선택·고급) 외출 중에도 항상 작동하게 — relay

기본(standalone)은 이 컴퓨터가 켜져 있을 때만 답해요. 노트북을 꺼도 봇이 계속 작동하게 하려면, 항상 켜진 작은 외부 서버(relay)를 두고 이 컴퓨터는 worker 로 붙입니다.

**구조:** 메신저 → relay(외부, 상시) → 이 컴퓨터(worker)가 켜져 있으면 위임 / 꺼져 있으면 "나중에 처리"(켜지면 이어서 답).

**필요한 것:** Redis 하나(예: Upstash 무료 tier) + 작은 상시 서버 하나(예: Fly, 월 ~$2).

1. **Redis 만들기** — Upstash 등에서 Redis 생성 → 연결 URL(`redis://...`) 복사.
2. **relay 배포** — 외부 서버(Fly 등)에 이 저장소를 올리고 환경변수 설정: `MODE=relay`, `REDIS_URL`, `CHANNEL`, 그리고 메신저 토큰. 배포 골격은 저장소의 `Dockerfile` · `fly.toml` 참고.
3. **이 컴퓨터를 worker 로** — `bot/.env` 에 `MODE=worker` 와 `REDIS_URL` 을 넣고 `./run.sh`.
4. **메신저 토큰은 relay 에만** — 로컬(worker)에서는 메신저 토큰을 빼세요(이중 수신 방지). worker 는 Redis 만 봅니다.

> relay 와 worker 는 **같은 코드**입니다 — `MODE` 환경변수만 다릅니다. 코어 동작·정체성·기억은 그대로예요. relay 가 worker 의 응답을 `RELAY_TIMEOUT_SEC`(기본 8초) 안에 못 받으면 "나중에 처리"로 미루고, worker 가 켜지면 그 일을 가져가 처리합니다.

---
계속 친절하게. 토큰 발급에서 막히면 한 단계씩 같이 풀어주세요. 특히 슬랙은 단계가 많으니 서두르지 말고, 키 하나씩 확인하며 진행하세요.

# open-saebyeok

**메신저로 대화하는, 나만의 이름을 가진 AI 에이전트.**
`claude -p`(파이프 모드)를 **구독 인증**으로 감싸서, Claude 구독료 외에 **추가 비용이 들지 않습니다.**

> 새벽네시(saebyeoknesi) 시스템에서 파생된 오픈소스 골격입니다. 정체성·기억·메신저 채널을 갖춘 개인 에이전트를, 무거운 DB 없이 **마크다운 + 구독**으로 굴립니다.

---

## 왜?

- 💸 **구독으로 공짜** — `ANTHROPIC_API_KEY`를 차단하고 Claude 구독 OAuth로만 돌립니다. 종량제 API 봇은 always-on이면 월 수백 달러가 나가지만, 이건 **구독료만**.
- 🧠 **기억한다** — 대화가 끊겨도 `memory/` 의 마크다운으로 맥락을 이어갑니다.
- 🪪 **인격이 있다** — `identity/SOUL.md` 로 정의된 한 존재로 동작합니다. 첫 실행 때 **이름부터 정합니다.**
- 🔌 **채널 교체** — 텔레그램/슬랙을 어댑터 한 파일로 갈아끼웁니다.
- 🌱 **스스로 자란다(안전하게)** — 하트비트·스킬·Curator로 compounding하되, 스킬은 사용자 승인이 있어야 활성화되고 정리는 삭제 없이 archive로만.

## 빠른 시작 (Claude Code 네이티브)

Claude Code 세션에서 이렇게 말하면 됩니다:

> "github.com/<your>/open-saebyeok 를 클론해서 `install.sh` 를 실행해줘."

또는 수동으로:

```bash
git clone https://github.com/<your>/open-saebyeok ~/.claude/open-saebyeok
cd ~/.claude/open-saebyeok
./install.sh                  # ~/.claude 에 골격 배치 + 봇 의존성 설치 (기존 파일 보존)
cp .env.example .env          # 채널 토큰 입력
cd bot && ./run.sh
```

전제: `claude` CLI 가 설치돼 있고 **구독(Max/Pro) OAuth 로 로그인**돼 있어야 합니다.

## 첫 실행 — 이름 온보딩

메신저로 첫 메시지를 보내면, 에이전트가 **가장 먼저 "저를 뭐라고 부를까요?"** 라고 물어봅니다.
이름(과 가벼운 성격 한두 가지)을 답하면 `identity/SOUL.md` 를 채우고, 그때부터 그 인격으로 동작합니다.
이름 대신 다른 걸 먼저 물어봐도 됩니다 — 답한 뒤 자연스럽게 이름 얘기로 돌아옵니다.

## 채널 전환

`.env` 에서 한 줄:

```bash
CHANNEL=telegram   # 또는 slack
```

- **텔레그램**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **슬랙**: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`(Socket Mode), `SLACK_OWNER_ID` + `bun add @slack/bolt`

## 구조

```
open-saebyeok/
├─ install.sh            # ~/.claude 배치 + 인증 점검
├─ bot/
│  ├─ index.ts           # 채널 선택 + 온보딩 + 메시지 루프
│  ├─ claude.ts          # claude -p spawn (구독 OAuth, API키 차단) ★
│  ├─ channels/          # channel.ts(인터페이스) + telegram.ts + slack.ts
│  └─ run.sh             # 재시작 래퍼
├─ identity/             # SOUL/IDENTITY/CLAUDE .template + BOOTSTRAP.md
├─ memory/               # active / semantic / archive (빈 구조)
└─ HEARTBEAT.template.md # 자율 루틴 (선택)
```

## 비용 — 한 줄

`claude -p` 는 구독 OAuth 로 인증되면 **구독 quota 안에서** 돕니다. `ANTHROPIC_API_KEY` 가 환경에 있으면 그게 우선해 **종량제로 과금**되므로, 봇은 spawn 시 자동으로 제거합니다.

## Hermes 5기둥 대비

| 기둥 | open-saebyeok |
|---|---|
| **Soul** (정체성) | ✅ SOUL 템플릿 + 첫 실행 이름 온보딩 |
| **Memory** (기억) | ✅ 마크다운 3계층 (active/semantic/archive) |
| **Crons** (자율 루틴) | ✅ 하트비트 (기본 OFF, `HEARTBEAT_CRON`) |
| **Skills** (스킬 자동화) | ✅ 승인 게이트 (`pending` → 사용자 승인 → `active`) |
| **Self-improvement** | ✅ Curator (오래된 기억·스킬을 비파괴 archive) |

**차별점:** Hermes는 자동으로 쌓여 drift(검증 안 된 자기개선) 위험이 있습니다. open-saebyeok은 **승인 게이트 + 비파괴 정리**로 *"compounding하되 폭주하지 않게"* 만듭니다.

## 로드맵

- [ ] 슬랙 어댑터 실사용 검증 (e2e)
- [ ] 음성(STT/TTS)·이미지 첨부
- [ ] 스킬 사용 telemetry 기반 Curator (현재는 파일 수정시각 기준)

## 라이선스

MIT

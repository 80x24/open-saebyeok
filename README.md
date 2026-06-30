# nuanua

**메신저로 대화하는, 이름을 가진 나만의 AI 친구.**
텔레그램이나 슬랙으로 말을 걸면 답해주고, 나를 기억하고, 시키지 않아도 알아서 챙겨줘요.

> 🔧 이름 **nuanua**(누아누아)는 마오리·하와이어로 *무지개*입니다. 새벽네시(saebyeoknesi) 시스템에서 갈라져 나온 오픈소스로, AI의 정체성·기억·메신저 연결을 무거운 데이터베이스 없이 글(마크다운) 파일과 Claude 구독만으로 굴립니다.

---

## 뭐가 좋아요?

**💸 돈이 (거의) 안 들어요**
이미 내고 있는 Claude 구독료 말고는 추가 요금이 없어요. 보통 이런 AI 봇은 쓸수록 사용료가 붙는데, 이건 구독 안에서 돌아가요.

> 🔧 `claude -p`(파이프 모드)를 구독 인증(OAuth)으로 돌려 **구독 할당량 안에서** 동작합니다. 종량제 API 키(`ANTHROPIC_API_KEY`)가 환경에 있으면 그쪽으로 과금되므로, 봇이 실행 시 자동으로 차단합니다.

**🧠 나를 기억해요**
대화가 끊겨도 어제 한 얘기를 잊지 않아요. 중요한 건 글로 적어두고 다시 읽거든요.

> 🔧 `memory/` 폴더의 마크다운 3계층(active·semantic·archive)으로 맥락을 유지합니다.

**🪪 이름과 성격이 있어요**
설치하면 가장 먼저 "저를 뭐라고 부를까요?"라고 물어봐요. 이름과 성격을 정하면 그 모습으로 쭉 함께해요.

> 🔧 정체성은 `identity/SOUL.md` 가 정의하며, 첫 실행 시 부트스트랩으로 채워집니다.

**🌱 스스로 도와요 (단, 안전하게)**
시간이 지나며 더 똑똑해지고, 반복되는 일을 스스로 정리해요. 다만 *함부로*는 안 해요 — 새 기능은 **내가 허락해야** 켜지고, 정리할 때도 지우지 않고 **보관만** 해요.

> 🔧 하트비트(주기 실행)·스킬(승인 게이트)·Curator(비파괴 archive). Hermes의 self-improving을 따르되, 검증 없는 자기개선(drift)을 승인 구조로 막습니다.

---

## 시작하기

**준비물은 딱 하나예요 — Claude Code.**
(Claude Pro나 Max 구독으로 로그인돼 있으면 돼요.)

> 🔧 Claude Code 설치 (macOS / Linux):
> ```bash
> curl -fsSL https://claude.ai/install.sh | bash    # 또는: brew install --cask claude-code
> claude                                             # 첫 실행 → 브라우저에서 구독 로그인
> ```
> 가이드: [Claude Code 빠른 시작](https://code.claude.com/docs/en/quickstart.md) · [설치 문제 해결](https://code.claude.com/docs/en/troubleshoot-install.md)

준비됐으면, **Claude Code를 열고 이렇게 말하세요:**

> 💬 "github.com/80x24/nuanua 설치해줘"

그러면 알아서 다 받아서 설치해요. 봇이 돌아가는 데 필요한 다른 프로그램도 **알아서 깔아주니** 신경 쓸 게 없어요.

> 🔧 직접 설치하려면:
> ```bash
> git clone https://github.com/80x24/nuanua ~/nuanua
> cd ~/nuanua && ./install.sh
> ```
> Bun 런타임이 없으면 `install.sh` 가 자동으로 설치합니다.

---

## 첫 대화 — 설정도 말로 끝나요

설치한 뒤 Claude Code에 **"설정 시작"**이라고 하면, 끝까지 대화로 안내해줘요:

1. **어디서 대화할지** — 텔레그램과 슬랙 중에 골라요. 연결에 필요한 "키" 받는 법도 하나씩 알려줘요.
2. **봇 켜기** — 준비되면 봇을 띄워요.
3. **이름 짓기** — 메신저로 첫 메시지를 보내면, 가장 먼저 "저를 뭐라고 부를까요?"라고 물어봐요.

어려운 용어가 나와도 걱정 마세요 — 막히면 그 자리에서 도와줘요. 이름 대신 딴 걸 먼저 물어봐도 되고요.

> 🔧 위자드 순서: `identity/SETUP.md`(채널·토큰) → `identity/BOOTSTRAP.md`(이름). 토큰은 `bot/.env` 에 기록됩니다.

---

## 봇에게 할 수 있는 말

평소엔 그냥 편하게 대화하면 돼요. **명령은 슬래시로도, 자연어로도** 됩니다 (예: `/clear` = "기억 지워줘"):

- `/clear` — 대화 기억 비우기 ("기억 지워줘", "새로 시작")
- `/status` — 지금 세션 id·상태 보기 ("무슨 세션이야?") — 응답 상단의 `#세션id`로도 항상 표시돼요
- `/resume <id>` — 다른 세션으로 전환 ("그 세션으로 돌아가줘")
- `/compact` — 대화 압축 (맥락 유지하며 길이 줄이기)
- `/restart` — 봇 다시 시작 ("재시작해줘")
- `/cancel` — 답하는 도중 멈추기
- `/skill list` — 봇이 배운 기능 목록

> 🔧 자연어 명령은 봇이 응답에 `[[do:...]]` 디렉티브를 넣어 실행합니다(`identity/CLAUDE.md` 규약). "최신으로 업데이트해줘" 하면 `scripts/upgrade.sh` 를 돌리고 재시작까지 해요. · `/skill approve|reject <이름>` — 제안 스킬 승인/거절(거절=archive).

## 대화 장소 바꾸기 (텔레그램 ↔ 슬랙)

봇에게 **`/restart`** 라고 하면 바뀐 설정이 적용돼요.

> 🔧 `bot/.env` 의 `CHANNEL=telegram|slack` 한 줄을 바꾸고 재시작(봇 시작 시 1회 읽음).
> - 텔레그램: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
> - 슬랙: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`(Socket Mode), `SLACK_OWNER_ID` (+ `bun add @slack/bolt`)

---

# 기술적인 이야기 (안 읽어도 돼요)

여기부터는 개발자를 위한 내용이에요.

### 폴더 구조

```
nuanua/                    # 코드·지침 (THE RULE — git 으로 버전업)
├─ install.sh            # 설치 진입점 (~/.nuanua 배치 + 인증 점검 + bun)
├─ lib.sh                # 공통 이름·경로 파생 (SSOT — 모든 스크립트가 source)
├─ scripts/              # 보조: upgrade · migrate · setup-relay · install-daemon · setup-cli
├─ Dockerfile · fly.toml # relay 배포 골격 (외부 상시 서버)
├─ bot/
│  ├─ index.ts           # MODE 분기(standalone/worker/relay) + 버전체크 + 메시지 루프
│  ├─ config.ts          # 이름·데이터경로 단일 출처 (APP_NAME / DATA_DIR) ★
│  ├─ claude.ts          # claude -p spawn (cwd=~/.nuanua, SYSTEM.md 주입, OAuth) ★
│  ├─ relay.ts · version.ts · media.ts
│  ├─ channels/          # channel(인터페이스) + telegram · slack · redis(worker) + owner
│  ├─ heartbeat · skills · curator · bootstrap · handler
│  └─ run.sh             # 재시작 래퍼
├─ identity/             # SYSTEM.md(번들 코어 프롬프트) + SOUL/IDENTITY/CLAUDE .template + SETUP + BOOTSTRAP
├─ memory/ · skills/     # 빈 구조 (실데이터는 ~/.nuanua)
└─ HEARTBEAT.template.md
```

### 실행 모드

- **standalone** (기본): 이 컴퓨터에서 메신저 입구+처리 모두.
- **relay + worker**: 외출 중 노트북을 꺼도 작동. 외부 상시 서버(relay)가 메신저를 받고, 로컬(worker)이 켜져 있으면 위임 / 꺼져 있으면 "나중에 처리"(켜지면 이어서 답). `MODE` 환경변수로 전환하며 **코어 코드는 동일**. Redis 큐로 연결. **설정: `bash scripts/setup-relay.sh` 위자드**(worker 자동전환 + 배포 안내), 배포 골격: `Dockerfile`/`fly.toml`.

### 3계층 구조 (무결성·단순성)

| 위치 | 무엇 | 성격 |
|---|---|---|
| **`nuanua` repo** (이 폴더) | 코드·지침·`SYSTEM.md` = THE RULE | git 으로 버전업, 무결 |
| **`~/.nuanua`** | 정체성·기억·`USER.md`·세션 = 데이터 | 보존(업그레이드 무관), 백업=git |
| **`~/.claude`** | Claude Code 인증 | 순수 유지(공유) |

- **업그레이드**: `scripts/upgrade.sh` 는 repo 코드만 갱신하고 `~/.nuanua` 데이터는 보존. (구버전 `~/.claude` 설치는 `scripts/migrate.sh` 로 비파괴 이전)
- **정체성 전파**: 번들 `identity/SYSTEM.md` 를 `--append-system-prompt` 로 주입 → `git pull` 로 모든 봇에 반영 (`CLAUDE.md` 는 사용자 커스텀만, 보존)
- **CLI opt-in**: 터미널 `claude` 에서도 nuanua 데이터를 참조하려면 `bash scripts/setup-cli.sh on` (`~/.claude/CLAUDE.md` 에 참조 블록 추가, `off` 로 제거). 봇은 영향 없음
- **데이터 백업/영속**: `cd ~/.nuanua && git init` 으로 정체성·기억을 버전관리 (세션·로그는 gitignore)

### Hermes 5기둥 대비

| 기둥 | nuanua | 쓰기(축적) | 꺼내쓰기(retrieval) |
|---|---|---|---|
| **Soul** (정체성) | SOUL/IDENTITY/USER 템플릿 + 이름 온보딩 | ✅ | ✅ 매 세션 **시스템 프롬프트 주입**(frozen prefix, 캐시 보존) |
| **Memory** (기억) | 마크다운 3계층 (active/semantic/archive) | ✅ 자동 기록("기억해줘" 불필요) | ✅ `memory.sh search` 회상(archive 포함) |
| **Crons** (자율 루틴) | 하트비트 (기본 ON, 매 2시간, `HEARTBEAT_CRON`) | — | ✅ **격리 세션**(대화 맥락 미오염) |
| **Skills** (스킬 자동화) | 승인 게이트 (`pending` → 승인 → `active`) | ✅ 에이전트 초안 | ✅ **활성 스킬 인덱스 자동 주입**(progressive disclosure) |
| **Self-improvement** | 비파괴 Curator + 위 retrieval 루프 | ✅ | ✅ 주입+검색+인덱스로 **compounding 완결** |

> 🔧 **쓰기뿐 아니라 꺼내쓰기까지**: 정체성·사용자모델·활성 스킬을 매 세션 시스템 프롬프트에 주입하고(Hermes "frozen slot #1"), 기억은 `scripts/memory.sh search` 로 회상합니다(archive 무덤까지). 자율 루틴은 격리 세션에서 돌아 대화를 오염시키지 않습니다.

**차별점:** Hermes는 자동으로 쌓여 drift(검증 안 된 자기개선) 위험이 있습니다. nuanua은 **승인 게이트 + 비파괴 정리**로 *"compounding하되 폭주하지 않게"* 만듭니다. (Hermes·OpenClaw 가 종량제 API 인 반면 nuanua 은 구독 OAuth 로 추가 비용 0.)

### 보안

소유자(`TELEGRAM_CHAT_ID` / `SLACK_OWNER_ID`)가 설정되지 않으면 **아무 메시지도 처리하지 않습니다(fail-closed)**. 첫 접촉자에게는 본인 id를 안내해 `.env` 에 넣도록 합니다. (봇은 `--dangerously-skip-permissions` 로 claude 를 띄우므로 소유자 게이트가 중요)

### 로드맵

- [x] 텍스트·답장·이미지·파일 입력 · dual interface · 세션 관리 · 버전 체크 · 자동시작 데몬 · CLI opt-in
- [ ] 슬랙 어댑터 실사용 검증 (e2e)
- [ ] 음성(STT/TTS) — 옵셔널(무거운 백엔드라 별도 설치)
- [ ] 스킬 사용 telemetry 기반 Curator (현재는 파일 수정시각 기준)

## 라이선스

MIT

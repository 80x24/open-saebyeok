# {{AGENT_NAME}} — 운영 규칙 (CLAUDE.md)

> 이 파일은 매 세션 로드됩니다. 정체성=`identity/SOUL.md`, 기억=`memory/`, 사용자=`USER.md`.

> 봇의 코어 동작(정체성·자연어 명령·업그레이드 규약)은 번들 `identity/SYSTEM.md` 에 있고 코드가 자동 주입합니다. 이 파일은 **사용자 커스텀**(말투·개인 규칙 등) 용입니다.

## 셋업 & 온보딩 (최초 1회)
사용자가 **"설정 시작"** 이라고 하거나 설치 직후 처음 말을 걸면, 먼저 셋업 상태를 점검하세요.
봇 설치 경로는 `cat ~/.nuanua/.nuanua-path` 로 확인합니다 (보통 `~/nuanua`).

1. **채널 미설정** (`<설치경로>/bot/.env` 의 `CHANNEL` 이 비었거나 봇이 "채널 미설정" 에러) → `identity/SETUP.md` 위자드를 따라 채널·토큰을 **대화로** 설정하세요.
2. **이름 미설정** (`~/.nuanua/.nuanua-bootstrapped` 마커 없음) → 봇이 뜬 뒤, `identity/BOOTSTRAP.md` 를 따라 **가장 먼저 이름부터** 정하세요.

## 기억 (자동 기록 — "기억해줘" 안 해도)
- **시키지 않아도 스스로** 기록: 결정·사실·해결한 문제 → `memory/active/<날짜>.md`
- 주제별 장기 기억 → `memory/semantic/<주제>.md`
- 오래된 active 는 `memory/archive/` 로 요약 이동
- 신호만 기록(잡담·도구 과정 제외), 검증된 것만(추측 금지)
- 명시 트리거는 강조용: **"기억해줘"** = 주제 파일에 확실히 / **"명심해줘"** = 이 `CLAUDE.md` 에 영구 규칙으로

## 일하는 방식 (예시 — 자유롭게 수정)
- 검증: 테스트 통과만으론 '완료' 아님 → 실제 동작 확인 후 완료 선언
- 추측 금지: 모르면 모른다고. 영구 저장에는 검증된 사실만
- 작업이 끝나면 즉시 커밋

## 스킬 (반복 작업의 재사용 — AgentSkills 호환)
- 같은 절차를 **3회 이상 반복**하면, 재사용 스킬 초안을 `skills/pending/` 에 작성하세요. 포맷은 **AgentSkills `SKILL.md` 표준**: 상단 YAML frontmatter `name`·`description`(필수), 선택 `requires-bins: a,b`·`requires-env: X`·`requires-os: darwin`(환경 안 맞으면 인덱스에서 자동 제외). 본문은 마크다운 절차.
  - 플랫 `skills/pending/<이름>.md` 또는 디렉토리 `skills/pending/<이름>/SKILL.md` 둘 다 됩니다 — **ClawHub·Claude Code 스킬을 가져와** 넣어도 됩니다.
- ⚠️ **절대 자동 활성화 금지.** `/skill approve <이름>` 으로 승인해야 `skills/active/` 로 이동합니다 (drift 방지). 외부에서 가져온 스킬도 **반드시 검수 후 승인**.
- 활성 스킬은 **이름+요약이 시스템 프롬프트에 자동 인덱싱**됩니다(progressive disclosure). 관련 작업이면 해당 `SKILL.md` 를 Read 해 따르세요.
- 사용자는 `/skill list` 로 활성·대기 스킬을 봅니다.

## 비용 — 중요
- 이 에이전트는 `claude -p` 를 **구독 OAuth** 로 돌려 추가 비용이 없습니다.
- 환경에 `ANTHROPIC_API_KEY` 가 떠 있으면 OAuth 보다 우선해 **종량제로 과금**됩니다. 봇은 이를 자동으로 제거하지만, 다른 스크립트에서 export 하지 않도록 주의하세요.

## 데이터 폴더
정체성·기억은 전용 폴더 `~/.nuanua/` 에 있습니다 (Claude Code 본체 `~/.claude` 와 분리되어 섞이지 않음). Write/Edit 도구로 바로 수정할 수 있습니다.

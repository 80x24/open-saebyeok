// 프로젝트 정체성 — 단일 출처(Single Source of Truth)
//
// 리네이밍 보험: 이름을 코드 곳곳에 박지 않고 여기 한 곳에서만 정의한다.
// 이름이 확정되면 APP_NAME 한 줄만 바꾸고, 데이터 폴더는 migrate 스크립트로 옮기면 끝.

import { homedir } from 'os'
import { join } from 'path'

// 프로젝트 이름 (잠정값 — 확정 시 이 한 줄만 교체).
// env APP_NAME 으로 런타임 override 가능.
export const APP_NAME = process.env.APP_NAME || 'nuanua'

// 데이터 홈 (정체성·기억·세션 마커가 사는 곳). 우선순위:
//   1) AGENT_HOME   — 명시적 지정. 이름과 무관한 키라 리네이밍해도 안 건드려도 됨
//   2) CLAUDE_HOME  — 레거시 호환 (기존 ~/.claude 사용자 보호)
//   3) ~/.${APP_NAME} — 신규 기본: Claude Code 본체(~/.claude)와 섞이지 않는 전용 폴더
export const DATA_DIR =
  process.env.AGENT_HOME ||
  process.env.CLAUDE_HOME ||
  join(homedir(), `.${APP_NAME}`)

// 이름에서 파생되는 마커 파일 경로 (하드코딩 금지)
export const bootstrapMarker = join(DATA_DIR, `.${APP_NAME}-bootstrapped`)
export const pathMarker = join(DATA_DIR, `.${APP_NAME}-path`)

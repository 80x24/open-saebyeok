// GFM(클로드 출력) → 텔레그램 HTML 변환.
// 핵심: "닫힌 쌍"만 태그로 바꾼다 → 출력 HTML 은 항상 균형 잡혀 전송 실패(parse entities)가 안 난다.
// 텔레그램 미지원(헤딩·표)은 평문/굵게로 격하. 스트리밍 중 덜 닫힌 마크는 그냥 글자로 남는다.

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const NUL = String.fromCharCode(0) // 코드 보호용 플레이스홀더 경계 (일반 텍스트엔 없는 NUL 문자)

export function toTelegramHtml(src: string): string {
  let s = escapeHtml(src)

  // 코드(펜스/인라인)는 먼저 빼내 플레이스홀더로 보호 — 내부는 마크다운 처리 안 함
  const slots: string[] = []
  const stash = (html: string) => { slots.push(html); return `${NUL}${slots.length - 1}${NUL}` }

  // ```lang\n ... ``` → <pre>
  s = s.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code) => stash(`<pre>${code.replace(/\n$/, '')}</pre>`))
  // `code` → <code>
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => stash(`<code>${code}</code>`))

  // 링크 [text](url)
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`)

  // 헤딩 #..###### → 굵게 한 줄
  s = s.replace(/^#{1,6}[ \t]+(.+)$/gm, '<b>$1</b>')

  // 굵게 **x** / 취소선 ~~x~~ / 기울임 *x* · _x_ (닫힌 쌍만)
  s = s.replace(/\*\*([^\n*]+?)\*\*/g, '<b>$1</b>')
  s = s.replace(/~~([^\n~]+?)~~/g, '<s>$1</s>')
  s = s.replace(/(^|[\s(])\*([^\n*]+?)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
  s = s.replace(/(^|[\s(])_([^\n_]+?)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>')

  // 리스트 마커 정돈: "- " / "* " → "• "
  s = s.replace(/^[ \t]*[-*][ \t]+/gm, '• ')

  // 플레이스홀더 복원
  s = s.replace(new RegExp(`${NUL}(\\d+)${NUL}`, 'g'), (_m, i) => slots[Number(i)] ?? '')
  return s
}

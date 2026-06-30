import { test, expect, describe } from 'bun:test'
import { toTelegramHtml } from '../channels/tg-format'

describe('toTelegramHtml — GFM → 텔레그램 HTML', () => {
  test('굵게/기울임/취소선', () => {
    expect(toTelegramHtml('**굵게**')).toBe('<b>굵게</b>')
    expect(toTelegramHtml('앞 *기울임* 뒤')).toBe('앞 <i>기울임</i> 뒤')
    expect(toTelegramHtml('~~취소~~')).toBe('<s>취소</s>')
  })

  test('인라인 코드/펜스 — 내부 마크다운·HTML 보호', () => {
    expect(toTelegramHtml('`a < b & c`')).toBe('<code>a &lt; b &amp; c</code>')
    expect(toTelegramHtml('```js\n1 < 2\n```')).toBe('<pre>1 &lt; 2</pre>')
    expect(toTelegramHtml('`**not bold**`')).toBe('<code>**not bold**</code>')
  })

  test('헤딩 → 굵게, HTML 이스케이프', () => {
    expect(toTelegramHtml('## 제목')).toBe('<b>제목</b>')
    expect(toTelegramHtml('<태그> & 기호')).toBe('&lt;태그&gt; &amp; 기호')
  })

  test('리스트 마커 → 불릿', () => {
    expect(toTelegramHtml('- 하나\n* 둘')).toBe('• 하나\n• 둘')
  })

  test('링크', () => {
    expect(toTelegramHtml('[g](https://g.com)')).toBe('<a href="https://g.com">g</a>')
  })

  test('일반 숫자는 건드리지 않음 (플레이스홀더 충돌 없음)', () => {
    expect(toTelegramHtml('사과 5 개를 5 시에 `code` 와 함께'))
      .toBe('사과 5 개를 5 시에 <code>code</code> 와 함께')
  })

  test('안 닫힌 마크는 글자로 남아 유효 HTML 유지 (스트리밍 중)', () => {
    expect(toTelegramHtml('진행 중 **굵게...')).toBe('진행 중 **굵게...')
  })
})

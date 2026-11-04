import { describe, expect, it } from 'vitest'
import { cookedText, decodeEscapes, decodeJsxEntities, jsxParserValue, rawText } from '../src/transform/escapes'

const bs = '\\'

describe('decodeEscapes', () => {
  it.each([
    ['plain text', 'p-4 flex', 'p-4 flex'],
    ['quotes', `content-[${bs}"x${bs}"] it${bs}'s`, `content-["x"] it's`],
    ['backslash', `a${bs}${bs}b`, `a${bs}b`],
    ['simple escapes', `${bs}n${bs}t${bs}r`, '\n\t\r'],
    ['hex', `${bs}x41`, 'A'],
    ['unicode', `${bs}u0066${bs}u{1F600}`, `f${String.fromCodePoint(0x1F600)}`],
    ['null', `${bs}0`, '\0'],
    ['template escapes', `${bs}\`${bs}$\{x}`, '`$' + '{x}'],
  ])('%s', (_, raw, cooked) => {
    const units = decodeEscapes(raw)!
    expect(cookedText(units)).toBe(cooked)
    expect(rawText(units)).toBe(raw)
  })

  it.each([
    ['line continuation', `a${bs}\nb`],
    ['legacy octal', `${bs}01`],
    ['\\8', `${bs}8`],
    ['trailing backslash', `a${bs}`],
    ['bad hex', `${bs}xZ1`],
    ['bad unicode', `${bs}u{110000}`],
  ])('rejects %s', (_, raw) => {
    expect(decodeEscapes(raw)).toBeUndefined()
  })
})

describe('decodeJsxEntities', () => {
  it('decodes common and numeric entities', () => {
    const units = decodeJsxEntities('&quot;&apos;&amp;&lt;&gt; &#x41;&#66; a\\b')!
    expect(cookedText(units)).toBe('"\'&<> AB a\\b')
    // Prettier's parsers decode numeric entities only
    expect(jsxParserValue(units)).toBe('&quot;&apos;&amp;&lt;&gt; AB a\\b')
  })

  it('keeps a bare ampersand', () => {
    const raw = '[&>svg]:size-4 a & b &amp_x &a-b;'
    const units = decodeJsxEntities(raw)!
    expect(cookedText(units)).toBe(raw)
    expect(jsxParserValue(units)).toBe(raw)
  })

  it.each([
    ['unknown entity', '&nbsp;'],
    ['malformed numeric entity', '&#x;'],
  ])('rejects %s', (_, raw) => {
    expect(decodeJsxEntities(raw)).toBeUndefined()
  })
})

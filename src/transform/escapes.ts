import type { UnoGenerator } from '@unocss/core'
import { sortPreservingEdges } from '../sort'

/**
 * One piece of source text and the value it stands for: a plain character
 * (`a` → `a`) or an escape (`\"` → `"`, `&quot;` → `"`).
 */
export interface Unit {
  raw: string
  cooked: string
}

/** New source text (without quotes) and value of a sorted string. */
export interface SortedText {
  raw: string
  cooked: string
}

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
}

const LINE_TERMINATORS = new Set(['\n', '\r', '\u2028', '\u2029'])

// Whitespace that separates classes in the `class` attribute (ASCII whitespace
// in the HTML spec). Escaped (`\n`, `\t`) or not, it becomes a single space.
const HTML_WHITESPACE = /^[ \t\n\f\r]+$/

const JSX_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: '\'',
  amp: '&',
  lt: '<',
  gt: '>',
}

/** Text without escapes: every character stands for itself. */
export function plainUnits(text: string): Unit[] {
  return Array.from(text, ch => ({ raw: ch, cooked: ch }))
}

export function cookedText(units: readonly Unit[]): string {
  return units.map(unit => unit.cooked).join('')
}

export function rawText(units: readonly Unit[]): string {
  return units.map(unit => unit.raw).join('')
}

/**
 * Splits the source text of a JS string literal (without quotes) or of a
 * template chunk into units, decoding escapes. Returns `undefined` for
 * anything unusual: line continuations, legacy octal escapes, malformed
 * escapes.
 */
export function decodeEscapes(raw: string): Unit[] | undefined {
  const units: Unit[] = []
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]!
    if (ch !== '\\') {
      units.push({ raw: ch, cooked: ch })
      i++
      continue
    }

    const next = raw[i + 1]
    if (next === undefined || LINE_TERMINATORS.has(next) || /[1-9]/.test(next))
      return undefined
    let length = 2
    let cooked: string
    if (next === '0') {
      // `\0`, but not legacy octal `\01`
      if (/\d/.test(raw[i + 2] ?? ''))
        return undefined
      cooked = '\0'
    }
    else if (next === 'x') {
      const hex = /^[\da-f]{2}/i.exec(raw.slice(i + 2))?.[0]
      if (!hex)
        return undefined
      cooked = String.fromCharCode(Number.parseInt(hex, 16))
      length += hex.length
    }
    else if (next === 'u') {
      const match = /^(?:\{([\da-f]+)\}|([\da-f]{4}))/i.exec(raw.slice(i + 2))
      if (!match)
        return undefined
      const codePoint = Number.parseInt(match[1] ?? match[2]!, 16)
      if (codePoint > 0x10FFFF)
        return undefined
      cooked = String.fromCodePoint(codePoint)
      length += match[0].length
    }
    else {
      // `\n`, `\t`, …; any other escaped character stands for itself: `\"`, `\\`, `` \` ``
      cooked = SIMPLE_ESCAPES[next] ?? next
    }
    units.push({
      raw: raw.slice(i, i + length),
      cooked,
    })
    i += length
  }
  return units
}

/**
 * Splits the source text of a JSX attribute string (without quotes) into
 * units. JSX strings have no backslash escapes, only HTML entities; only the
 * common ones are decoded, anything else returns `undefined`.
 *
 * Units are decoded fully, as at runtime and as Prettier prints them
 * (`&quot;` → `"`), even though Prettier's parsers keep named entities in
 * `value`: see {@link jsxParserValue}.
 */
export function decodeJsxEntities(raw: string): Unit[] | undefined {
  const units: Unit[] = []
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]!
    // A bare `&` is just a character: `[&>svg]:size-4`
    if (ch !== '&' || !/^&(?:#|[a-z\d]+;)/i.test(raw.slice(i))) {
      units.push({ raw: ch, cooked: ch })
      i++
      continue
    }

    const match = /^&(?:#x([\da-f]+)|#(\d+)|([a-z]+));/i.exec(raw.slice(i))
    if (!match)
      return undefined
    let cooked: string | undefined
    if (match[1] ?? match[2]) {
      const codePoint = match[1]
        ? Number.parseInt(match[1], 16)
        : Number.parseInt(match[2]!, 10)
      if (codePoint > 0x10FFFF)
        return undefined
      cooked = String.fromCodePoint(codePoint)
    }
    else {
      cooked = JSX_ENTITIES[match[3]!]
    }
    if (cooked === undefined)
      return undefined
    units.push({ raw: match[0], cooked })
    i += match[0].length
  }
  return units
}

/**
 * The `value` Prettier's parsers give a JSX attribute string: numeric
 * entities decoded, named ones (`&quot;`) kept as written.
 */
export function jsxParserValue(units: readonly Unit[]): string {
  return units.map(unit => /^&[a-z]/i.test(unit.raw)
    ? unit.raw
    : unit.cooked).join('')
}

function isWhitespace(unit: Unit): boolean {
  return /^\s+$/.test(unit.cooked)
}

/**
 * Sorts the classes in `units` and spells the result in source text.
 *
 * Every whitespace-separated piece of the sorted value that is in the source
 * gets its original spelling back, escapes included (`content-[\"x\"]`). A
 * new piece (a variant group collapsed differently: `hover:(a b)`) is written
 * as is, unless it contains a character matching `unsafe` (a quote, a
 * backslash, …) that would need escaping.
 *
 * Whitespace between classes, line breaks and escapes (`\n`) included, is
 * collapsed to single spaces, like the ESLint rule does. Other whitespace
 * (`\u00A0`, `\v`) is part of a class for the browser: then the text is left
 * alone.
 *
 * `unsafe` must not depend on the quote character of the string: Prettier
 * may change it, and the next format must take the same decision.
 *
 * `trimLineBreaks`: drop whitespace at an edge that has a line break, instead
 * of keeping a single space. For strings, where it is only layout; template
 * chunks keep it, as it may separate classes from expressions.
 *
 * Returns `undefined` when nothing changes or when the result can't be spelled
 * safely: then the text is left alone.
 */
export async function sortUnits(units: readonly Unit[], uno: UnoGenerator, unsafe: RegExp, trimLineBreaks = false): Promise<SortedText | undefined> {
  // UnoCSS splits classes at any whitespace, the browser only at HTML
  // whitespace: in `p-4\u00A0flex` the browser sees one class
  if (units.some(unit => /\s/.test(unit.cooked) && !HTML_WHITESPACE.test(unit.cooked)))
    return undefined

  // Original spellings of the pieces, by value
  const spellings = new Map<string, string[]>()
  let piece: Unit[] = []
  const flush = (): void => {
    if (!piece.length)
      return
    const cooked = cookedText(piece)
    spellings.set(cooked, [
      ...spellings.get(cooked) ?? [],
      rawText(piece),
    ])
    piece = []
  }
  for (const unit of units) {
    if (isWhitespace(unit))
      flush()
    else
      piece.push(unit)
  }
  flush()

  const value = cookedText(units)
  let sorted = await sortPreservingEdges(value, uno)
  if (trimLineBreaks) {
    // `"\n  p-4\n  flex\n"` → `"flex p-4"`, not `" flex p-4 "`
    if (/^\s*[\n\r]/.test(value))
      sorted = sorted.trimStart()
    if (/[\n\r]\s*$/.test(value))
      sorted = sorted.trimEnd()
  }
  if (sorted === value)
    return undefined

  let raw = ''
  for (const part of sorted.split(/(\s+)/)) {
    const spelling = spellings.get(part)?.shift()
    if (spelling !== undefined)
      raw += spelling
    else if (unsafe.test(part))
      return undefined
    else
      raw += part
  }
  return { raw, cooked: sorted }
}

import type { UnoGenerator } from '@unocss/core'
import type { TemplateElementNode, TemplateLiteralNode } from './collect'
import type { SortedText, Unit } from './escapes'
import { cookedText, decodeEscapes, plainUnits, rawText, sortUnits } from './escapes'
import { setTemplateElementValue } from './rewrite'

// Characters a sorted piece must not bring into a template chunk unescaped
const TEMPLATE_UNSAFE = /[\\`\r]|\$\{/

export interface QuasiOptions {
  /** The chunk is glued to an expression on the left: `` `${x}-foo bar` ``. */
  gluedLeft?: boolean
  /** The chunk is glued to an expression on the right: `` `bar foo-${x}` ``. */
  gluedRight?: boolean
  /**
   * The template is `` String.raw`…` ``: its value is the raw text, so escapes
   * are not decoded and chunks with backslashes are left alone.
   */
  stringRaw?: boolean
}

function isWhitespace(unit: Unit): boolean {
  return /^\s+$/.test(unit.cooked)
}

/**
 * Sorts the classes in one template chunk. Returns its new raw and cooked
 * text, or `undefined` to leave it alone.
 *
 * Glued fragments at the edges stay in place; only whole classes in between
 * are sorted. Leading and trailing whitespace is kept, because it separates
 * classes from expressions.
 */
export async function sortQuasi(quasi: TemplateElementNode, uno: UnoGenerator, options: QuasiOptions = {}): Promise<SortedText | undefined> {
  const { raw, cooked } = quasi.value
  if (!raw.trim() || cooked == null)
    return undefined

  const units = options.stringRaw
    ? raw.includes('\\')
      ? undefined
      : plainUnits(raw)
    : decodeEscapes(raw)
  // Decoding must give exactly what the parser saw
  if (!units || cookedText(units) !== cooked)
    return undefined

  return sortChunk(units, uno, TEMPLATE_UNSAFE, options)
}

/**
 * Sorts the classes in a chunk of text between expressions: a template
 * chunk, or the text of a Svelte `class="… {x} …"`. Glued fragments at the
 * edges stay in place (`gluedLeft` / `gluedRight`); only whole classes in
 * between are sorted. Leading and trailing whitespace is kept.
 */
export async function sortChunk(units: readonly Unit[], uno: UnoGenerator, unsafe: RegExp, options: QuasiOptions = {}): Promise<SortedText | undefined> {
  let start = 0
  let end = units.length
  if (options.gluedLeft) {
    while (start < end && !isWhitespace(units[start]!))
      start++
  }
  if (options.gluedRight) {
    while (end > start && !isWhitespace(units[end - 1]!))
      end--
  }

  const sorted = await sortUnits(units.slice(start, end), uno, unsafe)
  if (!sorted)
    return undefined
  const head = units.slice(0, start)
  const tail = units.slice(end)
  return {
    raw: rawText(head) + sorted.raw + rawText(tail),
    cooked: cookedText(head) + sorted.cooked + cookedText(tail),
  }
}

/**
 * Sorts the classes in each chunk (quasi) of a template literal.
 *
 * A chunk may be glued to an expression: in `` `p-2 bg-${c}-500` `` the chunk
 * `p-2 bg-` ends with a partial class, which stays in place.
 */
export async function sortTemplateLiteral(node: TemplateLiteralNode, uno: UnoGenerator, stringRaw = false): Promise<void> {
  const last = node.quasis.length - 1

  for (const [i, quasi] of node.quasis.entries()) {
    const raw = quasi.value.raw
    const sorted = await sortQuasi(quasi, uno, {
      gluedLeft: i > 0 && !/^\s/.test(raw), // `${x}-foo bar`
      gluedRight: i < last && !/\s$/.test(raw), // `bar foo-${x}`
      stringRaw,
    })
    if (sorted)
      setTemplateElementValue(quasi, sorted)
  }
}

import type { StringLiteralNode, TemplateElementNode } from './collect'
import type { SortedText } from './escapes'

/** The source text of a string literal, quotes included. */
export function stringRaw(node: StringLiteralNode): string | undefined {
  const raw = node.extra?.raw ?? node.raw
  return typeof raw === 'string'
    ? raw
    : undefined
}

/**
 * Replaces the value of a string literal.
 *
 * Prettier prints string literals from their raw source text (to keep quotes
 * and escapes), so `value`, `raw` and Babel's `extra.raw` / `extra.rawValue`
 * are updated together, keeping the original quote character. `text.raw` is
 * the new source text between the quotes, already escaped.
 */
export function setStringValue(node: StringLiteralNode, text: SortedText): void {
  const raw = stringRaw(node)
  const quote = raw?.[0] === '\'' || raw?.[0] === '"'
    ? raw[0]
    : '"'
  const newRaw = quote + text.raw + quote

  node.value = text.cooked
  if (node.extra) {
    node.extra.raw = newRaw
    node.extra.rawValue = text.cooked
  }
  if ('raw' in node)
    node.raw = newRaw
}

/** Replaces the text of a template literal chunk. */
export function setTemplateElementValue(node: TemplateElementNode, text: SortedText): void {
  node.value.raw = text.raw
  node.value.cooked = text.cooked
}

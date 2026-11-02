import type { StringLiteralNode, TemplateElementNode } from './collect'

/**
 * Replaces the value of a string literal.
 *
 * Prettier prints string literals from their raw source text (to keep quotes
 * and escapes), so `value`, `raw` and Babel's `extra.raw` / `extra.rawValue`
 * are updated together, keeping the original quote character.
 *
 * Only safe for values without quotes and backslashes: they would need
 * escaping in the raw text.
 */
export function setStringValue(node: StringLiteralNode, value: string): void {
  const raw = node.extra?.raw ?? node.raw
  const quote = raw?.[0] === '\'' || raw?.[0] === '"'
    ? raw[0]
    : '"'
  const newRaw = quote + value + quote

  node.value = value
  if (node.extra) {
    node.extra.raw = newRaw
    node.extra.rawValue = value
  }
  if ('raw' in node)
    node.raw = newRaw
}

/**
 * Replaces the text of a template literal chunk. Only safe for text without
 * backslashes, where the raw and the cooked value are the same.
 */
export function setTemplateElementValue(node: TemplateElementNode, value: string): void {
  node.value.raw = value
  node.value.cooked = value
}

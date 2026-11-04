import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions, KeyGroup, StringLiteralNode, TemplateLiteralNode } from './collect'
import type { SortedText } from './escapes'
import { collectClassNodes, isStringLiteral } from './collect'
import { cookedText, decodeEscapes, decodeJsxEntities, jsxParserValue, sortUnits } from './escapes'
import { setStringValue, setTemplateElementValue, stringRaw } from './rewrite'
import { sortQuasi, sortTemplateLiteral } from './template'

export type { CollectOptions } from './collect'

// Characters a new piece must not bring into a string unescaped. Both quotes:
// Prettier may switch the quote character, see `sortUnits`.
const STRING_UNSAFE = /['"\\\n\r\u2028\u2029]/
const JSX_UNSAFE = /['"&]/

/** Sorts the classes in every class string of an ESTree/Babel AST, in place. */
export async function sortClassesInAst(ast: unknown, uno: UnoGenerator, options: CollectOptions): Promise<void> {
  const { strings, templates, keyGroups, jsxStrings, stringRawTemplates } = collectClassNodes(ast, options)

  for (const node of strings) {
    const sorted = await sortString(node, uno, jsxStrings.has(node))
    if (sorted)
      setStringValue(node, sorted)
  }

  for (const node of templates)
    await sortTemplateLiteral(node, uno, stringRawTemplates.has(node))

  for (const group of keyGroups)
    await sortKeyGroup(group, uno)
}

/**
 * Sorts a string literal, keeping its escapes: `"content-[\"x\"] p-4"`.
 * Returns `undefined` to leave it alone.
 *
 * `jsx`: a JSX attribute string (`className="…"`), which has HTML entities
 * instead of backslash escapes.
 */
async function sortString(node: StringLiteralNode, uno: UnoGenerator, jsx = false): Promise<SortedText | undefined> {
  const raw = stringRaw(node)
  const quote = raw?.[0]
  if (!raw || (quote !== '"' && quote !== '\'') || raw.at(-1) !== quote)
    return undefined

  const content = raw.slice(1, -1)
  const units = jsx
    ? decodeJsxEntities(content)
    : decodeEscapes(content)
  // Decoding must give exactly what the parser saw
  if (!units || (cookedText(units) !== node.value && !(jsx && jsxParserValue(units) === node.value)))
    return undefined

  return sortUnits(units, uno, jsx
    ? JSX_UNSAFE
    : STRING_UNSAFE, true)
}

function keyValue(node: StringLiteralNode | TemplateLiteralNode): string | null | undefined {
  return isStringLiteral(node)
    ? node.value
    : node.quasis[0]!.value.cooked
}

/**
 * Sorts the class keys of one object, unless that would make two keys equal:
 * in `clsx({ 'p-4 flex': a, 'flex p-4': b })` the later key would override
 * the earlier one and `a` would be lost.
 */
async function sortKeyGroup(group: KeyGroup, uno: UnoGenerator): Promise<void> {
  const sorted = await Promise.all(group.keys.map(node => isStringLiteral(node)
    ? sortString(node, uno)
    : sortQuasi(node.quasis[0]!, uno)))

  const before = new Set([
    ...group.names,
    ...group.keys.map(keyValue),
  ])
  const after = new Set([
    ...group.names,
    ...group.keys.map((node, i) => sorted[i]?.cooked ?? keyValue(node)),
  ])
  // Sorting maps names to names, so it can only merge them, never split
  if (after.size < before.size)
    return

  for (const [i, node] of group.keys.entries()) {
    const text = sorted[i]
    if (!text)
      continue
    if (isStringLiteral(node))
      setStringValue(node, text)
    else
      setTemplateElementValue(node.quasis[0]!, text)
  }
}

import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions, KeyGroup, StringLiteralNode, TemplateLiteralNode } from './collect'
import { sortPreservingEdges } from '../sort'
import { collectClassNodes, isStringLiteral } from './collect'
import { setStringValue, setTemplateElementValue } from './rewrite'
import { sortTemplateLiteral } from './template'

export type { CollectOptions } from './collect'

/** Sorts the classes in every class string of an ESTree/Babel AST, in place. */
export async function sortClassesInAst(ast: unknown, uno: UnoGenerator, options: CollectOptions): Promise<void> {
  const { strings, templates, keyGroups } = collectClassNodes(ast, options)

  for (const node of strings) {
    const sorted = await sortString(node, uno)
    if (sorted !== node.value)
      setStringValue(node, sorted)
  }

  for (const node of templates)
    await sortTemplateLiteral(node, uno)

  for (const group of keyGroups)
    await sortKeyGroup(group, uno)
}

async function sortString(node: StringLiteralNode, uno: UnoGenerator): Promise<string> {
  // Quotes or escapes inside: skip rather than risk breaking the string
  if (/['"\\]/.test(node.value))
    return node.value
  return sortPreservingEdges(node.value, uno)
}

/** A template without expressions, like `` [`p-4 flex`]: on ``. */
async function sortSimpleTemplate(node: TemplateLiteralNode, uno: UnoGenerator): Promise<string> {
  const raw = node.quasis[0]!.value.raw
  // Escapes: raw and cooked differ, not worth the risk
  if (raw.includes('\\'))
    return raw
  return sortPreservingEdges(raw, uno)
}

function keyValue(node: StringLiteralNode | TemplateLiteralNode): string {
  return isStringLiteral(node)
    ? node.value
    : node.quasis[0]!.value.raw
}

/**
 * Sorts the class keys of one object, unless that would make two keys equal:
 * in `clsx({ 'p-4 flex': a, 'flex p-4': b })` the later key would override
 * the earlier one and `a` would be lost.
 */
async function sortKeyGroup(group: KeyGroup, uno: UnoGenerator): Promise<void> {
  const sorted = await Promise.all(group.keys.map(node => isStringLiteral(node)
    ? sortString(node, uno)
    : sortSimpleTemplate(node, uno)))

  const before = new Set([
    ...group.names,
    ...group.keys.map(keyValue),
  ])
  const after = new Set([
    ...group.names,
    ...sorted,
  ])
  // Sorting maps names to names, so it can only merge them, never split
  if (after.size < before.size)
    return

  for (const [i, node] of group.keys.entries()) {
    const value = sorted[i]!
    if (value === keyValue(node))
      continue
    if (isStringLiteral(node))
      setStringValue(node, value)
    else
      setTemplateElementValue(node.quasis[0]!, value)
  }
}

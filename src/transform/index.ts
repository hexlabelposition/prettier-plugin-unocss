import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions } from './collect'
import { sortPreservingEdges } from '../sort'
import { collectClassNodes } from './collect'
import { setStringValue } from './rewrite'
import { sortTemplateLiteral } from './template'

export type { CollectOptions } from './collect'

/** Sorts the classes in every class string of an ESTree/Babel AST, in place. */
export async function sortClassesInAst(ast: unknown, uno: UnoGenerator, options: CollectOptions): Promise<void> {
  const { strings, templates } = collectClassNodes(ast, options)

  for (const node of strings) {
    // Quotes or escapes inside: skip rather than risk breaking the string
    if (/['"\\]/.test(node.value))
      continue
    const sorted = await sortPreservingEdges(node.value, uno)
    if (sorted !== node.value)
      setStringValue(node, sorted)
  }

  for (const node of templates)
    await sortTemplateLiteral(node, uno)
}

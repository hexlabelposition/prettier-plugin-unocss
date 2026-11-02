import type { UnoGenerator } from '@unocss/core'
import type { TemplateLiteralNode } from './collect'
import { sortPreservingEdges } from '../sort'
import { setTemplateElementValue } from './rewrite'

/**
 * Sorts the classes in each chunk (quasi) of a template literal.
 *
 * A chunk may be glued to an expression: in `` `p-2 bg-${c}-500` `` the chunk
 * `p-2 bg-` ends with a partial class. Glued fragments at the edges of a chunk
 * stay in place; only whole classes in between are sorted. Leading and
 * trailing whitespace is kept, because it separates classes from expressions.
 */
export async function sortTemplateLiteral(node: TemplateLiteralNode, uno: UnoGenerator): Promise<void> {
  const last = node.quasis.length - 1

  for (const [i, quasi] of node.quasis.entries()) {
    const raw = quasi.value.raw
    if (!raw.trim())
      continue

    const gluedLeft = i > 0 && !/^\s/.test(raw) // `${x}-foo bar`
    const gluedRight = i < last && !/\s$/.test(raw) // `bar foo-${x}`

    let head = ''
    let tail = ''
    let body = raw
    if (gluedLeft) {
      head = /^\S+/.exec(body)?.[0] ?? ''
      body = body.slice(head.length)
    }
    if (gluedRight) {
      tail = /\S+$/.exec(body)?.[0] ?? ''
      body = body.slice(0, body.length - tail.length)
    }

    // Escapes: raw and cooked differ, not worth the risk
    if (body.includes('\\'))
      continue

    const sorted = head + await sortPreservingEdges(body, uno) + tail
    if (sorted !== raw)
      setTemplateElementValue(quasi, sorted)
  }
}

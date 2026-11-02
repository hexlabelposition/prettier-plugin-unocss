/**
 * A node of a Babel or ESTree (typescript-estree, acorn, …) AST. Only the
 * fields the transform reads are typed; everything else is `unknown`.
 */
export interface AstNode {
  type: string
  [key: string]: unknown
}

/** Return `false` to skip the children of the visited node. */
export type Visitor = (node: AstNode) => boolean | void

// Metadata, not child nodes. `extra` holds Babel's raw text, `parent` would loop.
const SKIP_KEYS = new Set([
  'loc',
  'range',
  'start',
  'end',
  'tokens',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'extra',
  'parent',
])

export function isNode(value: unknown): value is AstNode {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { type?: unknown }).type === 'string'
}

/** Depth-first walk over every node reachable from `root` (a node or an array). */
export function walk(root: unknown, visit: Visitor): void {
  if (!root || typeof root !== 'object')
    return
  if (Array.isArray(root)) {
    for (const child of root)
      walk(child, visit)
    return
  }
  if (isNode(root) && visit(root) === false)
    return
  for (const [key, child] of Object.entries(root)) {
    if (!SKIP_KEYS.has(key))
      walk(child, visit)
  }
}

import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions, CollectRoot } from './collect'
import type { SortedText } from './escapes'
import type { TextEdit } from './index'
import type { AstNode } from './walk'
import { collectClassNodes } from './collect'
import { cookedText, decodeJsxEntities, sortUnits } from './escapes'
import { classNodeEdits } from './index'
import { sortChunk } from './template'
import { isNode, walk } from './walk'

// Characters a new piece must not bring into attribute text unescaped:
// quotes and `&` as in HTML, and braces, which start an expression
const SVELTE_UNSAFE = /['"&{}]/

/** Svelte AST nodes start and end at these offsets of the source text. */
const locator = {
  locStart: (node: AstNode) => node.start as number,
  locEnd: (node: AstNode) => node.end as number,
}

interface TextNode extends AstNode {
  type: 'Text'
  raw: string
  data: string
  start: number
  end: number
}

function isText(node: unknown): node is TextNode {
  return isNode(node) && node.type === 'Text'
}

function isExpressionTag(node: unknown): node is AstNode & { expression: unknown } {
  return isNode(node) && node.type === 'ExpressionTag'
}

/**
 * Sorts the classes in a Svelte component (the modern AST of
 * `prettier-plugin-svelte` 4) and returns the changes as edits of `text`.
 * The Svelte printer prints expressions from the source text, not from the
 * AST, so the caller applies the edits and parses the result again.
 *
 * - `class="…"` (every name in `attributes`): the text parts are sorted, and
 *   expressions in it (`class="p-4 {on ? 'a b' : ''}"`) are class values when
 *   whitespace or the value's edge is on both sides, as in template literals.
 * - `class={…}`: a class value; object keys are classes too, as Svelte 5
 *   passes the value through `clsx`.
 * - `class:name={…}` directives are not sorted: the name is one class.
 * - Any other expression in the markup is searched for class contexts
 *   (`clsx(…)`, class variables in `{@const}`). `<script>` blocks are
 *   formatted with the JS parsers, which sort them.
 */
export async function svelteClassEdits(ast: unknown, text: string, uno: UnoGenerator, options: CollectOptions): Promise<TextEdit[]> {
  const fragment = isNode(ast) && ast.fragment
  // Not the modern AST (prettier-plugin-svelte 3): leave the file alone
  if (!isNode(fragment))
    return []

  const attributes = new Set(options.attributes)
  const edits: TextEdit[] = []
  const roots: [unknown, CollectRoot][] = []

  const classAttributes: AstNode[] = []
  walk(fragment, (node) => {
    if (node.type === 'Attribute' && typeof node.name === 'string' && attributes.has(node.name)) {
      classAttributes.push(node)
      return false
    }
    // The roots of class contexts; `collectClassNodes` searches inside them
    if (node.type === 'CallExpression' || node.type === 'TaggedTemplateExpression' || node.type === 'VariableDeclarator') {
      roots.push([node, 'program'])
      return false
    }
  })

  for (const attribute of classAttributes) {
    const value = attribute.value
    // class={…}
    if (isExpressionTag(value)) {
      roots.push([value.expression, 'class-value'])
      continue
    }
    if (!Array.isArray(value))
      continue
    const parts = value as unknown[]
    for (const [i, part] of parts.entries()) {
      const before = parts[i - 1]
      const after = parts[i + 1]
      if (isText(part)) {
        const sorted = await sortText(part, uno, parts.length === 1, {
          gluedLeft: isExpressionTag(before) && !/^\s/.test(part.raw),
          gluedRight: isExpressionTag(after) && !/\s$/.test(part.raw),
        })
        if (sorted)
          edits.push({ start: part.start, end: part.end, raw: sorted.raw })
      }
      else if (isExpressionTag(part)) {
        // `p-4 {on ? 'a b' : ''}`: whole classes; `bg-{c}-500`: a fragment
        const separated = (!isText(before) || /\s$/.test(before.raw))
          && (!isText(after) || /^\s/.test(after.raw))
        roots.push([
          part.expression,
          separated
            ? 'class-string'
            : 'program',
        ])
      }
    }
  }

  for (const [root, kind] of roots) {
    const nodes = collectClassNodes(root, options, kind)
    edits.push(...await classNodeEdits(nodes, uno, text, locator))
  }
  return edits
}

/**
 * Sorts a text part of a class attribute. Its source text has HTML entities
 * (`&amp;`), decoded like JSX ones; decoding must give Svelte's `data`.
 * `whole`: the whole value is this text, so whitespace at the edges is only
 * layout, as in a string.
 */
async function sortText(node: TextNode, uno: UnoGenerator, whole: boolean, glued: { gluedLeft: boolean, gluedRight: boolean }): Promise<SortedText | undefined> {
  if (!node.raw.trim())
    return undefined
  const units = decodeJsxEntities(node.raw)
  if (!units || cookedText(units) !== node.data)
    return undefined
  return whole
    ? sortUnits(units, uno, SVELTE_UNSAFE, true)
    : sortChunk(units, uno, SVELTE_UNSAFE, glued)
}

import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions, StringLiteralNode, TemplateElementNode } from './collect'
import type { AstNode } from './walk'
import { collectClassNodes, isStringLiteral } from './collect'
import { decodeJsxEntities, sortUnits } from './escapes'
import { JSX_UNSAFE, sortClassNodes } from './index'
import { stringRaw } from './rewrite'

/** An element, attribute or other node of Prettier's HTML AST (`vue` parser). */
interface HtmlNode {
  kind: string
  name?: string
  value?: string | null
  attrs?: HtmlNode[]
  children?: HtmlNode[]
}

/** A parser of a JavaScript expression, like Prettier's `__vue_expression`. */
export interface ExpressionParser {
  parse: (text: string) => Promise<unknown> | unknown
  locStart: (node: AstNode) => number
  locEnd: (node: AstNode) => number
}

export interface VueOptions extends CollectOptions {
  /**
   * The parser for `:class` values: Prettier's `__vue_ts_expression` when the
   * component's `<script>` is TypeScript, `__vue_expression` otherwise.
   */
  expressionParser: (typescript: boolean) => ExpressionParser
}

// An HTML entity in a `:class` value. Prettier formats the expression with
// entities as written, while Vue decodes them: `'&amp;'` is `'&'` at runtime,
// so classes with entities would be sorted by the wrong text.
const ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i

function walkElements(node: HtmlNode, visit: (element: HtmlNode) => void): void {
  if (node.kind === 'element')
    visit(node)
  for (const child of node.children ?? [])
    walkElements(child, visit)
}

/** Whether a Vue SFC has a TypeScript `<script>`, the same check as Prettier's. */
function isTypeScript(root: HtmlNode): boolean {
  return (root.children ?? []).some(node => node.kind === 'element'
    && node.name === 'script'
    && node.attrs?.some(attr => attr.name === 'lang' && (attr.value === 'ts' || attr.value === 'typescript')))
}

/**
 * Sorts the classes in a Vue SFC template, in place: static `class="…"` and
 * bound `:class="…"` / `v-bind:class="…"` (for every name in `attributes`).
 * `<script>` blocks are formatted with the JS parsers, which sort them.
 */
export async function sortClassesInVueAst(ast: unknown, uno: UnoGenerator, options: VueOptions): Promise<void> {
  const root = ast as HtmlNode
  const attributes = new Set(options.attributes)
  const parser = options.expressionParser(isTypeScript(root))

  const statics: HtmlNode[] = []
  const bindings: HtmlNode[] = []
  walkElements(root, (element) => {
    for (const attr of element.attrs ?? []) {
      const name = attr.name ?? ''
      if (attributes.has(name))
        statics.push(attr)
      else if (attributes.has(name.replace(/^(?::|v-bind:)/, '')))
        bindings.push(attr)
    }
  })

  for (const attr of statics) {
    const sorted = await sortStaticValue(attr.value, uno)
    if (sorted !== undefined)
      attr.value = sorted
  }
  for (const attr of bindings) {
    const sorted = await sortBindingValue(attr.value, uno, options, parser)
    if (sorted !== undefined)
      attr.value = sorted
  }
}

/**
 * Sorts a static `class` value. Prettier's AST keeps entities as written
 * (`&amp;`), like JSX strings, so they are decoded the same way and keep
 * their spelling. Prettier itself trims the value and collapses whitespace.
 */
async function sortStaticValue(value: string | null | undefined, uno: UnoGenerator): Promise<string | undefined> {
  // Not Vue syntax, but Prettier leaves such values alone too
  if (!value || value.includes('{{'))
    return undefined
  const units = decodeJsxEntities(value)
  if (!units)
    return undefined
  return (await sortUnits(units, uno, JSX_UNSAFE, true))?.raw
}

/**
 * Sorts the classes in a `:class` value, a JavaScript expression. It is a
 * class value as a whole: strings, template literals, branches, arrays and
 * object keys (`{ 'p-4 flex': on }`, Vue's object syntax).
 *
 * The expression is parsed here, the class strings are sorted in its AST and
 * their new source text replaces the old one in the value. Prettier then
 * formats the value as usual. Returns `undefined` when nothing changes or the
 * value can't be parsed (Prettier reports that itself).
 */
async function sortBindingValue(value: string | null | undefined, uno: UnoGenerator, options: CollectOptions, parser: ExpressionParser): Promise<string | undefined> {
  if (!value)
    return undefined
  // Prettier gives the expression these two entities decoded, see its `printAttribute`
  const text = value.replaceAll('&apos;', '\'').replaceAll('&quot;', '"')
  if (ENTITY.test(text))
    return undefined

  let root: unknown
  try {
    root = await parser.parse(text)
  }
  catch {
    return undefined
  }
  const expression = (root as { node?: unknown }).node ?? root
  const nodes = collectClassNodes(expression, options, true)

  // Every node whose source text may change, with how to read its new text
  const targets: [AstNode, () => string | undefined][] = []
  const addString = (node: StringLiteralNode): void => {
    targets.push([
      node,
      () => stringRaw(node),
    ])
  }
  const addQuasi = (node: TemplateElementNode): void => {
    targets.push([
      node,
      () => node.value.raw,
    ])
  }
  nodes.strings.forEach(addString)
  for (const template of nodes.templates)
    template.quasis.forEach(addQuasi)
  for (const group of nodes.keyGroups) {
    for (const key of group.keys) {
      if (isStringLiteral(key))
        addString(key)
      else
        key.quasis.forEach(addQuasi)
    }
  }

  await sortClassNodes(nodes, uno)

  const edits = targets.flatMap(([node, newText]) => {
    const start = parser.locStart(node)
    const end = parser.locEnd(node)
    const raw = newText()
    return raw === undefined || text.slice(start, end) === raw
      ? []
      : [
          { start, end, raw },
        ]
  })
  if (!edits.length)
    return undefined
  let result = text
  for (const { start, end, raw } of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, start) + raw + result.slice(end)
  return result
}

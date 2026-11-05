import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions } from './collect'
import type { HtmlNode } from './html'
import type { Locator } from './index'
import { collectClassNodes } from './collect'
import { sortStaticAttributes, walkElements } from './html'
import { applyEdits, classNodeEdits } from './index'

/** A parser of a JavaScript expression, like Prettier's `__vue_expression`. */
export interface ExpressionParser extends Locator {
  parse: (text: string) => Promise<unknown> | unknown
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

  await sortStaticAttributes(statics, uno)
  for (const attr of bindings) {
    const sorted = await sortBindingValue(attr.value, uno, options, parser)
    if (sorted !== undefined)
      attr.value = sorted
  }
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
  const nodes = collectClassNodes(expression, options, 'class-value')
  const edits = await classNodeEdits(nodes, uno, text, parser)
  return edits.length
    ? applyEdits(text, edits)
    : undefined
}

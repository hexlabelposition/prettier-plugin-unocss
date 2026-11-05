import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions } from './collect'
import { decodeJsxEntities, sortUnits } from './escapes'
import { JSX_UNSAFE } from './index'

/** An element, attribute or other node of Prettier's HTML AST (`html`, `vue` parsers). */
export interface HtmlNode {
  kind: string
  name?: string
  value?: string | null
  attrs?: HtmlNode[]
  children?: HtmlNode[]
}

/** Calls `visit` for every element, depth first. */
export function walkElements(node: HtmlNode, visit: (element: HtmlNode) => void): void {
  if (node.kind === 'element')
    visit(node)
  for (const child of node.children ?? [])
    walkElements(child, visit)
}

/**
 * Sorts the classes in an HTML document, in place: the static `class="…"`
 * of every element (every name in `attributes`). `<script>` blocks are
 * formatted with the JS parsers, which sort them.
 */
export async function sortClassesInHtmlAst(ast: unknown, uno: UnoGenerator, options: CollectOptions): Promise<void> {
  const attributes = new Set(options.attributes)
  const statics: HtmlNode[] = []
  walkElements(ast as HtmlNode, (element) => {
    for (const attr of element.attrs ?? []) {
      if (attributes.has(attr.name ?? ''))
        statics.push(attr)
    }
  })
  await sortStaticAttributes(statics, uno)
}

/** Sorts the values of static class attributes, in place. */
export async function sortStaticAttributes(attrs: readonly HtmlNode[], uno: UnoGenerator): Promise<void> {
  for (const attr of attrs) {
    const sorted = await sortStaticValue(attr.value, uno)
    if (sorted !== undefined)
      attr.value = sorted
  }
}

/**
 * Sorts a static `class` value. Prettier's AST keeps entities as written
 * (`&amp;`), like JSX strings, so they are decoded the same way and keep
 * their spelling; other entities (`&nbsp;`) leave the value alone. Prettier
 * itself trims the value and collapses whitespace.
 */
async function sortStaticValue(value: string | null | undefined, uno: UnoGenerator): Promise<string | undefined> {
  // Template syntax of some other tool: Prettier leaves such values alone too
  if (!value || value.includes('{{'))
    return undefined
  const units = decodeJsxEntities(value)
  if (!units)
    return undefined
  return (await sortUnits(units, uno, JSX_UNSAFE, true))?.raw
}

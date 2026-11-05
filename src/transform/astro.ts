import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions } from './collect'
import { sortClassesInAst } from './index'

/** Astro's attribute whose value goes through `clsx`. */
const LIST_ATTRIBUTES = ['class:list']

/**
 * Sorts the classes in an Astro component (the AST of `prettier-plugin-astro`),
 * in place. The markup is a JSX AST in `template`, sorted like JSX, plus
 * `class:list={…}` as a class value whose object keys are classes too. The
 * frontmatter and `<script>` blocks are formatted with the JS parsers, which
 * sort them.
 */
export async function sortClassesInAstroAst(ast: unknown, uno: UnoGenerator, options: CollectOptions): Promise<void> {
  const template = (ast as { template?: unknown }).template
  if (!template)
    return
  await sortClassesInAst(template, uno, {
    ...options,
    listAttributes: LIST_ATTRIBUTES,
  })
}

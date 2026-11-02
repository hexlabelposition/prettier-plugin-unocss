// Ordering algorithm adapted from UnoCSS `virtual-shared/integration/src/sort-rules.ts`
// (MIT, https://github.com/unocss/unocss), the function behind the `@unocss/order`
// ESLint rule. It is not published as a package, so we keep a copy.
// Output must stay identical to that function.

import type { UnoGenerator } from '@unocss/core'
import {
  collapseVariantGroup,
  parseVariantGroup,
  splitVariantGroupBody,
} from '@unocss/core'

/** Each variant (`hover:`, `md:`, `dark:`) moves a class this far back. */
const VARIANT_WEIGHT = 100_000

/**
 * Sorts a space-separated list of utilities in the order UnoCSS emits them
 * in the generated CSS.
 *
 * - Unknown classes go first, in their original order.
 * - Known classes are ordered by the index of the matched rule, then by the
 *   number of variants, then alphabetically.
 * - Variant groups `hover:(a b)` are sorted inside and kept collapsed.
 *
 * Whitespace between classes is normalised to single spaces, and leading and
 * trailing whitespace is removed. Use {@link sortPreservingEdges} to keep it.
 */
export async function sortClasses(
  classes: string,
  uno: UnoGenerator,
): Promise<string> {
  // `details` makes parseToken return variant handlers, used for the variant rank
  if (!uno.config.details)
    uno.config.details = true

  // `hover:(a b)` -> `hover:a hover:b`, collapsed back at the end
  const expanded = parseVariantGroup(classes)
  const parts = splitVariantGroupBody(expanded.expanded)
    .map(part => part.value)
    .filter(Boolean)

  const unknown: string[] = []
  const known: [rank: number, cls: string][] = []

  for (const cls of parts) {
    const util = (await uno.parseToken(cls))?.[0]
    if (!util) {
      unknown.push(cls)
      continue
    }
    // util[0]: index of the matched rule in config order
    const variants = util[5]?.variantHandlers?.length ?? 0
    known.push([util[0] + variants * VARIANT_WEIGHT, cls])
  }

  let sorted = known
    .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]))
    .map(([, cls]) => cls)
    .join(' ')

  if (expanded.prefixes.length)
    sorted = collapseVariantGroup(sorted, expanded.prefixes)

  return [...unknown, sorted].join(' ').trim()
}

/**
 * Like {@link sortClasses}, but keeps a single space at the start or end when
 * the input has any whitespace there. Needed for template literal chunks such
 * as `px-2 ${x} mt-1`, where those spaces separate classes from expressions.
 */
export async function sortPreservingEdges(
  input: string,
  uno: UnoGenerator,
): Promise<string> {
  if (!input.trim())
    return input
  const lead = /^\s/.test(input)
    ? ' '
    : ''
  const trail = /\s$/.test(input)
    ? ' '
    : ''
  return lead + (await sortClasses(input, uno)) + trail
}

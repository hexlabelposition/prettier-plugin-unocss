// Sorting logic. Adapted from UnoCSS `virtual-shared/integration/src/sort-rules.ts`
// (MIT, https://github.com/unocss/unocss), which is not published as a package.
import {
  collapseVariantGroup,
  notNull,
  parseVariantGroup,
  splitVariantGroupBody,
} from '@unocss/core'

/**
 * Sort a string of utilities the way UnoCSS orders them in the generated CSS.
 * Unknown classes go first, in their original order.
 *
 * @param {string} classes
 * @param {import('@unocss/core').UnoGenerator} uno
 * @returns {Promise<string>}
 */
export async function sortClasses(classes, uno) {
  // `details` makes parseToken return variant handlers, used for the variant rank
  if (!uno.config.details)
    uno.config.details = true

  // `hover:(a b)` -> `hover:a hover:b`, collapsed back at the end
  const expanded = parseVariantGroup(classes)
  const parts = splitVariantGroupBody(expanded.expanded).map(p => p.value).filter(Boolean)

  const unknown = []
  const known = []
  for (const cls of parts) {
    const token = await uno.parseToken(cls)
    if (token == null) {
      unknown.push(cls)
      continue
    }
    // token[0][0]: index of the matched rule in config order
    // each variant (hover:, md:, dark:) pushes the class further back
    const variantRank = (token[0][5]?.variantHandlers?.length || 0) * 100_000
    known.push([token[0][0] + variantRank, cls])
  }

  let sorted = known
    .filter(notNull)
    .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]))
    .map(i => i[1])
    .join(' ')

  if (expanded.prefixes.length)
    sorted = collapseVariantGroup(sorted, expanded.prefixes)

  return [...unknown, sorted].join(' ').trim()
}

/**
 * Sort while keeping leading/trailing whitespace. This is important for template
 * literal chunks like `px-2 ${x} mt-1`, where the spaces separate classes.
 */
export async function sortPreservingEdges(input, uno) {
  if (!input.trim())
    return input
  const lead = input.match(/^\s*/)[0] ? ' ' : ''
  const trail = input.match(/\s*$/)[0] ? ' ' : ''
  return lead + (await sortClasses(input, uno)) + trail
}

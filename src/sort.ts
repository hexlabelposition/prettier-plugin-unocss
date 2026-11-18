import type { UnoGenerator } from '@unocss/core'
import { sortRules } from '@unocss/core'

/**
 * Like `sortRules` from `@unocss/core`, but keeps a single space at the start
 * or end when the input has any whitespace there. Needed for template literal
 * chunks such as `px-2 ${x} mt-1`, where those spaces separate classes from
 * expressions.
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
  return lead + (await sortRules(input, uno)) + trail
}

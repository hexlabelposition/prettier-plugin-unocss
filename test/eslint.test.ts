/* eslint-disable no-template-curly-in-string -- reasons mention `${…}` */
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatWithEslint, formatWithPlugin } from './eslint-compare'
import { cases, readCase, root } from './fixture-cases'

// Every fixture must give the same result as `eslint --fix` with the UnoCSS
// `order` rule followed by Prettier, except for the cases below, where the
// difference is intended.
const different: Record<string, string> = {
  'clsx-object-keys': 'ESLint makes two keys equal: `{ \'p-4 flex\': a, \'flex p-4\': b }`',
  'conditional-logical-array': 'ESLint looks only one level deep',
  'playground-example': 'ESLint breaks classes glued to `${…}`',
  'quotes-and-escapes': 'ESLint drops escapes and breaks the code',
  'template-expressions': 'ESLint breaks glued classes and doubles the space between `${…}`',
  'template-glued-expressions': 'ESLint breaks classes glued to `${…}`',
  'variables': 'ESLint looks only one level deep',
  'variant-group-like-classes': 'ESLint expands `w-(--x)` into another class, `w---x`',
}

const configPath = join(root, 'uno.config.ts')

describe('same result as the ESLint rule', () => {
  it.each(cases)('%s', async (name) => {
    const { input, filepath, options } = await readCase(name)
    const compare = {
      filepath,
      configPath,
      unoFunctions: options.unoFunctions,
      unoVariables: options.unoVariables,
    }
    const ours = await formatWithPlugin(input, compare)
    const eslint = await formatWithEslint(input, compare).catch((error: Error) => error.message)

    if (name in different)
      expect(eslint, `${name} is listed as different, but matches`).not.toBe(ours)
    else
      expect(ours).toBe(eslint)
  })
})

it('lists only existing cases as different', () => {
  expect(Object.keys(different).filter(name => !cases.includes(name))).toEqual([])
})

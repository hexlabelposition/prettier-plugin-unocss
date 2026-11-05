import type { Options } from 'prettier'
import { format } from 'prettier'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index'
import { cases, languagePlugins, readCase } from './fixture-cases'

// Run `pnpm test -u` to write missing outputs.
describe('fixtures', () => {
  it.each(cases)('%s', async (name) => {
    const { input, filepath, output, options } = await readCase(name)
    const opts: Options = {
      ...options,
      filepath,
      plugins: [
        ...languagePlugins(filepath),
        plugin,
      ],
    }

    const formatted = await format(input, opts)
    await expect(formatted).toMatchFileSnapshot(output)
    // Idempotency: formatting the output again changes nothing
    expect(await format(formatted, opts)).toBe(formatted)
  })
})

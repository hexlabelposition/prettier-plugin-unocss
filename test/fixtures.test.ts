import type { Options } from 'prettier'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index'

// test/fixtures/<case>/input.<ext> is formatted and compared with output.<ext>.
// Optional options.json holds extra Prettier options. All cases share
// test/fixtures/uno.config.ts. Run `pnpm test -u` to write missing outputs.
const root = fileURLToPath(new URL('./fixtures', import.meta.url))

const cases = (await readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

async function readCase(name: string): Promise<{ input: string, filepath: string, output: string, options: Options }> {
  const dir = join(root, name)
  const inputFile = (await readdir(dir)).find(file => file.startsWith('input.'))
  if (!inputFile)
    throw new Error(`No input.* in ${dir}`)
  const optionsFile = join(dir, 'options.json')
  return {
    input: await readFile(join(dir, inputFile), 'utf8'),
    filepath: join(dir, inputFile),
    output: join(dir, inputFile.replace(/^input\./, 'output.')),
    options: existsSync(optionsFile)
      ? JSON.parse(await readFile(optionsFile, 'utf8'))
      : {},
  }
}

describe('fixtures', () => {
  it.each(cases)('%s', async (name) => {
    const { input, filepath, output, options } = await readCase(name)
    const opts: Options = {
      ...options,
      filepath,
      plugins: [plugin],
    }

    const formatted = await format(input, opts)
    await expect(formatted).toMatchFileSnapshot(output)
    // Idempotency: formatting the output again changes nothing
    expect(await format(formatted, opts)).toBe(formatted)
  })
})

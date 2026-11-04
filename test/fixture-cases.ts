import type { Options } from 'prettier'
import { existsSync, readdirSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// test/fixtures/<case>/input.<ext> is formatted and compared with output.<ext>.
// Optional options.json holds extra Prettier options. All cases share
// test/fixtures/uno.config.ts.
export const root = fileURLToPath(new URL('./fixtures', import.meta.url))

export const cases = readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

export interface FixtureCase {
  input: string
  filepath: string
  output: string
  options: Options
}

export async function readCase(name: string): Promise<FixtureCase> {
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

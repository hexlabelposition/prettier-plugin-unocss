import type { Options, Plugin } from 'prettier'
import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sveltePlugin from 'prettier-plugin-svelte'

// test/fixtures/<case>/input.<ext> is formatted and compared with output.<ext>.
// Optional options.json holds extra Prettier options. All cases share
// test/fixtures/uno.config.ts.
export const root = fileURLToPath(new URL('./fixtures', import.meta.url))

export const cases = readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

/** The `input.*` file name of a case. */
export function inputFile(name: string): string {
  const file = readdirSync(join(root, name)).find(file => file.startsWith('input.'))
  if (!file)
    throw new Error(`No input.* in ${join(root, name)}`)
  return file
}

/**
 * Plugins a language needs besides ours, which must come after them (see
 * the README): Svelte needs `prettier-plugin-svelte`.
 */
export function languagePlugins(filepath: string): Plugin[] {
  return filepath.endsWith('.svelte')
    ? [sveltePlugin as Plugin]
    : []
}

export interface FixtureCase {
  input: string
  filepath: string
  output: string
  options: Options
}

export async function readCase(name: string): Promise<FixtureCase> {
  const dir = join(root, name)
  const input = inputFile(name)
  const optionsFile = join(dir, 'options.json')
  return {
    input: await readFile(join(dir, input), 'utf8'),
    filepath: join(dir, input),
    output: join(dir, input.replace(/^input\./, 'output.')),
    options: existsSync(optionsFile)
      ? JSON.parse(await readFile(optionsFile, 'utf8'))
      : {},
  }
}

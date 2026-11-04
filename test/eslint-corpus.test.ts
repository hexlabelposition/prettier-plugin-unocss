import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { formatWithEslint, formatWithPlugin } from './eslint-compare'
import { root } from './fixture-cases'

// Compares this plugin with the ESLint rule on a directory of real files:
// `CORPUS=path/to/project pnpm vitest run test/eslint-corpus.test.ts`
// The files are sorted with test/fixtures/uno.config.ts (presetWind3), so
// Tailwind projects work too. Lines that differ are printed; turn real
// mismatches into fixtures (see test/eslint.test.ts for intended ones).
const corpus = process.env.CORPUS

async function* sourceFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.'))
      yield* sourceFiles(path)
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts'))
      yield path
  }
}

it.skipIf(!corpus)('same result as the ESLint rule on a corpus', async () => {
  const options = {
    configPath: join(root, 'uno.config.ts'),
  }
  const report: string[] = []
  let files = 0

  for await (const filepath of sourceFiles(resolve(corpus!))) {
    files++
    const code = await readFile(filepath, 'utf8')
    const ours = await formatWithPlugin(code, { ...options, filepath })
    const eslint = await formatWithEslint(code, { ...options, filepath }).catch((error: Error) => error.message)
    if (ours === eslint)
      continue

    const a = eslint.split('\n')
    const b = ours.split('\n')
    report.push(`\n${filepath}`)
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i])
        report.push(`  - eslint: ${a[i]?.trim()}`, `  + plugin: ${b[i]?.trim()}`)
    }
  }

  process.stdout.write(`${files} files, ${report.filter(line => line.startsWith('\n')).length} differ${report.join('\n')}\n`)
  expect(files).toBeGreaterThan(0)
}, 30 * 60_000)

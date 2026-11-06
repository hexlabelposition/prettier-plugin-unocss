// Formats generated TSX files with Prettier, without and with the plugin, and
// prints the cost of the first file (config load, generator creation) and of
// every next file.
//
//   pnpm bench [files] [runs] [presets]
//
// `presets` is a comma-separated list of directories in `bench/presets/`
// (default: all of them). Each one holds a `uno.config.ts`, found by searching
// up from the formatted file, as in a real project. Every preset formats the
// same files, so the numbers are comparable.
//
// Each mode runs in a fresh Node process, so caches don't leak between runs.
// The plugin is loaded from `dist/` (`pnpm bench` builds it first).

import type { Plugin } from 'prettier'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { format } from 'prettier'

// `prettier` alone, or the plugin with the config from `bench/presets/<mode>/`
type Mode = string

interface Result {
  first: number
  perFile: number
}

const root = join(import.meta.dirname, '..')
const presetsDir = join(import.meta.dirname, 'presets')

const UTILITIES = [
  'flex inline-flex grid block hidden relative absolute sticky top-0 inset-0',
  'items-center items-start justify-between justify-center gap-1 gap-2 gap-4 gap-x-6',
  'grid-cols-2 grid-cols-3 col-span-2 flex-col flex-wrap flex-1 shrink-0 grow',
  'p-1 p-2 p-4 p-6 px-2 px-4 py-1 py-2 pt-4 pb-8 m-0 mx-auto mt-2 mb-4',
  'w-full w-1/2 w-64 h-10 h-screen min-h-0 max-w-lg size-6 aspect-square',
  'text-xs text-sm text-lg text-2xl font-medium font-bold leading-tight tracking-wide',
  'text-left text-center uppercase truncate underline whitespace-nowrap',
  'text-white text-gray-500 text-gray-900 text-blue-600 text-red-500',
  'bg-white bg-gray-50 bg-gray-100 bg-blue-500 bg-black/50 bg-transparent',
  'border border-2 border-gray-200 border-transparent rounded rounded-lg rounded-full',
  'shadow shadow-lg ring-2 ring-blue-500 opacity-50 outline-none',
  'transition duration-200 ease-in-out cursor-pointer select-none overflow-hidden z-10',
  // A shortcut from bench/presets/*/uno.config.ts
  'btn',
  // An icon from @iconify-json/svg-spinners, known only with presetIcons
  'i-svg-spinners-180-ring',
].join(' ').split(' ')
const VARIANTS = 'hover: focus: md: lg: dark: disabled: sm:hover:'.split(' ')
// Classes UnoCSS doesn't know
const UNKNOWN = 'card is-active js-toggle'.split(' ')

// Deterministic, so every run formats the same files
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateFile(index: number): string {
  const next = random(index + 1)
  const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)]!
  const classes = (count: number): string => Array.from({ length: count }, () => {
    const roll = next()
    if (roll < 0.05)
      return pick(UNKNOWN)
    return roll < 0.3
      ? pick(VARIANTS) + pick(UTILITIES)
      : pick(UTILITIES)
  }).join(' ')
  const count = (): number => 3 + Math.floor(next() * 8)

  const components = Array.from({ length: 5 }, (_, i) => `
export function Item${i}({ active, tone }: { active: boolean, tone: string }) {
  return (
    <div className="${classes(count())}">
      <h2 className="${classes(count())}">Title</h2>
      <p className={clsx("${classes(count())}", active && "${classes(count())}")}>Text</p>
      <ul className={\`${classes(count())} \${active ? "${classes(3)}" : "${classes(3)}"}\`}>
        <li className={cn("${classes(count())}", { "${classes(2)}": active })}>{tone}</li>
      </ul>
      <button type="button" className="${classes(count())}">OK</button>
    </div>
  );
}
`)
  return `import clsx from "clsx";\nimport { cn } from "./utils";\n${components.join('')}`
}

async function runMode(mode: Mode, files: number): Promise<Result> {
  const plugins: Plugin[] = mode === 'prettier'
    ? []
    : [await import(pathToFileURL(join(root, 'dist/index.mjs')).href)]
  const dir = mode === 'prettier'
    ? presetsDir
    : join(presetsDir, mode)
  const sources = Array.from({ length: files }, (_, i) => generateFile(i))

  const times: number[] = []
  for (const [i, source] of sources.entries()) {
    const start = performance.now()
    await format(source, {
      filepath: join(dir, `bench-${i}.tsx`),
      plugins,
    })
    times.push(performance.now() - start)
  }
  const rest = times.slice(1)
  return {
    first: times[0]!,
    perFile: rest.reduce((sum, time) => sum + time, 0) / rest.length,
  }
}

function runChild(mode: Mode, files: number): Result {
  const output = execFileSync(process.execPath, [
    import.meta.filename,
    '--child',
    mode,
    String(files),
  ], {
    encoding: 'utf8',
  })
  return JSON.parse(output) as Result
}

function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

function ms(value: number): string {
  return `${value.toFixed(1)} ms`
}

async function main(): Promise<void> {
  if (process.argv[2] === '--child') {
    const result = await runMode(process.argv[3] as Mode, Number(process.argv[4]))
    process.stdout.write(JSON.stringify(result))
    return
  }

  const files = Number(process.argv[2] ?? 200)
  const runs = Number(process.argv[3] ?? 5)
  const presets = process.argv[4]?.split(',')
    ?? readdirSync(presetsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  const summary = (mode: Mode): Result => {
    const results = Array.from({ length: runs }, () => runChild(mode, files))
    return {
      first: median(results.map(result => result.first)),
      perFile: median(results.map(result => result.perFile)),
    }
  }
  const prettier = summary('prettier')
  // Overhead is measured against Prettier itself, so it doesn't apply there
  const table: Record<string, Record<string, string>> = {
    Prettier: {
      'first file': ms(prettier.first),
      'next files, each': ms(prettier.perFile),
      'overhead, first': '—',
      'overhead, each': '—',
    },
  }
  for (const preset of presets) {
    const plugin = summary(preset)
    table[`+ plugin (${preset})`] = {
      'first file': ms(plugin.first),
      'next files, each': ms(plugin.perFile),
      'overhead, first': ms(plugin.first - prettier.first),
      'overhead, each': ms(plugin.perFile - prettier.perFile),
    }
  }

  console.log(`${files} files, median of ${runs} runs, Node ${process.version}\n`)
  console.table(table)
}

main()

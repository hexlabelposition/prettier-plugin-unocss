import type { UnoGenerator } from '@unocss/core'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { loadConfig } from '@unocss/config'
import { createGenerator } from '@unocss/core'
import { createConfigLoader } from 'unconfig'
import { createLikeEslint } from './icons'

export interface GeneratorOptions {
  /** Path of the formatted file, used to search for `uno.config.*` upwards. */
  filepath?: string
  /** Explicit config path (the `unoConfig` option), resolved from `cwd`. */
  unoConfig?: string
}

const PREFIX = '[prettier-plugin-unocss]'

/** Config file names, the same list `@unocss/config` searches for. */
const CONFIG_FILES = ['unocss.config', 'uno.config']

interface CacheEntry {
  generator: Promise<UnoGenerator>
  /**
   * Files the config was loaded from, with their state at load time; set once
   * the load succeeds. While it is `undefined`, the load is still running.
   */
  files?: Map<string, string>
}

// Prettier formats many files per run and building a generator is the
// expensive part, so there is one generator per config file. The cache stores
// promises, so parallel requests for the same config share one load.
const cache = new Map<string, CacheEntry>()

/**
 * Returns the UnoCSS generator for a formatted file.
 *
 * `uno.config.*` (or `unocss.config.*`) is searched for starting from the
 * file's directory, so monorepos with several configs work. With `unoConfig`
 * set, that path is used instead.
 *
 * Resolves to `undefined` when no config is found: the file should then be
 * left untouched, because guessing presets would give a wrong order. Rejects
 * when the `unoConfig` file doesn't exist or the config fails to load.
 */
export async function getGenerator(options: GeneratorOptions): Promise<UnoGenerator | undefined> {
  const configPath = options.unoConfig
    ? resolve(process.cwd(), options.unoConfig)
    : await findConfig(options.filepath
        ? dirname(options.filepath)
        : process.cwd())
  if (!configPath)
    return undefined
  // A missing explicit config is a mistake, unlike no config found by search
  if (options.unoConfig && !existsSync(configPath))
    throw new Error(`${PREFIX} UnoCSS config not found: ${configPath} (the \`unoConfig\` option)`)

  const cached = cache.get(configPath)
  if (cached && !(cached.files && changed(cached.files)))
    return cached.generator

  // Not loaded yet, or a config file changed since (editors keep Prettier
  // running between saves). The config file's state is taken before loading,
  // so an edit made during the load is not missed
  const configState = fileState(configPath)
  const entry: CacheEntry = {
    generator: createFromConfig(configPath).then(({ generator, sources }) => {
      entry.files = new Map(sources.map(file => [
        file,
        fileState(file),
      ]))
      entry.files.set(configPath, configState)
      return generator
    }),
  }
  cache.set(configPath, entry)
  // Don't keep a failure: once the config is fixed, the next format loads it
  // again
  entry.generator.catch(() => {
    if (cache.get(configPath) === entry)
      cache.delete(configPath)
  })
  return entry.generator
}

/**
 * The state of a file to compare later: modification time and size, or
 * `missing`. A file may also appear, e.g. a `configDeps` entry created later.
 */
function fileState(file: string): string {
  const stats = statSync(file, { throwIfNoEntry: false })
  return stats
    ? `${stats.mtimeMs}:${stats.size}`
    : 'missing'
}

function changed(files: Map<string, string>): boolean {
  for (const [file, state] of files) {
    if (fileState(file) !== state)
      return true
  }
  return false
}

/**
 * Finds the config file that `@unocss/config` would load from `cwd`, using the
 * same search (`unconfig`), without loading it.
 */
async function findConfig(cwd: string): Promise<string | undefined> {
  const [first] = await createConfigLoader({
    sources: [
      { files: CONFIG_FILES },
    ],
    cwd,
  }).findConfigs()
  return first
}

/**
 * Loads a config file and creates a generator from it, returning the files
 * that should invalidate it. Errors name the plugin
 * and the config file, so a broken config is easy to find from Prettier's
 * output; the original error is the `cause`.
 */
async function createFromConfig(configPath: string): Promise<{ generator: UnoGenerator, sources: string[] }> {
  try {
    // `sources` are the config file and its `configDeps`. Files the config
    // imports are not reported by the loader, so changes to them are picked up
    // only when they are listed in `configDeps` (as in the Vite plugin)
    let sources: string[] = []
    const generator = await createLikeEslint(async () => {
      const loaded = await loadConfig(dirname(configPath), configPath)
      sources = loaded.sources
      return createGenerator({ ...loaded.config, warn: false })
    })
    return { generator, sources }
  }
  catch (error) {
    const cause = error instanceof Error
      ? error.message
      : String(error)
    throw new Error(`${PREFIX} Failed to load UnoCSS config ${configPath}: ${cause}`, { cause: error })
  }
}

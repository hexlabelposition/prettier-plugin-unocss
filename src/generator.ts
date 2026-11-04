import type { UnoGenerator } from '@unocss/core'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { loadConfig } from '@unocss/config'
import { createGenerator } from '@unocss/core'
import { createConfigLoader } from 'unconfig'

export interface GeneratorOptions {
  /** Path of the formatted file, used to search for `uno.config.*` upwards. */
  filepath?: string
  /** Explicit config path (the `unoConfig` option), resolved from `cwd`. */
  unoConfig?: string
}

const PREFIX = '[prettier-plugin-unocss]'

/** Config file names, the same list `@unocss/config` searches for. */
const CONFIG_FILES = ['unocss.config', 'uno.config']

// Prettier formats many files per run and building a generator is the
// expensive part, so there is one generator per config file. The cache stores
// promises, so parallel requests for the same config share one load.
const cache = new Map<string, Promise<UnoGenerator>>()

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

  let generator = cache.get(configPath)
  if (!generator) {
    generator = createFromConfig(configPath)
    cache.set(configPath, generator)
    // Don't keep a failure: once the config is fixed, the next format (in an
    // editor, Prettier keeps running) loads it again
    generator.catch(() => {
      if (cache.get(configPath) === generator)
        cache.delete(configPath)
    })
  }
  return generator
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
 * Loads a config file and creates a generator from it. Errors name the plugin
 * and the config file, so a broken config is easy to find from Prettier's
 * output; the original error is the `cause`.
 */
async function createFromConfig(configPath: string): Promise<UnoGenerator> {
  try {
    const { config } = await loadConfig(dirname(configPath), configPath)
    return await createGenerator({ ...config, warn: false })
  }
  catch (error) {
    const cause = error instanceof Error
      ? error.message
      : String(error)
    throw new Error(`${PREFIX} Failed to load UnoCSS config ${configPath}: ${cause}`, { cause: error })
  }
}

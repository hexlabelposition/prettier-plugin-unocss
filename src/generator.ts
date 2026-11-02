import type { UnoGenerator } from '@unocss/core'
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
 * left untouched, because guessing presets would give a wrong order.
 */
export async function getGenerator(options: GeneratorOptions): Promise<UnoGenerator | undefined> {
  const configPath = options.unoConfig
    ? resolve(process.cwd(), options.unoConfig)
    : await findConfig(options.filepath
        ? dirname(options.filepath)
        : process.cwd())
  if (!configPath)
    return undefined

  let generator = cache.get(configPath)
  if (!generator) {
    generator = createFromConfig(configPath)
    cache.set(configPath, generator)
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

async function createFromConfig(configPath: string): Promise<UnoGenerator> {
  const { config } = await loadConfig(dirname(configPath), configPath)
  return createGenerator({ ...config, warn: false })
}

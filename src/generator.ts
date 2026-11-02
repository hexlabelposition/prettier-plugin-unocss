import type { UnoGenerator } from '@unocss/core'
import { dirname } from 'node:path'
import process from 'node:process'
import { loadConfig } from '@unocss/config'
import { createGenerator } from '@unocss/core'

export interface GeneratorOptions {
  /** Path of the formatted file, used to search for `uno.config.*` upwards. */
  filepath?: string
  /** Explicit config path (the `unoConfig` option), resolved from `cwd`. */
  unoConfig?: string
}

// Prettier formats many files per run and building a generator is the
// expensive part, so generators are cached. The cache stores promises, so
// parallel requests for the same location share one load.
const cache = new Map<string, Promise<UnoGenerator | undefined>>()

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
export function getGenerator(options: GeneratorOptions): Promise<UnoGenerator | undefined> {
  const searchFrom = !options.unoConfig && options.filepath
    ? dirname(options.filepath)
    : process.cwd()
  const key = `${options.unoConfig ?? ''}|${searchFrom}`

  let generator = cache.get(key)
  if (!generator) {
    generator = createFromConfig(searchFrom, options.unoConfig)
    cache.set(key, generator)
  }
  return generator
}

async function createFromConfig(searchFrom: string, configPath?: string): Promise<UnoGenerator | undefined> {
  const { config, sources } = await loadConfig(searchFrom, configPath)
  if (!sources.length)
    return undefined
  return createGenerator({ ...config, warn: false })
}

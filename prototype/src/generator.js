import { dirname } from 'node:path'
import process from 'node:process'
import { loadConfig } from '@unocss/config'
import { createGenerator } from '@unocss/core'

// One generator per config location: Prettier formats many files per run,
// and building a generator is the expensive part.
const cache = new Map()

/**
 * Find uno.config.* starting from the formatted file's folder (monorepo-friendly),
 * or use the path from the `unoConfig` option.
 *
 * @param {{ filepath?: string, unoConfig?: string }} options Prettier options
 * @returns {Promise<import('@unocss/core').UnoGenerator | undefined>}
 */
export function getGenerator(options) {
  const searchFrom = options.unoConfig
    ? process.cwd()
    : options.filepath
      ? dirname(options.filepath)
      : process.cwd()
  const key = `${options.unoConfig ?? ''}|${searchFrom}`

  if (!cache.has(key))
    cache.set(key, createFromConfig(searchFrom, options.unoConfig))
  return cache.get(key)
}

async function createFromConfig(searchFrom, configPath) {
  const { config, sources } = await loadConfig(searchFrom, configPath)
  // No config -> leave the file alone instead of guessing presets
  if (!sources.length)
    return undefined
  return createGenerator({ ...config, warn: false })
}

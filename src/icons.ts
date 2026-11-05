import type { UnoGenerator } from '@unocss/core'
import process from 'node:process'

const ICONS_PRESET = '@unocss/preset-icons'

/**
 * An icon name `parseIcon` rejects before calling the loader (its collection
 * is not a known one), so it only makes the preset create its loader.
 */
const PRIME_ICON = 'prettier-plugin-unocss:prime'

interface IconsApi {
  parseIcon: (body: string) => Promise<unknown>
}

let activeLoads = 0
let savedEslint: string | undefined

/**
 * Creates a generator the way the UnoCSS ESLint plugin sees it: with
 * `process.env.ESLINT` set.
 *
 * `@unocss/preset-icons` checks that variable and then doesn't load icon
 * collections from installed `@iconify-json/*` packages (custom collections
 * and `cdn` still work), and doesn't warn about icons it can't load. Sorting
 * doesn't need the icons, and loading a collection is slow. It also makes the
 * order match the ESLint rule, where such icons are unknown classes.
 *
 * The variable is set only while the config loads, not for the whole Prettier
 * process. The preset reads it in two places: when it is created (for
 * warnings) and when it creates its icon loader, which happens on the first
 * icon. So the loader is created here, before the variable is restored.
 */
export async function createLikeEslint(create: () => Promise<UnoGenerator>): Promise<UnoGenerator> {
  // Loads of several configs may overlap: keep the variable until the last
  // one ends
  if (activeLoads++ === 0) {
    savedEslint = process.env.ESLINT
    process.env.ESLINT ||= 'true'
  }
  try {
    const generator = await create()
    await Promise.all(generator.config.presets
      .filter(preset => preset.name === ICONS_PRESET)
      .map(preset => (preset.api as Partial<IconsApi> | undefined)?.parseIcon?.(PRIME_ICON)))
    return generator
  }
  finally {
    if (--activeLoads === 0) {
      if (savedEslint === undefined)
        delete process.env.ESLINT
      else
        process.env.ESLINT = savedEslint
    }
  }
}

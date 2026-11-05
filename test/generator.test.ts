import type { UnoGenerator } from '@unocss/core'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGenerator } from '../src/generator'

const configs = fileURLToPath(new URL('./configs', import.meta.url))

function shortcutNames(uno: UnoGenerator | undefined): string[] {
  return uno?.config.shortcuts.map(([name]) => String(name)) ?? []
}

describe('getGenerator', () => {
  it('finds uno.config.* next to the formatted file', async () => {
    const uno = await getGenerator({
      filepath: join(configs, 'project/file.tsx'),
    })
    expect(shortcutNames(uno)).toContain('from-project')
  })

  it('searches for the config upwards from the file', async () => {
    const uno = await getGenerator({
      filepath: join(configs, 'project/nested/deep/file.tsx'),
    })
    expect(shortcutNames(uno)).toContain('from-project')
  })

  it('finds unocss.config.* as well', async () => {
    const uno = await getGenerator({
      filepath: join(configs, 'other/file.tsx'),
    })
    expect(shortcutNames(uno)).toContain('from-other')
  })

  it('uses the nearest config in a monorepo', async () => {
    const [a, b] = await Promise.all([
      getGenerator({
        filepath: join(configs, 'project/a.tsx'),
      }),
      getGenerator({
        filepath: join(configs, 'other/b.tsx'),
      }),
    ])
    expect(shortcutNames(a)).toEqual(['from-project'])
    expect(shortcutNames(b)).toEqual(['from-other'])
  })

  it('uses the unoConfig path instead of searching', async () => {
    const uno = await getGenerator({
      filepath: join(configs, 'project/file.tsx'),
      unoConfig: 'test/configs/other/unocss.config.ts',
    })
    expect(shortcutNames(uno)).toEqual(['from-other'])
  })

  describe('without a config', () => {
    let dir: string | undefined

    afterAll(async () => {
      if (dir)
        await rm(dir, { recursive: true, force: true })
    })

    it('resolves to undefined', async () => {
      dir = await mkdtemp(join(tmpdir(), 'prettier-plugin-unocss-'))
      expect(await getGenerator({
        filepath: join(dir, 'file.tsx'),
      })).toBeUndefined()
    })
  })

  describe('errors', () => {
    let dir: string | undefined

    afterAll(async () => {
      if (dir)
        await rm(dir, { recursive: true, force: true })
    })

    it('names the config file and the cause when the config fails to load', async () => {
      const configPath = join(configs, 'broken/uno.config.ts')
      const error: Error = await getGenerator({
        filepath: join(configs, 'broken/file.tsx'),
      })
        .catch(error => error)
      expect(error.message).toBe(`[prettier-plugin-unocss] Failed to load UnoCSS config ${configPath}: broken on purpose`)
      expect((error.cause as Error).message).toBe('broken on purpose')
    })

    it('rejects a unoConfig path that does not exist', async () => {
      await expect(getGenerator({ unoConfig: 'test/configs/missing/uno.config.ts' }))
        .rejects
        .toThrow(`[prettier-plugin-unocss] UnoCSS config not found: ${join(configs, 'missing/uno.config.ts')} (the \`unoConfig\` option)`)
    })

    it('loads the config again after a failure', async () => {
      dir = await mkdtemp(join(tmpdir(), 'prettier-plugin-unocss-'))
      const configPath = join(dir, 'uno.config.ts')
      await writeFile(configPath, 'throw new Error(\'not yet\')\n')
      await expect(getGenerator({ unoConfig: configPath })).rejects.toThrow('not yet')

      await writeFile(configPath, 'export default { shortcuts: { fixed: \'p-4\' } }\n')
      expect(shortcutNames(await getGenerator({ unoConfig: configPath }))).toEqual(['fixed'])
    })
  })

  describe('cache invalidation', () => {
    let dir: string
    let configPath: string

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'prettier-plugin-unocss-'))
      configPath = join(dir, 'uno.config.ts')
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('reloads the config when it changes', async () => {
      await writeFile(configPath, 'export default { shortcuts: { before: \'p-4\' } }\n')
      const first = await getGenerator({
        filepath: join(dir, 'file.tsx'),
      })
      expect(shortcutNames(first)).toEqual(['before'])
      expect(await getGenerator({
        filepath: join(dir, 'file.tsx'),
      })).toBe(first)

      await writeFile(configPath, 'export default { shortcuts: { after: \'p-4\' } }\n')
      const second = await getGenerator({
        filepath: join(dir, 'file.tsx'),
      })
      expect(second).not.toBe(first)
      expect(shortcutNames(second)).toEqual(['after'])
      expect(await getGenerator({
        filepath: join(dir, 'file.tsx'),
      })).toBe(second)
    })

    it('reloads the config when a file from configDeps changes', async () => {
      const shared = join(dir, 'shared.ts')
      await writeFile(shared, 'export const shortcuts = { before: \'p-4\' }\n')
      await writeFile(configPath, [
        'import { shortcuts } from \'./shared\'',
        'export default { shortcuts, configDeps: [\'./shared.ts\'] }',
        '',
      ].join('\n'))
      expect(shortcutNames(await getGenerator({ unoConfig: configPath }))).toEqual(['before'])

      await writeFile(shared, 'export const shortcuts = { after: \'p-4\' }\n')
      expect(shortcutNames(await getGenerator({ unoConfig: configPath }))).toEqual(['after'])
    })

    it('reloads the config when a missing file from configDeps appears', async () => {
      await writeFile(configPath, [
        'import { existsSync } from \'node:fs\'',
        `const extra = ${JSON.stringify(join(dir, 'extra.ts'))}`,
        'export default { shortcuts: existsSync(extra) ? { extra: \'p-4\' } : {}, configDeps: [extra] }',
        '',
      ].join('\n'))
      expect(shortcutNames(await getGenerator({ unoConfig: configPath }))).toEqual([])

      await writeFile(join(dir, 'extra.ts'), '\n')
      expect(shortcutNames(await getGenerator({ unoConfig: configPath }))).toEqual(['extra'])
    })

    it('shares a load in progress instead of starting another one', async () => {
      await writeFile(configPath, 'export default {}\n')
      const [a, b] = await Promise.all([
        getGenerator({ unoConfig: configPath }),
        getGenerator({ unoConfig: configPath }),
      ])
      expect(a).toBe(b)
    })
  })

  it('reuses one generator per config file', async () => {
    const [root, nested, explicit] = await Promise.all([
      getGenerator({
        filepath: join(configs, 'project/file.tsx'),
      }),
      getGenerator({
        filepath: join(configs, 'project/nested/deep/file.tsx'),
      }),
      getGenerator({ unoConfig: 'test/configs/project/uno.config.ts' }),
    ])
    expect(root).toBeDefined()
    expect(nested).toBe(root)
    expect(explicit).toBe(root)
  })

  it('creates separate generators for separate config files', async () => {
    const [a, b] = await Promise.all([
      getGenerator({
        filepath: join(configs, 'project/file.tsx'),
      }),
      getGenerator({
        filepath: join(configs, 'other/file.tsx'),
      }),
    ])
    expect(a).not.toBe(b)
  })
})

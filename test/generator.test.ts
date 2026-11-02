import type { UnoGenerator } from '@unocss/core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
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

  it('reuses one generator for files in the same directory', async () => {
    const filepath = join(configs, 'project/file.tsx')
    const first = getGenerator({ filepath })
    const second = getGenerator({
      filepath: join(configs, 'project/other.tsx'),
    })
    expect(second).toBe(first)
    expect(await second).toBe(await first)
  })
})

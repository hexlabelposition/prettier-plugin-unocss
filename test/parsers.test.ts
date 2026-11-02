import type { Options } from 'prettier'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { afterAll, describe, expect, it } from 'vitest'
import * as plugin from '../src/index'

const configs = fileURLToPath(new URL('./configs', import.meta.url))
// Formatted files "live" next to a config with presetWind3
const at = (name: string): string => join(configs, 'wind3', name)

async function fmt(code: string, options: Options): Promise<string> {
  const once = await format(code, {
    plugins: [plugin],
    ...options,
  })
  expect(await format(once, {
    plugins: [plugin],
    ...options,
  })).toBe(once)
  return once
}

describe('parsers', () => {
  it.each([
    'babel',
    'babel-ts',
    'typescript',
    'acorn',
    'espree',
    'meriyah',
  ])('wraps %s', async (parser) => {
    expect(await fmt('clsx("p-4 flex");', {
      parser,
      filepath: at('x.js'),
    })).toBe('clsx("flex p-4");\n')
  })

  it.each([
    'x.js',
    'x.jsx',
    'x.mjs',
    'x.cjs',
    'x.ts',
    'x.tsx',
    'x.mts',
    'x.cts',
  ])('is picked by Prettier for %s', async (file) => {
    expect(await fmt('clsx("p-4 flex");', {
      filepath: at(file),
    })).toBe('clsx("flex p-4");\n')
  })

  it.each(['x.jsx', 'x.tsx'])('sorts JSX attributes in %s', async (file) => {
    expect(await fmt('<a className="p-4 flex" />;', {
      filepath: at(file),
    }))
      .toBe('<a className="flex p-4" />;\n')
  })

  it('keeps everything else as Prettier formats it', async () => {
    const code = 'const  a = {b:1}\n'
    expect(await fmt(code, {
      filepath: at('x.ts'),
    })).toBe(await format(code, {
      filepath: at('x.ts'),
    }))
  })

  describe('without a config', () => {
    let dir: string | undefined

    afterAll(async () => {
      if (dir)
        await rm(dir, { recursive: true, force: true })
    })

    it('leaves classes untouched', async () => {
      dir = await mkdtemp(join(tmpdir(), 'prettier-plugin-unocss-'))
      expect(await fmt('<a className="p-4 flex" />;', {
        filepath: join(dir, 'x.tsx'),
      }))
        .toBe('<a className="p-4 flex" />;\n')
    })
  })
})

describe('options', () => {
  it('unoAttributes', async () => {
    expect(await fmt('<a tw="p-4 flex" className="p-4 flex" />;', {
      filepath: at('x.tsx'),
      unoAttributes: ['tw'],
    }))
      .toBe('<a tw="flex p-4" className="p-4 flex" />;\n')
  })

  it('unoFunctions', async () => {
    expect(await fmt('myCn("p-4 flex"); clsx("p-4 flex");', {
      filepath: at('x.ts'),
      unoFunctions: ['myCn'],
    }))
      .toBe('myCn("flex p-4");\nclsx("p-4 flex");\n')
  })

  it('unoConfig', async () => {
    // The file is next to a config without presets, but unoConfig points to wind3
    const filepath = join(configs, 'project', 'x.ts')
    expect(await fmt('clsx("p-4 flex");', { filepath })).toBe('clsx("p-4 flex");\n')
    expect(await fmt('clsx("p-4 flex");', { filepath, unoConfig: 'test/configs/wind3/uno.config.ts' }))
      .toBe('clsx("flex p-4");\n')
  })
})

import type { Options, ParserOptions, Plugin } from 'prettier'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import * as astroPlugin from 'prettier-plugin-astro'
import * as sveltePlugin from 'prettier-plugin-svelte'
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

describe.each([
  {
    parser: 'svelte',
    pluginName: 'prettier-plugin-svelte',
    other: sveltePlugin as Plugin,
    file: 'a.svelte',
    code: '<script>\n  const cls = clsx("p-4 flex");\n</script>\n\n<div class="p-4 flex"></div>\n',
    sorted: '<script>\n  const cls = clsx("flex p-4");\n</script>\n\n<div class="p-4 flex"></div>\n',
  },
  {
    parser: 'astro',
    pluginName: 'prettier-plugin-astro',
    other: astroPlugin as Plugin,
    file: 'a.astro',
    code: '---\nconst cls = clsx("p-4 flex");\n---\n\n<div class="p-4 flex"></div>\n',
    sorted: '---\nconst cls = clsx("flex p-4");\n---\n\n<div class="p-4 flex"></div>\n',
  },
])('$parser', ({ parser, pluginName, other, file, code, sorted }) => {
  it(`needs ${pluginName}`, async () => {
    const options = {
      filepath: at(file),
      plugins: [plugin],
    } as unknown as ParserOptions
    await expect(async () => plugin.parsers[parser]!.parse(code, options))
      .rejects
      .toThrow(`[prettier-plugin-unocss] The \`${parser}\` parser needs ${pluginName}: add it to \`plugins\`, before prettier-plugin-unocss`)
  })

  it(`sorts only scripts when listed before ${pluginName}`, async () => {
    expect(await format(code, {
      filepath: at(file),
      plugins: [plugin, other],
    })).toBe(sorted)
  })

  it(`sorts the markup when listed after ${pluginName}`, async () => {
    expect(await format(code, {
      filepath: at(file),
      plugins: [other, plugin],
    }))
      .toBe(sorted.replace('class="p-4 flex"', 'class="flex p-4"'))
  })
})

describe('attributify in Vue', () => {
  const attributify = (name: string): string => join(configs, 'attributify', name)
  const vue = (markup: string): string => `<template>\n  ${markup}\n</template>\n`

  it('sorts valueless attributes with presetAttributify', async () => {
    expect(await fmt(vue('<div p-4 id="x" flex />'), {
      filepath: attributify('x.vue'),
    }))
      .toBe(vue('<div id="x" flex p-4 />'))
  })

  it('needs presetAttributify', async () => {
    expect(await fmt(vue('<div p-4 flex />'), {
      filepath: at('x.vue'),
    }))
      .toBe(vue('<div p-4 flex />'))
  })

  it('only in Vue templates', async () => {
    expect(await fmt('<div p-4 flex></div>\n', {
      filepath: attributify('x.html'),
    }))
      .toBe('<div p-4 flex></div>\n')
  })

  it('keeps names as written', async () => {
    // The ESLint rule writes them in lowercase: `isopen`
    expect(await fmt(vue('<MyComponent p-4 isOpen flex />'), {
      filepath: attributify('x.vue'),
    }))
      .toBe(vue('<MyComponent isOpen flex p-4 />'))
  })

  it('leaves elements after prettier-ignore-attribute alone', async () => {
    const code = vue('<!-- prettier-ignore-attribute -->\n  <div p-4 flex />')
    expect(await fmt(code, {
      filepath: attributify('x.vue'),
    })).toBe(code)
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

  it('unoVariables', async () => {
    expect(await fmt('const clsA = "p-4 flex";\nconst myStyle = "p-4 flex";', {
      filepath: at('x.ts'),
    }))
      .toBe('const clsA = "flex p-4";\nconst myStyle = "p-4 flex";\n')
    expect(await fmt('const clsA = "p-4 flex";\nconst myStyle = "p-4 flex";', {
      filepath: at('x.ts'),
      unoVariables: ['style$'],
    }))
      .toBe('const clsA = "p-4 flex";\nconst myStyle = "flex p-4";\n')
  })

  it('unoConfig', async () => {
    // The file is next to a config without presets, but unoConfig points to wind3
    const filepath = join(configs, 'project', 'x.ts')
    expect(await fmt('clsx("p-4 flex");', { filepath })).toBe('clsx("p-4 flex");\n')
    expect(await fmt('clsx("p-4 flex");', { filepath, unoConfig: 'test/configs/wind3/uno.config.ts' }))
      .toBe('clsx("flex p-4");\n')
  })
})

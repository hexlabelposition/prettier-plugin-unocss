import type { Options, Plugin } from 'prettier'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ianvs from '@ianvs/prettier-plugin-sort-imports'
import * as trivagoModule from '@trivago/prettier-plugin-sort-imports'
import { format } from 'prettier'
import organize from 'prettier-plugin-organize-imports'
import * as sveltePlugin from 'prettier-plugin-svelte'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index'

// Its types have only named exports, but at runtime it is a CommonJS module:
// the plugin is the default export
const trivago = ((trivagoModule as { default?: Plugin }).default ?? trivagoModule) as Plugin

// Plugins that change the parsers this plugin wraps. With this plugin last,
// the result must be theirs, with classes sorted.

const configs = fileURLToPath(new URL('./configs', import.meta.url))
// Formatted files "live" next to a config with presetWind3
const at = (name: string): string => join(configs, 'wind3', name)

const IMPORTS = 'import { unused } from "./c";\nimport { b } from "./b";\nimport { a } from "./a";\n'

const files = {
  ts: `${IMPORTS}export const x = clsx("p-4 flex", a, b);\n`,
  vue: `<template>\n  <div class="p-4 flex" :class="[a, b]"></div>\n</template>\n\n<script setup lang="ts">\n${IMPORTS}const x = clsx("p-4 flex");\n</script>\n`,
  svelte: `<script lang="ts">\n${IMPORTS}  const x = clsx("p-4 flex");\n</script>\n\n<div class="p-4 flex {a} {b}"></div>\n`,
}

async function check(code: string, filepath: string, others: Plugin[], options: Options = {}): Promise<void> {
  const theirs = await format(code, { ...options, filepath, plugins: others })
  // Their own change happened, otherwise the test checks nothing
  expect(theirs).not.toBe(await format(code, {
    ...options,
    filepath,
    plugins: others.slice(0, -1),
  }))

  const both = await format(code, {
    ...options,
    filepath,
    plugins: [...others, plugin],
  })
  expect(both).toBe(theirs.replaceAll('p-4 flex', 'flex p-4'))
}

describe.each([
  { name: 'prettier-plugin-organize-imports', other: organize as Plugin, vue: true },
  { name: '@ianvs/prettier-plugin-sort-imports', other: ianvs as Plugin, vue: true },
  {
    name: '@trivago/prettier-plugin-sort-imports',
    other: trivago,
    vue: true,
    svelte: true,
  },
])('$name', ({ other, vue, svelte }) => {
  // The sort-imports plugins need an order; `organize` ignores it
  const options = {
    importOrder: ['^[./]'],
  } as Options

  it('keeps its changes in TypeScript', async () => {
    await check(files.ts, at('x.ts'), [other], options)
  })

  it.runIf(vue)('keeps its changes in Vue', async () => {
    await check(files.vue, at('x.vue'), [other], options)
  })

  it.runIf(svelte)('keeps its changes in Svelte', async () => {
    await check(files.svelte, at('x.svelte'), [sveltePlugin as Plugin, other], options)
  })
})

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import * as prettier from 'prettier'

const plugin = fileURLToPath(new URL('../src/index.js', import.meta.url))
// files "live" in playground/, so its uno.config.ts is found
const at = name => fileURLToPath(new URL(`../playground/${name}`, import.meta.url))

const fmt = (code, filepath = at('x.tsx'), extra = {}) =>
  prettier.format(code, { filepath, plugins: [plugin], ...extra })

test('sorts className string', async () => {
  assert.equal(await fmt('<a className="p-4 flex mt-2" />'), '<a className="mt-2 flex p-4" />;\n')
})

test('unknown classes go first, variants last', async () => {
  assert.equal(await fmt('<a className="md:p-8 foo p-4" />'), '<a className="foo p-4 md:p-8" />;\n')
})

test('keeps classes glued to template expressions in place', async () => {
  const out = await fmt('<a className={`p-2 bg-${c}-500 flex`} />')
  assert.match(out, /bg-\$\{c\}-500/)
})

test('sorts tv() values but not keys', async () => {
  const out = await fmt('tv({ base: "p-4 flex", variants: { size: { sm: "text-sm p-1" } } })')
  assert.match(out, /base: "flex p-4"/)
  assert.match(out, /sm: "p-1 text-sm"/)
})

test('works with the babel parser (.js)', async () => {
  assert.equal(await fmt('clsx("p-4 flex")', at('x.js')), 'clsx("flex p-4");\n')
})

test('leaves other attributes and functions alone', async () => {
  const code = '<a title="p-4 flex" data-x={other("p-4 flex")} />;\n'
  assert.equal(await fmt(code), code)
})

test('idempotent', async () => {
  const once = await fmt('<a className="hover:(text-black bg-white) p-4 flex md:mt-2" />')
  assert.equal(await fmt(once), once)
})

test('custom unoFunctions option', async () => {
  assert.equal(await fmt('myCn("p-4 flex")', at('x.ts'), { unoFunctions: ['myCn'] }), 'myCn("flex p-4");\n')
})

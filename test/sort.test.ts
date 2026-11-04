import { createGenerator } from '@unocss/core'
import { presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { sortClasses, sortPreservingEdges } from '../src/sort'

const uno = await createGenerator({
  presets: [
    presetWind3(),
  ],
  shortcuts: { btn: 'px-4 py-2 rounded' },
})

const sort = (classes: string): Promise<string> => sortClasses(classes, uno)

describe('sortClasses', () => {
  it('orders utilities by rule order', async () => {
    expect(await sort('p-4 flex mt-2')).toBe('mt-2 flex p-4')
  })

  it('puts unknown classes first, in their original order', async () => {
    expect(await sort('p-4 zeta flex alpha')).toBe('zeta alpha flex p-4')
  })

  it('puts classes with variants after classes without', async () => {
    expect(await sort('md:p-8 p-4 hover:flex flex')).toBe('flex p-4 hover:flex md:p-8')
  })

  it('puts classes with more variants further back', async () => {
    expect(await sort('md:hover:p-2 hover:p-2 p-2')).toBe('p-2 hover:p-2 md:hover:p-2')
  })

  it('breaks ties alphabetically', async () => {
    expect(await sort('px-4 px-2')).toBe('px-2 px-4')
  })

  it('sorts inside variant groups and keeps them collapsed', async () => {
    expect(await sort('hover:(text-black bg-white) p-4 flex')).toBe('flex p-4 hover:(bg-white text-black)')
  })

  it('puts shortcuts from the config after rules', async () => {
    expect(await sort('btn flex')).toBe('flex btn')
    expect(await sort('hover:btn btn')).toBe('btn hover:btn')
  })

  it('returns an empty string for empty input', async () => {
    expect(await sort('')).toBe('')
    expect(await sort('   ')).toBe('')
  })

  it('normalises extra whitespace', async () => {
    expect(await sort('  p-4   flex\n\tmt-2  ')).toBe('mt-2 flex p-4')
  })

  it('keeps duplicates', async () => {
    expect(await sort('p-4 flex p-4')).toBe('flex p-4 p-4')
    expect(await sort('foo p-4 foo')).toBe('foo foo p-4')
    expect(await sort('hover:(p-4 flex p-4) p-4')).toBe('p-4 hover:(flex p-4 p-4)')
  })

  it('is idempotent', async () => {
    const once = await sort('hover:(text-black bg-white) foo md:mt-2 p-4 flex')
    expect(await sort(once)).toBe(once)
  })

  it('enables `details` on the generator', async () => {
    const fresh = await createGenerator({
      presets: [
        presetWind3(),
      ],
    })
    await sortClasses('p-4', fresh)
    expect(fresh.config.details).toBe(true)
  })
})

describe('sortPreservingEdges', () => {
  const sortEdges = (input: string): Promise<string> => sortPreservingEdges(input, uno)

  it('keeps one space at each edge that had whitespace', async () => {
    expect(await sortEdges(' p-4 flex ')).toBe(' flex p-4 ')
    expect(await sortEdges('p-4 flex ')).toBe('flex p-4 ')
    expect(await sortEdges(' p-4 flex')).toBe(' flex p-4')
    expect(await sortEdges('\n  p-4 flex\n')).toBe(' flex p-4 ')
  })

  it('returns whitespace-only input unchanged', async () => {
    expect(await sortEdges('')).toBe('')
    expect(await sortEdges('  ')).toBe('  ')
  })
})

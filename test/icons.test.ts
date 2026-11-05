import process from 'node:process'
import { createGenerator } from '@unocss/core'
import { presetIcons } from 'unocss'
import { afterEach, describe, expect, it } from 'vitest'
import { createLikeEslint } from '../src/icons'

const original = process.env.ESLINT

afterEach(() => {
  if (original === undefined)
    delete process.env.ESLINT
  else
    process.env.ESLINT = original
})

function createIcons() {
  return createGenerator({
    presets: [
      presetIcons({
        collections: {
          custom: { dot: '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>' },
        },
      }),
    ],
  })
}

describe('createLikeEslint', () => {
  it('does not load icons from installed collections', async () => {
    delete process.env.ESLINT
    const uno = await createLikeEslint(createIcons)
    expect(await uno.parseToken('i-svg-spinners-180-ring')).toBeUndefined()
    // Without the wrapper the installed collection is loaded
    expect(await (await createIcons()).parseToken('i-svg-spinners-180-ring')).toBeDefined()
  })

  it('still loads icons from custom collections', async () => {
    const uno = await createLikeEslint(createIcons)
    expect(await uno.parseToken('i-custom-dot')).toBeDefined()
  })

  it('sets ESLINT only while creating the generator', async () => {
    delete process.env.ESLINT
    let during: string | undefined
    await createLikeEslint(async () => {
      during = process.env.ESLINT
      return createIcons()
    })
    expect(during).toBe('true')
    expect('ESLINT' in process.env).toBe(false)
  })

  it('keeps an ESLINT value that was already set', async () => {
    process.env.ESLINT = 'yes'
    await createLikeEslint(async () => {
      expect(process.env.ESLINT).toBe('yes')
      return createIcons()
    })
    expect(process.env.ESLINT).toBe('yes')
  })

  it('keeps ESLINT until the last of overlapping loads ends', async () => {
    delete process.env.ESLINT
    let finishFirst!: () => void
    const first = createLikeEslint(async () => {
      await new Promise<void>(resolve => finishFirst = resolve)
      return createIcons()
    })
    let during: string | undefined
    const second = createLikeEslint(async () => {
      await first
      during = process.env.ESLINT
      return createIcons()
    })
    finishFirst()
    await Promise.all([first, second])
    expect(during).toBe('true')
    expect('ESLINT' in process.env).toBe(false)
  })

  it('restores ESLINT when creating fails', async () => {
    delete process.env.ESLINT
    await expect(createLikeEslint(async () => {
      throw new Error('broken')
    })).rejects.toThrow('broken')
    expect('ESLINT' in process.env).toBe(false)
  })
})

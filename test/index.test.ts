import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index'

describe('plugin entry', () => {
  it('exports parsers and options', () => {
    expect(plugin.parsers).toBeTypeOf('object')
    expect(plugin.options).toBeTypeOf('object')
  })
})

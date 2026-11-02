import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  // Reference JS implementation, removed at the end of U1.
  ignores: ['prototype'],
})

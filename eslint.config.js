import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  ignores: [
    // Reference JS implementation, removed at the end of U1.
    'prototype',
    // Deliberately unsorted input for `pnpm play`.
    'playground/example.*',
  ],
})

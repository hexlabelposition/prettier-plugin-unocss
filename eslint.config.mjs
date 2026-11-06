import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  ignores: [
    // Formatter input and expected output, compared byte for byte.
    'test/fixtures/*/**',
    // Deliberately unsorted input for `pnpm play`.
    'playground/example.*',
  ],
}, {
  // The benchmark prints its results
  files: ['bench/**'],
  rules: { 'no-console': 'off' },
})

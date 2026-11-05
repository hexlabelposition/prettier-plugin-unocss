// Plugins without type declarations, used in tests

declare module 'prettier-plugin-organize-imports' {
  import type { Plugin } from 'prettier'

  const plugin: Plugin
  export default plugin
}

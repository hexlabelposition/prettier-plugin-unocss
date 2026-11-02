import type { SupportOption } from 'prettier'

/** Options this plugin adds to Prettier. */
export interface PluginOptions {
  /**
   * Path to the UnoCSS config file, resolved from the current working
   * directory. By default `uno.config.*` / `unocss.config.*` is searched for
   * starting from the formatted file's directory.
   */
  unoConfig?: string
  /**
   * JSX attributes whose value is sorted.
   * @default ['class', 'className']
   */
  unoAttributes?: string[]
  /**
   * Functions whose string arguments are sorted.
   * @default ['clsx', 'cn', 'cx', 'classnames', 'tv', 'cva']
   */
  unoFunctions?: string[]
}

// Typed options in `prettier.config.ts`:
// `const config: Config = { plugins: ['prettier-plugin-unocss'], unoFunctions: [...] }`
declare module 'prettier' {
  interface Options extends PluginOptions {}
}

export const DEFAULT_ATTRIBUTES: string[] = ['class', 'className']

export const DEFAULT_FUNCTIONS: string[] = [
  'clsx',
  'cn',
  'cx',
  'classnames',
  'tv',
  'cva',
]

export const options: Record<keyof PluginOptions, SupportOption> = {
  unoConfig: {
    type: 'string',
    category: 'UnoCSS',
    description: 'Path to the UnoCSS config file (searched from the formatted file by default)',
  },
  unoAttributes: {
    type: 'string',
    array: true,
    default: [
      { value: DEFAULT_ATTRIBUTES },
    ],
    category: 'UnoCSS',
    description: 'JSX attributes whose value is sorted',
  },
  unoFunctions: {
    type: 'string',
    array: true,
    default: [
      { value: DEFAULT_FUNCTIONS },
    ],
    category: 'UnoCSS',
    description: 'Functions whose string arguments are sorted',
  },
}

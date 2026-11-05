// Formats code the way a project using the UnoCSS ESLint `order` rule would:
// `eslint --fix`, then Prettier without this plugin. Used to check that this
// plugin gives the same result.

import type { Options } from 'prettier'
import { dirname } from 'node:path'
import tsParser from '@typescript-eslint/parser'
import unocss from '@unocss/eslint-plugin'
import { Linter } from 'eslint'
import { format } from 'prettier'
import vueParser from 'vue-eslint-parser'
import * as plugin from '../src/index'
import { DEFAULT_FUNCTIONS } from '../src/options'

export interface CompareOptions {
  filepath: string
  configPath: string
  unoFunctions?: string[]
  unoVariables?: string[]
}

export async function formatWithEslint(code: string, options: CompareOptions): Promise<string> {
  // Flat config only matches files under `cwd`
  const linter = new Linter({
    configType: 'flat',
    cwd: dirname(options.filepath),
  })
  const { output, messages } = linter.verifyAndFix(code, [
    {
      files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}'],
      languageOptions: options.filepath.endsWith('.vue')
        ? {
            parser: vueParser,
            parserOptions: { parser: tsParser },
          }
        : {
            parser: tsParser,
            parserOptions: {
              ecmaFeatures: { jsx: true },
            },
          },
      // Otherwise `eslint-disable` comments for other rules are removed
      linterOptions: { reportUnusedDisableDirectives: 'off' },
      plugins: { unocss: unocss as any },
      settings: {
        unocss: { configPath: options.configPath },
      },
      rules: {
        'unocss/order': [
          'error',
          {
            // Ours by default; the rule's own are `clsx`, `classnames`
            unoFunctions: options.unoFunctions ?? DEFAULT_FUNCTIONS,
            ...options.unoVariables && { unoVariables: options.unoVariables },
          },
        ],
      },
    },
  ], { filename: options.filepath })

  // Fatal: a parsing error. No rule id: the config didn't apply to the file,
  // so the rule silently did nothing
  const problem = messages.find(message => message.fatal || !message.ruleId)
  if (problem)
    throw new Error(`ESLint: ${problem.message}`)

  return format(output, { filepath: options.filepath })
}

export async function formatWithPlugin(code: string, options: CompareOptions): Promise<string> {
  const prettierOptions: Options = {
    filepath: options.filepath,
    plugins: [plugin],
    unoConfig: options.configPath,
  }
  if (options.unoFunctions)
    prettierOptions.unoFunctions = options.unoFunctions
  if (options.unoVariables)
    prettierOptions.unoVariables = options.unoVariables
  return format(code, prettierOptions)
}

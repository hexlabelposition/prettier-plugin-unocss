import type { Parser, ParserOptions } from 'prettier'
import type { PluginOptions } from './options'
import { parsers as acornParsers } from 'prettier/plugins/acorn'
import { parsers as babelParsers } from 'prettier/plugins/babel'
import { parsers as meriyahParsers } from 'prettier/plugins/meriyah'
import { parsers as typescriptParsers } from 'prettier/plugins/typescript'
import { getGenerator } from './generator'
import { DEFAULT_ATTRIBUTES, DEFAULT_FUNCTIONS } from './options'
import { sortClassesInAst } from './transform'

type Options = ParserOptions & PluginOptions

/**
 * Wraps a built-in parser: the original parser builds the AST, then class
 * strings in it are sorted, and Prettier's own printer formats the result.
 * The same approach as `prettier-plugin-tailwindcss`.
 */
export function withSorting(parser: Parser): Parser {
  return {
    ...parser,
    async parse(text, options: Options) {
      const ast = await parser.parse(text, options)
      const uno = await getGenerator({ filepath: options.filepath, unoConfig: options.unoConfig })
      // No config: leave the file untouched
      if (uno) {
        await sortClassesInAst(ast, uno, {
          attributes: options.unoAttributes ?? DEFAULT_ATTRIBUTES,
          functions: options.unoFunctions ?? DEFAULT_FUNCTIONS,
        })
      }
      return ast
    },
  }
}

export const parsers: Record<string, Parser> = {
  'babel': withSorting(babelParsers.babel),
  'babel-ts': withSorting(babelParsers['babel-ts']),
  'typescript': withSorting(typescriptParsers.typescript),
  'acorn': withSorting(acornParsers.acorn),
  'espree': withSorting(acornParsers.espree),
  'meriyah': withSorting(meriyahParsers.meriyah),
}

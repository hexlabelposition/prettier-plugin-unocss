import type { Parser, ParserOptions } from 'prettier'
import type { PluginOptions } from './options'
import type { ExpressionParser } from './transform/vue'
import { parsers as acornParsers } from 'prettier/plugins/acorn'
import { parsers as babelParsers } from 'prettier/plugins/babel'
import { parsers as htmlParsers } from 'prettier/plugins/html'
import { parsers as meriyahParsers } from 'prettier/plugins/meriyah'
import { parsers as typescriptParsers } from 'prettier/plugins/typescript'
import { getGenerator } from './generator'
import { DEFAULT_ATTRIBUTES, DEFAULT_FUNCTIONS, DEFAULT_VARIABLES } from './options'
import { sortClassesInAst } from './transform'
import { sortClassesInHtmlAst } from './transform/html'
import { sortClassesInVueAst } from './transform/vue'

type Options = ParserOptions & PluginOptions

/**
 * Wraps a built-in parser: the original parser builds the AST, then class
 * strings in it are sorted, and Prettier's own printer formats the result.
 * The same approach as `prettier-plugin-tailwindcss`.
 */
export function withSorting(parser: Parser, sort: typeof sortClassesInAst = sortClassesInAst): Parser {
  return {
    ...parser,
    async parse(text, options: Options) {
      const ast = await parser.parse(text, options)
      const uno = await getGenerator({ filepath: options.filepath, unoConfig: options.unoConfig })
      // No config: leave the file untouched
      if (uno) {
        await sort(ast, uno, {
          attributes: options.unoAttributes ?? DEFAULT_ATTRIBUTES,
          functions: options.unoFunctions ?? DEFAULT_FUNCTIONS,
          variables: options.unoVariables ?? DEFAULT_VARIABLES,
        })
      }
      return ast
    },
  }
}

/**
 * Prettier's own parsers for the expressions in Vue attributes. They are not
 * wrapped: they parse every binding (`:title`, `v-if`, …), without knowing
 * the attribute, so `:class` values are sorted by the `vue` parser instead.
 */
function vueExpressionParser(typescript: boolean): ExpressionParser {
  const parser = typescript
    ? babelParsers.__vue_ts_expression
    : babelParsers.__vue_expression
  return {
    parse: text => parser.parse(text, {} as ParserOptions),
    locStart: node => parser.locStart(node),
    locEnd: node => parser.locEnd(node),
  }
}

export const parsers: Record<string, Parser> = {
  'babel': withSorting(babelParsers.babel),
  'babel-ts': withSorting(babelParsers['babel-ts']),
  'typescript': withSorting(typescriptParsers.typescript),
  'acorn': withSorting(acornParsers.acorn),
  'espree': withSorting(acornParsers.espree),
  'meriyah': withSorting(meriyahParsers.meriyah),
  'html': withSorting(htmlParsers.html, sortClassesInHtmlAst),
  'vue': withSorting(htmlParsers.vue, (ast, uno, options) => sortClassesInVueAst(ast, uno, {
    ...options,
    expressionParser: vueExpressionParser,
  })),
}

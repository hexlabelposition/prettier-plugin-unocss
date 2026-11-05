import type { Parser, ParserOptions } from 'prettier'
import type { PluginOptions } from './options'
import type { CollectOptions } from './transform'
import type { ExpressionParser } from './transform/vue'
import { parsers as acornParsers } from 'prettier/plugins/acorn'
import { parsers as babelParsers } from 'prettier/plugins/babel'
import { parsers as htmlParsers } from 'prettier/plugins/html'
import { parsers as meriyahParsers } from 'prettier/plugins/meriyah'
import { parsers as typescriptParsers } from 'prettier/plugins/typescript'
import { getGenerator } from './generator'
import { DEFAULT_ATTRIBUTES, DEFAULT_FUNCTIONS, DEFAULT_VARIABLES } from './options'
import { applyEdits, sortClassesInAst } from './transform'
import { sortClassesInHtmlAst } from './transform/html'
import { svelteClassEdits } from './transform/svelte'
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
      if (uno)
        await sort(ast, uno, collectOptions(options))
      return ast
    },
  }
}

function collectOptions(options: Options): CollectOptions {
  return {
    attributes: options.unoAttributes ?? DEFAULT_ATTRIBUTES,
    functions: options.unoFunctions ?? DEFAULT_FUNCTIONS,
    variables: options.unoVariables ?? DEFAULT_VARIABLES,
  }
}

const PREFIX = '[prettier-plugin-unocss]'

/**
 * The parser another plugin registers under `name`, found in the plugins
 * Prettier loaded for this file. Plugins are not imported here: the user's
 * own installation is used, and they stay optional dependencies.
 */
function otherPluginParser(name: string, self: Parser, options: Options, pluginName: string): Parser {
  for (const plugin of options.plugins ?? []) {
    if (typeof plugin !== 'object' || plugin instanceof URL)
      continue
    const parser = plugin.parsers?.[name]
    if (parser && parser !== self)
      return parser
  }
  throw new Error(`${PREFIX} The \`${name}\` parser needs ${pluginName}: add it to \`plugins\`, before prettier-plugin-unocss`)
}

/**
 * Wraps the `svelte` parser of `prettier-plugin-svelte`. Prettier uses the
 * parser of the last plugin that registers a name, so this plugin must come
 * after it in `plugins`; its printer (`svelte-ast`) is used as is.
 *
 * The Svelte printer prints expressions from the source text, not from the
 * AST, so class changes are applied to the text, which is then parsed again
 * and becomes `options.originalText` (the Svelte parser's own `preprocess`
 * sets it too).
 */
function svelteParser(): Parser {
  const self: Parser = {
    astFormat: 'svelte-ast',
    locStart: node => node.start,
    locEnd: node => node.end,
    preprocess(text, options: Options) {
      const parser = otherPluginParser('svelte', self, options, 'prettier-plugin-svelte')
      return parser.preprocess
        ? parser.preprocess(text, options)
        : text
    },
    async parse(text, options: Options) {
      const parser = otherPluginParser('svelte', self, options, 'prettier-plugin-svelte')
      const ast = await parser.parse(text, options)
      const uno = await getGenerator({ filepath: options.filepath, unoConfig: options.unoConfig })
      if (!uno)
        return ast
      const edits = await svelteClassEdits(ast, text, uno, collectOptions(options))
      if (!edits.length)
        return ast
      const sorted = applyEdits(text, edits)
      const sortedAst = await parser.parse(sorted, options)
      options.originalText = sorted
      return sortedAst
    },
  }
  return self
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
  'svelte': svelteParser(),
  'vue': withSorting(htmlParsers.vue, (ast, uno, options) => sortClassesInVueAst(ast, uno, {
    ...options,
    expressionParser: vueExpressionParser,
  })),
}

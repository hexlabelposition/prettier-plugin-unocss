import type { UnoGenerator } from '@unocss/core'
import type { Parser, ParserOptions, Plugin } from 'prettier'
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
import { sortClassesInAstroAst } from './transform/astro'
import { sortClassesInHtmlAst } from './transform/html'
import { svelteClassEdits } from './transform/svelte'
import { sortClassesInVueAst } from './transform/vue'

type Options = ParserOptions & PluginOptions

const PREFIX = '[prettier-plugin-unocss]'

/**
 * Sorts the classes in the AST `parser` built from `text`; returns the AST
 * to print (the same one, changed in place, or a new one).
 */
type Sort = (ast: unknown, uno: UnoGenerator, options: Options, parser: Parser, text: string) => Promise<unknown>

interface WrapOptions {
  /** The parser name. */
  name: string
  /** Prettier's own parser of that name. */
  builtin?: Parser
  /** The plugin that provides the parser, when Prettier has none. */
  pluginName?: string
  /** The AST format of that plugin's parser; its printer is used as is. */
  astFormat?: string
  sort: Sort
}

function collectOptions(options: Options): CollectOptions {
  return {
    attributes: options.unoAttributes ?? DEFAULT_ATTRIBUTES,
    functions: options.unoFunctions ?? DEFAULT_FUNCTIONS,
    variables: options.unoVariables ?? DEFAULT_VARIABLES,
  }
}

/** A parser, or a function that loads it (Prettier's own plugins). */
type ParserEntry = Parser | (() => Promise<Parser>)

function parserOf(plugin: string | URL | Plugin, name: string): ParserEntry | undefined {
  if (typeof plugin !== 'object' || plugin instanceof URL)
    return undefined
  try {
    return plugin.parsers?.[name] as ParserEntry | undefined
  }
  catch {
    // A lazy parser that needs a missing plugin, like `svelte` in
    // `@ianvs/prettier-plugin-sort-imports` without `prettier-plugin-svelte`
    return undefined
  }
}

/**
 * The parser this plugin builds on: the parser of the same name from the
 * last plugin before this one in `options.plugins` (the plugins Prettier
 * loaded for the file: its own first, then the user's), or Prettier's own.
 *
 * So plugins that change a parser, like the import sorters, keep working
 * when this plugin comes after them: their `preprocess` and `parse` run
 * first, then classes are sorted. Plugins after this one are not looked at,
 * so two plugins doing the same can't call each other in a loop.
 */
async function baseParser(self: Parser, options: Options, { name, builtin, pluginName }: WrapOptions): Promise<Parser> {
  const plugins = options.plugins ?? []
  const own = plugins.findIndex(plugin => parserOf(plugin, name) === self)
  const end = own === -1
    ? plugins.length
    : own
  for (let i = end - 1; i >= 0; i--) {
    const parser = parserOf(plugins[i]!, name)
    // Prettier's own plugins load their parsers lazily
    if (typeof parser === 'function')
      return parser()
    if (parser && parser !== self)
      return parser
  }
  if (builtin)
    return builtin
  throw new Error(`${PREFIX} The \`${name}\` parser needs ${pluginName}: add it to \`plugins\`, before prettier-plugin-unocss`)
}

/**
 * Registers a parser under the name of an existing one: the base parser (see
 * {@link baseParser}) builds the AST, then classes are sorted in it and the
 * base plugin's printer formats the result. Prettier uses the parser of the
 * last plugin that registers a name, so this plugin must be the last one.
 */
function wrapParser(wrap: WrapOptions): Parser {
  const self: Parser = {
    ...wrap.builtin,
    astFormat: wrap.builtin?.astFormat ?? wrap.astFormat!,
    // All Svelte and Astro AST nodes have `start` / `end` offsets
    locStart: wrap.builtin?.locStart ?? (node => node.start),
    locEnd: wrap.builtin?.locEnd ?? (node => node.end),
    // Prettier awaits `preprocess`, although its type says it's synchronous
    preprocess: (async (text: string, options: Options) => {
      const parser = await baseParser(self, options, wrap)
      return parser.preprocess
        ? parser.preprocess(text, options)
        : text
    }) as unknown as Parser['preprocess'],
    async parse(text, options: Options) {
      const parser = await baseParser(self, options, wrap)
      const ast = await parser.parse(text, options)
      const uno = await getGenerator({ filepath: options.filepath, unoConfig: options.unoConfig })
      // No config: leave the file untouched
      return uno
        ? wrap.sort(ast, uno, options, parser, text)
        : ast
    },
  }
  return self
}

/** Sorts in place, for printers that print from the AST. */
function inPlace(sort: (ast: unknown, uno: UnoGenerator, options: CollectOptions) => Promise<void>): Sort {
  return async (ast, uno, options) => {
    await sort(ast, uno, collectOptions(options))
    return ast
  }
}

function builtinParser(name: string, builtin: Parser, sort = inPlace(sortClassesInAst)): Parser {
  return wrapParser({ name, builtin, sort })
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

/**
 * Svelte, with `prettier-plugin-svelte`. Its printer prints expressions from
 * the source text, not from the AST, so class changes are applied to the
 * text, which is then parsed again and becomes `options.originalText` (the
 * Svelte parser's own `preprocess` sets it too).
 */
const svelteParser = wrapParser({
  name: 'svelte',
  pluginName: 'prettier-plugin-svelte',
  astFormat: 'svelte-ast',
  async sort(ast, uno, options, parser, text) {
    const edits = await svelteClassEdits(ast, text, uno, collectOptions(options))
    if (!edits.length)
      return ast
    const sorted = applyEdits(text, edits)
    const sortedAst = await parser.parse(sorted, options)
    options.originalText = sorted
    return sortedAst
  },
})

/**
 * Astro, with `prettier-plugin-astro`. Its printer prints the markup from the
 * AST (a JSX AST, with Prettier's estree printer), so it is sorted in place
 * like JSX.
 */
const astroParser = wrapParser({
  name: 'astro',
  pluginName: 'prettier-plugin-astro',
  astFormat: 'astro',
  sort: inPlace(sortClassesInAstroAst),
})

export const parsers: Record<string, Parser> = {
  'babel': builtinParser('babel', babelParsers.babel),
  'babel-ts': builtinParser('babel-ts', babelParsers['babel-ts']),
  'typescript': builtinParser('typescript', typescriptParsers.typescript),
  'acorn': builtinParser('acorn', acornParsers.acorn),
  'espree': builtinParser('espree', acornParsers.espree),
  'meriyah': builtinParser('meriyah', meriyahParsers.meriyah),
  'html': builtinParser('html', htmlParsers.html, inPlace(sortClassesInHtmlAst)),
  'vue': builtinParser('vue', htmlParsers.vue, inPlace((ast, uno, options) => sortClassesInVueAst(ast, uno, {
    ...options,
    expressionParser: vueExpressionParser,
  }))),
  'svelte': svelteParser,
  'astro': astroParser,
}

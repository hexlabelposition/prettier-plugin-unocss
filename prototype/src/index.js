import { parsers as babelParsers } from 'prettier/plugins/babel'
import { parsers as tsParsers } from 'prettier/plugins/typescript'
import { getGenerator } from './generator.js'
import { sortClasses, sortPreservingEdges } from './sort.js'

/** @type {import('prettier').SupportOptions} */
export const options = {
  unoConfig: {
    type: 'string',
    category: 'UnoCSS',
    description: 'Path to uno.config.* (by default it is searched from the file folder up)',
  },
  unoAttributes: {
    type: 'string',
    array: true,
    default: [{ value: ['class', 'className'] }],
    category: 'UnoCSS',
    description: 'JSX attributes whose classes are sorted',
  },
  unoFunctions: {
    type: 'string',
    array: true,
    default: [{ value: ['clsx', 'cn', 'cx', 'classnames', 'tv', 'cva'] }],
    category: 'UnoCSS',
    description: 'Functions whose string arguments are sorted',
  },
}

/**
 * The trick (same as prettier-plugin-tailwindcss): take a built-in parser,
 * let it build the AST, rewrite class strings inside the AST,
 * and hand it back to Prettier's normal printer.
 */
function withSorting(parser) {
  return {
    ...parser,
    async parse(text, opts) {
      const ast = await parser.parse(text, opts)
      const uno = await getGenerator(opts)
      if (uno)
        await sortInAst(ast, uno, opts)
      return ast
    },
  }
}

export const parsers = {
  'babel': withSorting(babelParsers.babel),
  'babel-ts': withSorting(babelParsers['babel-ts']),
  'typescript': withSorting(tsParsers.typescript),
}

// ---------------------------------------------------------------------------

const SKIP_KEYS = new Set(['loc', 'range', 'start', 'end', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'extra', 'parent'])

function walk(node, visit) {
  if (!node || typeof node !== 'object')
    return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  if (typeof node.type === 'string' && visit(node) === false)
    return
  for (const key of Object.keys(node)) {
    if (!SKIP_KEYS.has(key))
      walk(node[key], visit)
  }
}

/** Babel calls it StringLiteral, typescript-estree calls it Literal */
const isString = n => n && (n.type === 'StringLiteral' || (n.type === 'Literal' && typeof n.value === 'string'))

/**
 * Collect every string that holds classes, then sort them one by one.
 * (Sorting is async, so collecting first keeps the walk simple.)
 */
async function sortInAst(ast, uno, opts) {
  const attrs = new Set(opts.unoAttributes)
  const fns = new Set(opts.unoFunctions)
  const strings = []
  const templates = []

  // Everything with classes inside a "class context": clsx('a', cond && 'b', { 'c d': x }),
  // tv({ base: '...', variants: { size: { sm: '...' } } }) etc.
  // We take string *values*, not object keys like `base`, except clsx-style object keys,
  // which ARE classes; to keep the prototype simple we leave keys alone.
  const collectClassValues = (node) => {
    walk(node, (n) => {
      if (isString(n)) {
        strings.push(n)
        return false
      }
      if (n.type === 'TemplateLiteral') {
        templates.push(n)
        return false
      }
      if (n.type === 'Property' || n.type === 'ObjectProperty') {
        collectClassValues(n.value) // skip the key
        return false
      }
    })
  }

  walk(ast, (n) => {
    // <div className="..." /> and <div className={'...'} /> / {`...`}
    if (n.type === 'JSXAttribute' && attrs.has(n.name?.name)) {
      const v = n.value?.type === 'JSXExpressionContainer' ? n.value.expression : n.value
      if (v)
        collectClassValues(v)
      return false
    }
    // clsx(...), tv({...})
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && fns.has(n.callee.name)) {
      collectClassValues(n.arguments)
      return false
    }
    // tw`...`
    if (n.type === 'TaggedTemplateExpression' && n.tag?.type === 'Identifier' && fns.has(n.tag.name)) {
      templates.push(n.quasi)
      return false
    }
  })

  for (const node of strings) {
    if (/['"\\]/.test(node.value))
      continue // quotes/escapes inside: skip rather than risk breaking the string
    const sorted = await sortPreservingEdges(node.value, uno)
    if (sorted !== node.value)
      setStringValue(node, sorted)
  }
  for (const tpl of templates)
    await sortTemplate(tpl, uno)
}

/**
 * Printers read the raw source text (to keep the original quotes and escapes),
 * so changing `value` alone is not enough.
 */
function setStringValue(node, value) {
  const raw = node.extra?.raw ?? node.raw
  const quote = raw?.[0] === '\'' || raw?.[0] === '"' ? raw[0] : '"'
  const newRaw = quote + value + quote
  node.value = value
  if (node.extra) {
    node.extra.raw = newRaw
    node.extra.rawValue = value
  }
  if ('raw' in node)
    node.raw = newRaw
}

/**
 * `p-2 bg-${color} mt-1`: the chunk "bg-" is glued to an expression,
 * so it must stay exactly where it is. Only whole classes are sorted.
 */
async function sortTemplate(tpl, uno) {
  const last = tpl.quasis.length - 1
  for (const [i, quasi] of tpl.quasis.entries()) {
    const raw = quasi.value.raw
    if (!raw.trim())
      continue

    const gluedLeft = i > 0 && !/^\s/.test(raw) // `${x}-foo bar`
    const gluedRight = i < last && !/\s$/.test(raw) // `bar foo-${x}`

    let head = ''
    let tail = ''
    let body = raw
    if (gluedLeft) {
      const m = body.match(/^\S+/)
      head = m[0]
      body = body.slice(head.length)
    }
    if (gluedRight) {
      const m = body.match(/\S+$/)
      if (m) {
        tail = m[0]
        body = body.slice(0, -tail.length)
      }
    }
    if (body.includes('\\'))
      continue // escapes: not worth the risk in a prototype

    const sorted = head + (await sortPreservingEdges(body, uno)) + tail
    if (sorted !== raw) {
      quasi.value.raw = sorted
      quasi.value.cooked = sorted
    }
  }
}

export { sortClasses }

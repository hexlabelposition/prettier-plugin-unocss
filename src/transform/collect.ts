import type { AstNode } from './walk'
import { isNode, walk } from './walk'

/** Babel `StringLiteral` or ESTree `Literal` with a string value. */
export interface StringLiteralNode extends AstNode {
  type: 'StringLiteral' | 'Literal'
  value: string
  raw?: string
  extra?: { raw?: string, rawValue?: unknown }
}

export interface TemplateElementNode extends AstNode {
  type: 'TemplateElement'
  value: { raw: string, cooked?: string | null }
}

export interface TemplateLiteralNode extends AstNode {
  type: 'TemplateLiteral'
  quasis: TemplateElementNode[]
  expressions: AstNode[]
}

export type CollectRoot = 'program' | 'class-value' | 'class-string'

export interface CollectOptions {
  /** JSX attributes whose value holds classes (`unoAttributes`). */
  attributes: readonly string[]
  /** Functions whose arguments hold classes (`unoFunctions`). */
  functions: readonly string[]
  /**
   * JSX attributes whose value is a clsx-like class value: object keys are
   * classes too. Astro's `class:list`; not an option for users.
   */
  listAttributes?: readonly string[]
  /**
   * Regular expressions (case-insensitive) for variable names whose value
   * holds classes (`unoVariables`). Optional: no variables by default.
   */
  variables?: readonly string[]
}

/**
 * The class keys of one object (`clsx({ 'p-4 flex': on })`) and the static
 * names of its other keys. Keys are sorted as a group: if sorting would make
 * two keys equal, the later one would override the earlier one, so the whole
 * group is left alone.
 */
export interface KeyGroup {
  /** Static class keys: `'a b'`, `['a b']`, `` [`a b`] ``. */
  keys: (StringLiteralNode | TemplateLiteralNode)[]
  /** Names of the other static keys (`flex`, `1`, quoted strings with escapes). */
  names: string[]
}

export interface ClassNodes {
  strings: StringLiteralNode[]
  templates: TemplateLiteralNode[]
  keyGroups: KeyGroup[]
  /** Strings that are JSX attribute values: HTML entities instead of escapes. */
  jsxStrings: Set<StringLiteralNode>
  /** Templates of `` String.raw`…` ``: their value is the raw text. */
  stringRawTemplates: Set<TemplateLiteralNode>
}

export function isStringLiteral(node: AstNode): node is StringLiteralNode {
  return node.type === 'StringLiteral'
    || (node.type === 'Literal' && typeof node.value === 'string')
}

function isTemplateLiteral(node: unknown): node is TemplateLiteralNode {
  return isNode(node) && node.type === 'TemplateLiteral'
}

function identifierName(node: unknown): string | undefined {
  return isNode(node) && node.type === 'Identifier' && typeof node.name === 'string'
    ? node.name
    : undefined
}

function compileVariables(patterns: readonly string[]): RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, 'i')
    }
    catch (error) {
      throw new Error(`[prettier-plugin-unocss] Invalid regular expression in unoVariables: ${JSON.stringify(pattern)}`, { cause: error })
    }
  })
}

type FunctionNode = AstNode & { body: unknown }

function isFunction(node: AstNode): node is FunctionNode {
  return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'
}

/** `String.raw`, but not `String['raw']` or `obj.String.raw`. */
function isStringRaw(node: unknown): boolean {
  return isNode(node)
    && node.type === 'MemberExpression'
    && !node.computed
    && identifierName(node.object) === 'String'
    && identifierName(node.property) === 'raw'
}

/** `class` / `className`; namespaced names like `xlink:href` are not identifiers. */
function jsxAttributeName(node: AstNode): string | undefined {
  return isNode(node.name) && node.name.type === 'JSXIdentifier' && typeof node.name.name === 'string'
    ? node.name.name
    : undefined
}

// Type-only wrappers around a value: `x as T`, `x satisfies T`, `x!`, `<T>x`, `(x: T)`
const TRANSPARENT_TYPES = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TypeCastExpression',
  'ParenthesizedExpression',
])

/**
 * Functions whose object keys are names (`base`, `variants`, `sm`), not
 * classes: `tv` from tailwind-variants and `cva` from class-variance-authority.
 * In every other function from `functions`, keys are classes, like in `clsx`.
 */
const VARIANT_FUNCTIONS = new Set(['tv', 'cva'])

function isProperty(node: AstNode): boolean {
  return node.type === 'Property' || node.type === 'ObjectProperty'
}

/**
 * Whether the `i`-th expression of a template stands apart from its
 * neighbours: whitespace or the template's edge on both sides. Otherwise its
 * value is glued to text or another expression (`bg-${c}`, `${a}${b}`).
 */
function isSeparatedExpression(node: TemplateLiteralNode, i: number): boolean {
  const before = node.quasis[i]?.value.raw
  const after = node.quasis[i + 1]?.value.raw
  if (before === undefined || after === undefined)
    return false
  const left = i === 0
    ? before === '' || /\s$/.test(before)
    : /\s$/.test(before)
  const right = i + 1 === node.quasis.length - 1
    ? after === '' || /^\s/.test(after)
    : /^\s/.test(after)
  return left && right
}

function isSimpleTemplate(node: unknown): node is TemplateLiteralNode {
  return isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1
}

/**
 * A key that can hold classes and whose value is known statically: `'a b'`,
 * `['a b']` or `` [`a b`] ``. Identifier keys (`{ flex: on }`) are single
 * classes; dynamic keys (`[c ? 'a' : 'b']`) can't be checked for collisions.
 */
function classKey(property: AstNode): StringLiteralNode | TemplateLiteralNode | undefined {
  const key = property.key
  if (!isNode(key))
    return undefined
  if (isStringLiteral(key))
    return key
  if (property.computed && isSimpleTemplate(key))
    return key
  return undefined
}

/** The name of a key known statically, for collision checks. */
function staticKeyName(property: AstNode): string | undefined {
  const key = property.key
  if (!isNode(key))
    return undefined
  if (!property.computed && key.type === 'Identifier')
    return identifierName(key)
  if (isStringLiteral(key))
    return key.value
  if ((key.type === 'NumericLiteral' || key.type === 'Literal') && typeof key.value === 'number')
    return String(key.value)
  if (property.computed && isSimpleTemplate(key))
    return key.quasis[0]!.value.cooked ?? undefined
  return undefined
}

/**
 * Finds every string and template literal that holds classes:
 *
 * - the value of a JSX attribute from `attributes`;
 * - an argument of a call to a function from `functions`;
 * - the template of a tagged template whose tag is in `functions`;
 * - the value of a variable whose name matches `variables`.
 *
 * Inside such a class context, classes are taken from the branches of
 * conditionals (`c ? 'a' : 'b'`, not the test), both sides of logical
 * expressions (`c && 'a'`), array elements and object property **values**
 * (and keys, see below) and template expressions separated from their
 * neighbours by whitespace (`` `p-4 ${on ? 'a b' : ''}` ``), recursively.
 * `` String.raw`…` `` is treated like a plain template literal.
 * Any other expression (`a === 'x'`, `other('x')`, `obj['x']`, the glued
 * `` `bg-${c ? 'red' : 'blue'}` ``) is not a class position;
 * its strings are left alone, but it is still searched for nested class
 * contexts such as `clsx(…)`.
 *
 * Object keys are classes inside clsx-like functions (`clsx({ 'p-4': on })`),
 * but names everywhere else: in `tv({ base: '…' })`, `cva(…)` and JSX
 * attributes they are left alone.
 *
 * `root` says what `ast` is:
 *
 * - `program`: code, searched for class contexts;
 * - `class-value`: a class value itself, like the value of Vue's `:class`
 *   or Svelte's `class={…}`: its strings are classes, and so are object keys
 *   (`{ 'p-4 flex': on }`), as in clsx-like functions;
 * - `class-string`: a class value that is turned into a string, like
 *   `{…}` in Svelte's `class="p-4 {…}"`: object keys are not classes there.
 *
 * Nodes are collected first and rewritten later, because sorting is async and
 * mutating the AST while walking it is error-prone.
 */
export function collectClassNodes(ast: unknown, options: CollectOptions, root: CollectRoot = 'program'): ClassNodes {
  const attributes = new Set(options.attributes)
  const functions = new Set(options.functions)
  const listAttributes = new Set(options.listAttributes)
  const variables = compileVariables(options.variables ?? [])
  const result: ClassNodes = {
    strings: [],
    templates: [],
    keyGroups: [],
    jsxStrings: new Set(),
    stringRawTemplates: new Set(),
  }

  /**
   * The value of a class variable, as in the ESLint rule: a class value, an
   * object whose values are class variable values (`{ button: '…' }`), or a
   * function returning one (`(on) => on ? '…' : '…'`). Calls of functions
   * that are not in `functions` are not class positions: their arguments may
   * be anything (`const clsx = require('clsx')`).
   */
  function collectVariableValue(node: unknown): void {
    if (!isNode(node))
      return
    if (TRANSPARENT_TYPES.has(node.type)) {
      collectVariableValue(node.expression)
      return
    }
    if (node.type === 'ObjectExpression') {
      for (const property of node.properties as unknown[]) {
        if (isNode(property) && isProperty(property)) {
          // Keys are names (`button`), not classes
          if (property.computed)
            findClassContexts(property.key)
          collectVariableValue(property.value)
        }
        else {
          collectClassValue(property, false)
        }
      }
      return
    }
    if (isFunction(node)) {
      findClassContexts(node.params)
      const body = node.body
      if (isNode(body) && body.type === 'BlockStatement') {
        // Only top-level `return`s, like the ESLint rule
        for (const statement of body.body as unknown[]) {
          if (isNode(statement) && statement.type === 'ReturnStatement')
            collectVariableValue(statement.argument)
          else
            findClassContexts(statement)
        }
      }
      else {
        collectVariableValue(body)
      }
      return
    }
    collectClassValue(node, false)
  }

  /** `keys`: object keys are classes too (inside clsx-like functions). */
  function collectClassValue(node: unknown, keys: boolean): void {
    if (Array.isArray(node)) {
      for (const child of node)
        collectClassValue(child, keys)
      return
    }
    if (!isNode(node))
      return

    if (TRANSPARENT_TYPES.has(node.type)) {
      collectClassValue(node.expression, keys)
      return
    }
    if (isStringLiteral(node)) {
      result.strings.push(node)
      return
    }
    if (isTemplateLiteral(node)) {
      result.templates.push(node)
      for (const [i, expression] of node.expressions.entries()) {
        // `p-4 ${on ? 'a b' : ''}`: the expression holds whole classes
        if (isSeparatedExpression(node, i))
          collectClassValue(expression, false)
        // `text-${on ? 'red-500' : 'blue-500'}`: fragments of a class; may still hold `clsx(…)`
        else
          findClassContexts(expression)
      }
      return
    }
    // String.raw`p-4 flex`: the same text as a plain template
    if (node.type === 'TaggedTemplateExpression' && isStringRaw(node.tag) && isTemplateLiteral(node.quasi)) {
      result.stringRawTemplates.add(node.quasi)
      collectClassValue(node.quasi, false)
      return
    }
    switch (node.type) {
      // c ? 'a' : 'b'
      case 'ConditionalExpression':
        findClassContexts(node.test)
        collectClassValue([node.consequent, node.alternate], keys)
        return
      // c && 'a', 'a' || c, c ?? 'a'
      case 'LogicalExpression':
        collectClassValue([node.left, node.right], keys)
        return
      // ['a', c && 'b']
      case 'ArrayExpression':
        collectClassValue(node.elements, keys)
        return
      // [...['a']], { ...{ k: 'a' } }
      case 'SpreadElement':
        collectClassValue(node.argument, keys)
        return
      case 'ObjectExpression':
        collectObject(node.properties as unknown[], keys)
        return
    }
    // Any other expression: not a class, but may contain class contexts
    findClassContexts(node)
  }

  function collectObject(properties: unknown[], keys: boolean): void {
    // A spread may bring in keys that a sorted key would collide with
    const sortKeys = keys && properties.every(p => isNode(p) && isProperty(p))
    const group: KeyGroup = { keys: [], names: [] }

    for (const property of properties) {
      if (!isNode(property) || !isProperty(property)) {
        collectClassValue(property, keys)
        continue
      }
      const key = classKey(property)
      if (sortKeys && key) {
        group.keys.push(key)
      }
      else {
        const name = staticKeyName(property)
        if (name !== undefined)
          group.names.push(name)
        // tv({ base: '…' }): keys are names, but computed keys may hold `clsx(…)`
        if (property.computed)
          findClassContexts(property.key)
      }
      collectClassValue(property.value, keys)
    }

    if (group.keys.length)
      result.keyGroups.push(group)
  }

  function findClassContexts(root: unknown): void {
    walk(root, (node) => {
      // <div className="…" />, className={'…'}, className={`…`}
      if (node.type === 'JSXAttribute') {
        const name = jsxAttributeName(node)
        // class:list={['…', { '…': on }]}
        if (name && listAttributes.has(name) && isNode(node.value) && node.value.type === 'JSXExpressionContainer') {
          collectClassValue(node.value.expression, true)
          return false
        }
        if (name && attributes.has(name)) {
          const value = isNode(node.value) && node.value.type === 'JSXExpressionContainer'
            ? node.value.expression
            : node.value
          if (isNode(value) && isStringLiteral(value) && value === node.value)
            result.jsxStrings.add(value)
          collectClassValue(value, false)
          return false
        }
      }
      // clsx(…), tv({ … })
      if (node.type === 'CallExpression') {
        const name = identifierName(node.callee)
        if (name && functions.has(name)) {
          collectClassValue(node.arguments, !VARIANT_FUNCTIONS.has(name))
          return false
        }
      }
      // const clsButton = '…'
      if (node.type === 'VariableDeclarator' && variables.length) {
        const name = identifierName(node.id)
        if (name && variables.some(regex => regex.test(name))) {
          collectVariableValue(node.init)
          return false
        }
      }
      // tw`…`
      if (node.type === 'TaggedTemplateExpression') {
        const name = identifierName(node.tag)
        if (name && functions.has(name) && isTemplateLiteral(node.quasi)) {
          collectClassValue(node.quasi, false)
          return false
        }
      }
    })
  }

  if (root === 'program')
    findClassContexts(ast)
  else
    collectClassValue(ast, root === 'class-value')
  return result
}

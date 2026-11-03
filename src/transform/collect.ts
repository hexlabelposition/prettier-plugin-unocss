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

export interface CollectOptions {
  /** JSX attributes whose value holds classes (`unoAttributes`). */
  attributes: readonly string[]
  /** Functions whose arguments hold classes (`unoFunctions`). */
  functions: readonly string[]
}

export interface ClassNodes {
  strings: StringLiteralNode[]
  templates: TemplateLiteralNode[]
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

function isProperty(node: AstNode): boolean {
  return node.type === 'Property' || node.type === 'ObjectProperty'
}

/**
 * Finds every string and template literal that holds classes:
 *
 * - the value of a JSX attribute from `attributes`;
 * - an argument of a call to a function from `functions`;
 * - the template of a tagged template whose tag is in `functions`.
 *
 * Inside such a class context, classes are taken from the branches of
 * conditionals (`c ? 'a' : 'b'`, not the test), both sides of logical
 * expressions (`c && 'a'`), array elements and object property **values**
 * (not keys: in `tv({ base: '…' })` keys are names), recursively. Any other
 * expression (`a === 'x'`, `other('x')`, `obj['x']`) is not a class position;
 * its strings are left alone, but it is still searched for nested class
 * contexts such as `clsx(…)`.
 *
 * Nodes are collected first and rewritten later, because sorting is async and
 * mutating the AST while walking it is error-prone.
 */
export function collectClassNodes(ast: unknown, options: CollectOptions): ClassNodes {
  const attributes = new Set(options.attributes)
  const functions = new Set(options.functions)
  const result: ClassNodes = { strings: [], templates: [] }

  function collectClassValue(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(collectClassValue)
      return
    }
    if (!isNode(node))
      return

    if (TRANSPARENT_TYPES.has(node.type)) {
      collectClassValue(node.expression)
      return
    }
    if (isStringLiteral(node)) {
      result.strings.push(node)
      return
    }
    if (isTemplateLiteral(node)) {
      result.templates.push(node)
      // Strings inside `${…}` are not class positions (yet), but may hold `clsx(…)`
      findClassContexts(node.expressions)
      return
    }
    switch (node.type) {
      // c ? 'a' : 'b'
      case 'ConditionalExpression':
        findClassContexts(node.test)
        collectClassValue([node.consequent, node.alternate])
        return
      // c && 'a', 'a' || c, c ?? 'a'
      case 'LogicalExpression':
        collectClassValue([node.left, node.right])
        return
      // ['a', c && 'b']
      case 'ArrayExpression':
        collectClassValue(node.elements)
        return
      // [...['a']], { ...{ k: 'a' } }
      case 'SpreadElement':
        collectClassValue(node.argument)
        return
      case 'ObjectExpression':
        for (const property of node.properties as unknown[]) {
          if (isNode(property) && isProperty(property)) {
            // Keys are names (`base`, `size`), not classes; computed keys may hold `clsx(…)`
            if (property.computed)
              findClassContexts(property.key)
            collectClassValue(property.value)
          }
          else {
            collectClassValue(property)
          }
        }
        return
    }
    // Any other expression: not a class, but may contain class contexts
    findClassContexts(node)
  }

  function findClassContexts(root: unknown): void {
    walk(root, (node) => {
      // <div className="…" />, className={'…'}, className={`…`}
      if (node.type === 'JSXAttribute') {
        const name = jsxAttributeName(node)
        if (name && attributes.has(name)) {
          const value = isNode(node.value) && node.value.type === 'JSXExpressionContainer'
            ? node.value.expression
            : node.value
          collectClassValue(value)
          return false
        }
      }
      // clsx(…), tv({ … })
      if (node.type === 'CallExpression') {
        const name = identifierName(node.callee)
        if (name && functions.has(name)) {
          collectClassValue(node.arguments)
          return false
        }
      }
      // tw`…`
      if (node.type === 'TaggedTemplateExpression') {
        const name = identifierName(node.tag)
        if (name && functions.has(name) && isTemplateLiteral(node.quasi)) {
          collectClassValue(node.quasi)
          return false
        }
      }
    })
  }

  findClassContexts(ast)
  return result
}

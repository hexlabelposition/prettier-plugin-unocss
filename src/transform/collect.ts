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

/**
 * Finds every string and template literal that holds classes:
 *
 * - the value of a JSX attribute from `attributes`;
 * - inside the arguments of a call to a function from `functions`, recursively,
 *   taking object property **values** but not keys (`tv({ base: '…' })`);
 * - the template of a tagged template whose tag is in `functions`.
 *
 * Nodes are collected first and rewritten later, because sorting is async and
 * mutating the AST while walking it is error-prone.
 */
export function collectClassNodes(ast: unknown, options: CollectOptions): ClassNodes {
  const attributes = new Set(options.attributes)
  const functions = new Set(options.functions)
  const result: ClassNodes = { strings: [], templates: [] }

  const collectClassContext = (root: unknown): void => {
    walk(root, (node) => {
      if (isStringLiteral(node)) {
        result.strings.push(node)
        return false
      }
      if (isTemplateLiteral(node)) {
        result.templates.push(node)
        return false
      }
      // Object keys are names (`base`, `size`), not classes
      if (node.type === 'Property' || node.type === 'ObjectProperty') {
        collectClassContext(node.value)
        return false
      }
    })
  }

  walk(ast, (node) => {
    // <div className="…" />, className={'…'}, className={`…`}
    if (node.type === 'JSXAttribute') {
      const name = jsxAttributeName(node)
      if (name && attributes.has(name)) {
        const value = isNode(node.value) && node.value.type === 'JSXExpressionContainer'
          ? node.value.expression
          : node.value
        collectClassContext(value)
        return false
      }
    }
    // clsx(…), tv({ … })
    if (node.type === 'CallExpression') {
      const name = identifierName(node.callee)
      if (name && functions.has(name)) {
        collectClassContext(node.arguments)
        return false
      }
    }
    // tw`…`
    if (node.type === 'TaggedTemplateExpression') {
      const name = identifierName(node.tag)
      if (name && functions.has(name) && isTemplateLiteral(node.quasi)) {
        result.templates.push(node.quasi)
        return false
      }
    }
  })

  return result
}

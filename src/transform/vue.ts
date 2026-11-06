import type { UnoGenerator } from '@unocss/core'
import type { CollectOptions } from './collect'
import type { HtmlNode } from './html'
import type { Locator } from './index'
import { sortClasses } from '../sort'
import { collectClassNodes } from './collect'
import { sortStaticAttributes, walkElements } from './html'
import { applyEdits, classNodeEdits } from './index'

/** A parser of a JavaScript expression, like Prettier's `__vue_expression`. */
export interface ExpressionParser extends Locator {
  parse: (text: string) => Promise<unknown> | unknown
}

export interface VueOptions extends CollectOptions {
  /**
   * The parser for `:class` values: Prettier's `__vue_ts_expression` when the
   * component's `<script>` is TypeScript, `__vue_expression` otherwise.
   */
  expressionParser: (typescript: boolean) => ExpressionParser
}

// An HTML entity in a `:class` value. Prettier formats the expression with
// entities as written, while Vue decodes them: `'&amp;'` is `'&'` at runtime,
// so classes with entities would be sorted by the wrong text.
const ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i

// Valueless attributes the ESLint `order-attributify` rule leaves out
// (compared in lowercase), and directives (`v-else`, `#default`, `.prop`)
const NOT_ATTRIBUTIFY = new Set(['style', 'class', 'classname', 'value'])
const DIRECTIVE = /^(?:v-|[.:@#])/

const ATTRIBUTIFY_PRESET = '@unocss/preset-attributify'
const IGNORE_ATTRIBUTE = /^\s*prettier-ignore-attribute(?:\s|$)/

/** Whether a Vue SFC has a TypeScript `<script>`, the same check as Prettier's. */
function isTypeScript(root: HtmlNode): boolean {
  return (root.children ?? []).some(node => node.kind === 'element'
    && node.name === 'script'
    && node.attrs?.some(attr => attr.name === 'lang' && (attr.value === 'ts' || attr.value === 'typescript')))
}

/**
 * Sorts the classes in a Vue SFC template, in place: static `class="…"` and
 * bound `:class="…"` / `v-bind:class="…"` (for every name in `attributes`).
 * `<script>` blocks are formatted with the JS parsers, which sort them.
 */
export async function sortClassesInVueAst(ast: unknown, uno: UnoGenerator, options: VueOptions): Promise<void> {
  const root = ast as HtmlNode
  const attributes = new Set(options.attributes)
  const parser = options.expressionParser(isTypeScript(root))

  const statics: HtmlNode[] = []
  const bindings: HtmlNode[] = []
  walkElements(root, (element) => {
    for (const attr of element.attrs ?? []) {
      const name = attr.name ?? ''
      if (attributes.has(name))
        statics.push(attr)
      else if (attributes.has(name.replace(/^(?::|v-bind:)/, '')))
        bindings.push(attr)
    }
  })

  await sortStaticAttributes(statics, uno)
  for (const attr of bindings) {
    const sorted = await sortBindingValue(attr.value, uno, options, parser)
    if (sorted !== undefined)
      attr.value = sorted
  }

  if (uno.config.presets.some(preset => preset.name === ATTRIBUTIFY_PRESET)) {
    for (const element of templateElements(root))
      await sortAttributifyAttributes(element, uno)
  }
}

/**
 * The elements of the SFC's `<template>`, itself included, as the ESLint
 * `order-attributify` rule sees them (not `<script setup>` or `<style scoped>`).
 * Elements after a `<!-- prettier-ignore-attribute -->` comment are left out:
 * Prettier prints their attributes as written.
 */
function templateElements(root: HtmlNode): HtmlNode[] {
  const elements: HtmlNode[] = []
  const walk = (node: HtmlNode, ignored: boolean): void => {
    if (!ignored)
      elements.push(node)
    let previous: HtmlNode | undefined
    for (const child of node.children ?? []) {
      if (child.kind === 'element')
        walk(child, previous?.kind === 'comment' && IGNORE_ATTRIBUTE.test(previous.value ?? ''))
      // Whitespace between a comment and an element
      if (child.kind !== 'text' || child.value?.trim())
        previous = child
    }
  }
  for (const node of root.children ?? []) {
    if (node.kind === 'element' && node.name === 'template')
      walk(node, false)
  }
  return elements
}

/**
 * Sorts the valueless attributes of an element (`<div p-4 flex>`), the
 * utilities of `presetAttributify`, like the ESLint `order-attributify` rule:
 * they are sorted as one class list and put together where the last of them
 * was; other attributes keep their places.
 *
 * Unlike that rule, names are sorted as written: the rule lowercases them
 * (`isOpen` → `isopen`), which changes the code.
 */
async function sortAttributifyAttributes(element: HtmlNode, uno: UnoGenerator): Promise<void> {
  const attrs = element.attrs ?? []
  const valueless = attrs.filter((attr) => {
    const name = attr.fullName ?? ''
    return attr.value == null
      && name !== ''
      && !DIRECTIVE.test(name)
      && !NOT_ATTRIBUTIFY.has(name.toLowerCase())
  })
  if (valueless.length < 2)
    return

  const names = valueless.map(attr => attr.fullName!)
  const sorted = (await sortClasses(names.join(' '), uno)).split(' ')
  // Sorting must only move names (see "Changed classes" in ARCHITECTURE.md)
  if (sorted.join(' ') === names.join(' ') || sorted.toSorted().join(' ') !== names.toSorted().join(' '))
    return

  // Duplicate names take their attributes in the original order
  const byName = new Map<string, HtmlNode[]>()
  for (const attr of valueless) {
    byName.set(attr.fullName!, [
      ...byName.get(attr.fullName!) ?? [],
      attr,
    ])
  }
  const sortedAttrs = sorted.map(name => byName.get(name)!.shift()!)
  const last = valueless.at(-1)
  element.attrs = attrs.flatMap((attr) => {
    if (attr === last)
      return sortedAttrs
    return valueless.includes(attr)
      ? []
      : [attr]
  })
}

/**
 * Sorts the classes in a `:class` value, a JavaScript expression. It is a
 * class value as a whole: strings, template literals, branches, arrays and
 * object keys (`{ 'p-4 flex': on }`, Vue's object syntax).
 *
 * The expression is parsed here, the class strings are sorted in its AST and
 * their new source text replaces the old one in the value. Prettier then
 * formats the value as usual. Returns `undefined` when nothing changes or the
 * value can't be parsed (Prettier reports that itself).
 */
async function sortBindingValue(value: string | null | undefined, uno: UnoGenerator, options: CollectOptions, parser: ExpressionParser): Promise<string | undefined> {
  if (!value)
    return undefined
  // Prettier gives the expression these two entities decoded, see its `printAttribute`
  const text = value.replaceAll('&apos;', '\'').replaceAll('&quot;', '"')
  if (ENTITY.test(text))
    return undefined

  let root: unknown
  try {
    root = await parser.parse(text)
  }
  catch {
    return undefined
  }
  const expression = (root as { node?: unknown }).node ?? root
  const nodes = collectClassNodes(expression, options, 'class-value')
  const edits = await classNodeEdits(nodes, uno, text, parser)
  return edits.length
    ? applyEdits(text, edits)
    : undefined
}

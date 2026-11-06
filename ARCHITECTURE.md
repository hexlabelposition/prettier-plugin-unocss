# Architecture

How `prettier-plugin-unocss` works, and why it is built this way.

| Section                                                                         | What's inside                                                                                   |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Principles](#principles)                                                       | The rules every decision follows                                                                |
| [Pipeline](#pipeline)                                                           | How a file goes through the plugin, per language                                                |
| [Modules](#modules)                                                             | Source files and their dependencies                                                             |
| [Ordering](#ordering-sortts)                                                    | The ordering algorithm, adapted from UnoCSS                                                     |
| [Config loading](#config-loading-generatorts-iconsts)                           | Finding, caching, reloading the config; icons                                                   |
| [Finding classes](#finding-classes-transformcollectts)                          | Class contexts, positions, object keys, templates                                               |
| [Writing strings back safely](#writing-strings-back-safely-escapests-rewritets) | Escapes, whitespace, changed classes, duplicates                                                |
| [Languages](#languages)                                                         | [HTML and Vue](#html-and-vue-htmlts-vuets), [Svelte](#svelte-sveltets), [Astro](#astro-astrots) |
| [Parsers of other plugins](#parsers-of-other-plugins-parsersts)                 | Building on Svelte, Astro and import sorter parsers                                             |
| [Comparison with the ESLint rules](#comparison-with-the-eslint-rules)           | Where and why the output differs                                                                |
| [Key decisions](#key-decisions)                                                 | Short answers to "why this way"                                                                 |
| [Known limitations](#known-limitations)                                         | What is not supported                                                                           |
| [References](#references)                                                       | Upstream code and docs                                                                          |

## Principles

1. **Formatting never changes behaviour.** When unsure, don't touch: a missed sort is acceptable, a broken string is not. Every check below that "leaves a string alone" follows from this.
2. **Same order as the UnoCSS ESLint rules** (`order`, `order-attributify`). A project switching between the two should see no diff. Where we differ, it is on purpose and listed in [Comparison with the ESLint rules](#comparison-with-the-eslint-rules).
3. **Prettier does the formatting.** We only change the contents of class strings (and the order of attributify attributes); Prettier's parsers and printers do everything else.
4. **No config, no sorting.** Without a `uno.config` the file is left untouched: guessing presets would give wrong orders silently.

## Pipeline

```text
source text
  │
  ▼
base parser (Prettier's, or another plugin's)    ← unchanged
  │  AST
  ▼
collect class strings → sort each → write back   ← our code
  │  AST
  ▼
base printer                                     ← unchanged
  │
  ▼
formatted text
```

The plugin registers parsers under the names of existing ones (`babel`, `typescript`, `vue`, `svelte`, …). Each calls the base parser, sorts the classes in the AST it returns, and hands it to the base printer. This is the same approach as `prettier-plugin-tailwindcss`.

How the sorted classes reach the output depends on how the printer prints:

| Where             | Base parser and AST                  | How changes are written                                                     |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| JS / TS / JSX     | Prettier's, ESTree / Babel           | In place: string `value` and `raw`                                          |
| HTML, Vue `class` | Prettier's HTML parser               | In place: the attribute's `value`                                           |
| Vue `:class`      | Parsed by us with `__vue_expression` | Text edits in the attribute value; Prettier formats the expression later    |
| Vue attributify   | Prettier's HTML parser               | Attributes reordered in `element.attrs`                                     |
| Svelte            | `prettier-plugin-svelte`             | Text edits on the source, parsed again; the printer prints from source text |
| Astro             | `prettier-plugin-astro`, JSX AST     | In place, as JSX                                                            |

## Modules

```text
src/
  index.ts        Plugin entry: exports `parsers` and `options`
  options.ts      Option definitions and their types
  parsers.ts      Wraps parsers: Prettier's or other plugins' (wrapParser)
  generator.ts    Finds and loads uno.config, caches UnoGenerator instances
  icons.ts        Creates generators as under ESLint (no icon collections)
  sort.ts         Ordering algorithm (string in → string out)
  transform/
    index.ts      Sorts collected nodes; text edits for source-printed languages
    walk.ts       Generic AST walker
    collect.ts    Finds class strings in an ESTree/Babel AST
    rewrite.ts    Writes sorted strings back (value + raw)
    template.ts   Template literals
    escapes.ts    Escapes and HTML entities: source text ↔ value
    html.ts       HTML: static `class` (shared with Vue)
    vue.ts        Vue templates: `class`, `:class`, attributify
    svelte.ts     Svelte markup, as text edits
    astro.ts      Astro markup (a JSX AST)
```

Dependencies point one way: `index → parsers → (generator, transform) → sort`. `sort.ts` knows nothing about Prettier or ASTs; `transform/` knows nothing about UnoCSS beyond calling `sort`. Each language has its own collector, because each has its own AST shape.

## Ordering (`sort.ts`)

A copy of `sortRules` from UnoCSS (`virtual-shared/integration/src/sort-rules.ts`, MIT), the function behind the ESLint `order` rule. It isn't published yet: [unocss/unocss#5439](https://github.com/unocss/unocss/pull/5439) exports it from `@unocss/core`, and then the copy goes away.

1. Expand variant groups: `hover:(a b)` → `hover:a hover:b`.
2. For each class, `uno.parseToken(cls)`:
   - `null`: unknown, goes to the front in its original order;
   - otherwise rank = index of the matched rule + number of variants × 100 000.
3. Sort by rank, ties alphabetically.
4. Collapse variant groups back.

`uno.config.details = true` is required, otherwise `parseToken` returns no variant handlers. `sortPreservingEdges` is ours: it keeps one space at the edges of template chunks, where it separates classes from `${…}`.

## Config loading (`generator.ts`, `icons.ts`)

**Finding.** `uno.config.*` / `unocss.config.*` is searched for upwards from the formatted file, or `unoConfig` is resolved from `cwd`. The search uses `unconfig`'s `findConfigs()` with the same names as `@unocss/config`, so it finds the file `loadConfig` would load without loading it. No file → no sorting, and `loadConfig` isn't called (it would log "Config file not found").

**Cache.** One `UnoGenerator` per config file, in a `Map` of promises, so parallel files share one load. A file elsewhere under the same config costs only a few `stat` calls.

**Invalidation.** Editors keep Prettier running, so a changed config must be picked up. After a load, the modification time and size of every file in `sources` (the config and its `configDeps`) are stored; before reuse they are `stat`ed again, and any difference starts a new load. The config's state is taken before loading, so an edit during the load isn't missed. Files the config imports are not tracked (the loader doesn't report them): list them in `configDeps`, as for the Vite plugin.

**Errors.** A config that fails to load, or a `unoConfig` that doesn't exist, is reported by Prettier for the file, with the path and the cause (`[prettier-plugin-unocss] Failed to load UnoCSS config …: …`). Skipping silently would look like the plugin doesn't work. Failed loads aren't cached.

**Icons.** Like the ESLint plugin, the generator is created with `process.env.ESLINT` set, so `@unocss/preset-icons` doesn't load `@iconify-json/*` collections: it is slow and sorting doesn't need the SVGs. Such icons are then unknown classes, as under ESLint. The variable is set only while the generator is created, not for the whole process (editors run other extensions in it). The preset reads it lazily, on the first icon, so `icons.ts` triggers that early with a name it rejects before loading anything.

## Finding classes (`transform/collect.ts`)

**Class contexts:**

- the value of a JSX attribute in `unoAttributes`;
- an argument of a call to a function in `unoFunctions`, or a tagged template with such a tag;
- the value of a variable whose name matches `unoVariables` (case-insensitive): a class value, an object of them, or a function returning one (top-level `return`s).

**Class positions.** Inside a context, strings are collected recursively from: conditional branches (not the test), both sides of `&&` / `||` / `??`, array elements, spreads, object values, and `${…}` expressions with whitespace or the template's edge on both sides. `as`, `satisfies` and `!` are transparent; `` String.raw`…` `` is a template. Anything else (`a === 'x'`, `other('x')`, `'x'.split(' ')`) is not a class position, but is still searched for nested contexts, so `merge(clsx('…'))` is sorted.

**Object keys** are classes in `clsx`-like functions (`clsx({ 'p-4 flex': on })`), but names in `tv` / `cva` (a fixed list in `collect.ts`) and in JSX attributes. Only static keys, only in objects without spreads. An object's keys are sorted together, and left alone if sorting would make two of them equal: `{ 'p-4 flex': a, 'flex p-4': b }` would lose `a`.

**Template literals.** A chunk may be glued to an expression: in `` `p-2 bg-${c}-500` `` the chunk `p-2 bg-` ends with part of a class. Glued fragments stay in place, whole classes between them are sorted, and the chunk keeps its edge whitespace. In `` `bg-${on ? 'red-500' : 'blue-500'}` `` the strings are parts of one class, so they aren't sorted.

Strings are collected first and sorted after the walk: sorting is async, and changing the AST while walking it is error-prone.

## Writing strings back safely (`escapes.ts`, `rewrite.ts`)

Prettier prints string literals from their **raw** text, to keep quotes and escapes, so `value`, `raw` and Babel's `extra` are updated together, with the original quote.

**Escapes and entities.** A class may contain quotes (`content-['x']`), spelled with escapes (`"content-[\"x\"]"`) or, in JSX and HTML, entities (`&quot;`). The source between the quotes is split into units: a character, or an escape with its value. Decoding must give exactly the parser's `value`, otherwise the string is skipped. After sorting, every class gets its original spelling back. A class that isn't in the source (only a regrouped variant group can make one) is written as is, unless it needs escaping; then the string is skipped. Both quote characters count, since Prettier may switch quotes and the next run must decide the same way.

Skipped on purpose: line continuations, legacy octal escapes, unknown entities (`&nbsp;`; a bare `&` as in `[&>svg]:size-4` is fine), backslashes in `String.raw`.

**Whitespace.** Whitespace between classes, line breaks included, becomes one space, so a multiline class list ends up on one line, as with the ESLint rule (keeping line breaks would need a layout decision with no right answer). At the edges, a string drops whitespace with a line break and keeps other whitespace as one space; a template chunk always keeps one space. Only HTML whitespace separates classes in the browser, while UnoCSS splits at any: a string with other whitespace (` `, `\v`) is left alone.

**Changed classes.** Sorting must only move classes. Expanding and collapsing variant groups can change a class that merely looks like a group: `w-(--x)` would come back as `w---x`, `hover:(foo p-4)` with an unknown `foo` as `hover:foo hover:p-4`. If the result has a class that isn't in the input and isn't a regrouped group, the string is left alone.

**Duplicates** are kept and sorted next to each other (`p-4 flex p-4` → `flex p-4 p-4`), as with the ESLint rule. Removing them would change string values code may rely on (comparisons, object keys), and couldn't catch duplicates across `clsx` arguments or branches anyway. That's a job for a linter.

## Languages

### HTML and Vue (`html.ts`, `vue.ts`)

Prettier's HTML parser (in Vue mode for `.vue`) is wrapped like the JS ones. `<script>` needs nothing extra: Prettier formats it with `babel` / `typescript`, which are ours. `angular`, `lwc` and `mjml` are not wrapped.

- **`class="…"`** (names from `unoAttributes`): the AST keeps the value as written, entities included, so it is decoded and sorted like a JSX string. Values with `{{` are left alone, as Prettier does.
- **`:class` / `v-bind:class`**: a JavaScript expression, which Prettier formats with `__vue_expression` (`__vue_ts_expression` for a TypeScript `<script>`). That parser can't be wrapped: it parses every binding and doesn't know which attribute it is in. So the `vue` parser parses `:class` values itself, collects class strings with the whole expression as a class value (object keys are classes, as in Vue), and writes the sorted strings back into the value as text edits. A value Babel can't parse is left alone, and so is one with an entity: Vue decodes `&amp;` in attributes, Prettier doesn't, so it would be sorted by the wrong text.
- **Attributify** (`<div p-4 flex>`), only with `@unocss/preset-attributify` in the config, like `order-attributify`: the valueless attributes of each element in the SFC's `<template>` (not `<script setup>` or `<style scoped>`), except directives (`v-else`, `#default`, `.prop`) and `style`, `class`, `className`, `value`. They are sorted as one class list by their names as written (`hover:p-4` included) and put together where the last of them was; other attributes keep their places. Attributes with a value (`text="sm white"`) are left alone, and so is an element after `<!-- prettier-ignore-attribute -->`, whose attributes Prettier prints as written.

### Svelte (`svelte.ts`)

The Svelte printer prints expressions from the **source text**, so changing the AST has no effect. Instead the changes are collected as text edits (`classNodeEdits`, shared with Vue's `:class`), applied, and the text is parsed again and set as `options.originalText`, as the plugin's own `preprocess` does. Side effect: the cursor position in editors is computed from the text before sorting, so it may move a little within a sorted line. Only the Svelte 5 AST (plugin v4) is supported; with v3 the markup is left alone.

- **`class="…"`**: text parts and `{…}` parts. Text is decoded like JSX (entities); with expressions around, each text part is handled like a template chunk (`bg-{c}-500` stays). A standalone `{…}` is a class value whose object keys are _not_ classes: it becomes a string.
- **`class={…}`**: a class value with object keys as classes (Svelte 5 passes it through `clsx`).
- **`class:name`** directives are never sorted.
- Any other markup expression is searched for class contexts (`clsx(…)`, `{@const cls = …}`).

### Astro (`astro.ts`)

`prettier-plugin-astro` turns the markup into a JSX AST, printed from the AST, so the markup is sorted in place like JSX. `class:list={…}` is a class value with object keys as classes, as Astro passes it through `clsx`. The frontmatter and `<script>` are formatted with `babel-ts`, which is ours.

## Parsers of other plugins (`parsers.ts`)

Prettier uses the parser of the last plugin that registers a name. Other plugins register the same names as we do: `prettier-plugin-svelte` / `prettier-plugin-astro` add `svelte` / `astro`, and the import sorters (`prettier-plugin-organize-imports`, `@ianvs/…`, `@trivago/…`) replace `babel`, `typescript`, `vue`, … with Prettier's parsers plus a `preprocess` that reorders imports.

So each of our parsers (`wrapParser`) builds on a **base parser** found at runtime: the parser of the same name from the last plugin **before ours** in `options.plugins`, or Prettier's own. Its `preprocess` and `parse` run, then classes are sorted, and its plugin's printer (by `astFormat`) prints. No other plugin is imported: the user's own versions are used.

- Plugins after ours are never looked at, so two plugins that both build on the previous one can't call each other in a loop. Listed before another plugin, ours does nothing for that parser name; the README asks for ours to be last.
- Prettier's own plugins load parsers lazily, and `@ianvs/…` has getters that throw when an optional plugin is missing; both are handled. That's why `preprocess` is async (Prettier awaits it, although its type says otherwise).
- Svelte and Astro have no Prettier parser: without their plugin, ours throws an error that names it.

`test/compat.test.ts` checks for every import sorter that the result with ours last is theirs with classes sorted.

## Comparison with the ESLint rules

`test/eslint.test.ts` runs every fixture through `eslint --fix` with `@unocss/order` and `@unocss/order-attributify`, then Prettier, and expects our output. Fixtures listed there differ on purpose, with the reason. `CORPUS=<dir> pnpm vitest run test/eslint-corpus.test.ts` does the same on a directory of real files; Tailwind projects work too, as `presetWind3` understands most of their classes.

We sort more:

- nested class positions (the rule looks one level deep: call arguments and literals directly in attributes);
- Vue `:class`, Svelte `class={[…]}`, Astro `class:list` and `<script>`;
- HTML files, which the rule doesn't support (the comparison skips them);
- code embedded in `` html`…` `` templates, which Prettier formats with our parsers and ESLint doesn't look into.

We leave alone what the rule breaks:

- escapes and entities: the rule writes the decoded value back, which breaks `&quot;` and drops `&nbsp;`;
- classes glued to `${…}`, and an extra space it adds between `${…}` expressions;
- `w-(--x)`, which it expands into another class (`w---x`);
- two object keys that sorting would make equal;
- attributify names in another case: the rule writes them in lowercase (`isOpen` → `isopen`).

And we respect `<!-- prettier-ignore-attribute -->`, which ESLint doesn't know.

## Key decisions

| Decision                                          | Why                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Wrap existing parsers instead of a custom printer | Formatting stays 100% Prettier; we only change class strings                                             |
| Async parse                                       | Prettier 3 supports it, and `loadConfig` and `parseToken` are async; no `synckit` worker (unlike ESLint) |
| Same order as the ESLint rules                    | Predictable for UnoCSS users; one source of truth                                                        |
| No config → no-op                                 | Guessing presets would give wrong orders silently                                                        |
| Object keys only in clsx-like functions           | In `tv` / `cva` keys are names (`base`, `size`), not classes                                             |
| Duplicate classes are kept                        | Same as the ESLint rule; see Duplicates                                                                  |

## Known limitations

- This plugin must be the last in `plugins`. Plugins that replace other parsers than the tested ones may work the same way, but are not tested.
- One class sorter only: with `prettier-plugin-tailwindcss` the two would undo each other's work.
- Attributify: only valueless attributes, only in Vue templates.

## References

- UnoCSS ESLint plugin: `packages-integrations/eslint-plugin` (rules `order`, `order-attributify`; `worker.ts`)
- UnoCSS sort utility: `virtual-shared/integration/src/sort-rules.ts`, to be exported from `@unocss/core` ([#5439](https://github.com/unocss/unocss/pull/5439))
- `prettier-plugin-tailwindcss`: parser wrapping and plugin compatibility
- Prettier plugin API: <https://prettier.io/docs/plugins>

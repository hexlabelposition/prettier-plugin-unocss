# Architecture

How `prettier-plugin-unocss` works, and why it is built this way.

## Pipeline

```text
source text
  │
  ▼
built-in Prettier parser (babel / typescript / …)       ← unchanged
  │  AST
  ▼
plugin: collect class strings → sort each → rewrite AST  ← our code
  │  AST
  ▼
built-in Prettier printer                                ← unchanged
  │
  ▼
formatted text
```

The plugin **does not parse or print code itself**. It registers parsers under the same names as Prettier's built-in ones (`babel`, `typescript`, …). Each of them calls the original parser, then rewrites class strings in the resulting AST and returns it. Prettier's own printer formats the result.

This is the same approach as `prettier-plugin-tailwindcss`.

## Modules

```text
src/
  index.ts        Plugin entry: exports `parsers` and `options`
  parsers.ts      Wraps parsers: Prettier's or other plugins' (wrapParser)
  generator.ts    Loads uno.config, caches UnoGenerator instances
  icons.ts        Creates generators as under ESLint (no icon collections)
  sort.ts         Ordering algorithm (string in → string out)
  transform/
    index.ts      sortClassesInAst: collect, sort, rewrite
    walk.ts       Generic AST walker
    collect.ts    Finds class strings in an ESTree/Babel AST
    rewrite.ts    Writes sorted strings back (value + raw)
    template.ts   Template literal handling
    escapes.ts    Escapes and JSX entities: source text ↔ value
    html.ts       HTML: static `class` in Prettier's HTML AST (shared with Vue)
    vue.ts        Vue templates: `class` and `:class` in Prettier's HTML AST
    svelte.ts     Svelte markup (prettier-plugin-svelte's AST), as text edits
    astro.ts      Astro markup (prettier-plugin-astro's JSX AST)
  options.ts      Option definitions and their types
```

Dependency direction: `index → parsers → (generator, transform) → sort`. `sort.ts` knows nothing about Prettier or ASTs; `transform/` knows nothing about UnoCSS internals beyond calling `sort`.

> Language-specific transforms live next to `collect.ts` as separate collectors, because each has its own AST shape (`html.ts`, `vue.ts`, `svelte.ts`, `astro.ts`).

## Ordering algorithm (`sort.ts`)

Adapted from UnoCSS `virtual-shared/integration/src/sort-rules.ts` (MIT), the same function the ESLint `order` rule uses. Keeping the output identical to the ESLint rule is a goal: a project switching between the two should see no diff.

1. Expand variant groups: `hover:(a b)` → `hover:a hover:b` (`parseVariantGroup`).
2. For each class, `uno.parseToken(cls)`:
   - `null` → unknown class, goes to the front, original order kept;
   - otherwise rank = `token[0][0]` (index of the matched rule) + `variantHandlers.length × 100_000`.
3. Sort by rank, ties broken alphabetically.
4. Collapse variant groups back (`collapseVariantGroup`).

`uno.config.details = true` is required: without it `parseToken` does not return variant handlers.

## Config loading (`generator.ts`)

- First, find the config file: `unocss.config.*` / `uno.config.*`, searching up from the formatted file's directory, or the `unoConfig` path resolved from `cwd`. The search uses `unconfig`'s `findConfigs()` with the same file names as `@unocss/config`, so it finds exactly the file `loadConfig` would load, but without loading it. This makes monorepos work.
- Then `loadConfig` from `@unocss/config` loads that file and a `UnoGenerator` is created from it.
- One `UnoGenerator` per **config file path**, cached in a `Map` of **promises** (so parallel requests share one load). Files in different directories under the same config share one generator; the per-file cost of the search is only a few `stat` calls.
- No config found → `undefined` → the file is left untouched, and `loadConfig` is not called at all (it would log a "Config file not found" error). We never guess presets.
- A config that fails to load, or a `unoConfig` file that doesn't exist, is an error: Prettier reports it for the file, with the plugin name, the config path and the cause (`[prettier-plugin-unocss] Failed to load UnoCSS config …/uno.config.ts: …`). Silently skipping would look like "the plugin doesn't work". A failed load is not cached, so a fixed config is picked up on the next format.

- Icon collections are not loaded. The generator is created with `process.env.ESLINT` set, as the UnoCSS ESLint plugin does: `@unocss/preset-icons` then skips its loader for installed `@iconify-json/*` packages (custom collections and `cdn` still work) and doesn't warn about icons it can't load. Loading collections is slow and sorting doesn't need the SVGs; it also keeps the order identical to the ESLint rule, where such icons are unknown classes and keep their place among the other unknown ones. The variable is set only while the config loads and the generator is created, not for the whole Prettier process (editors run other extensions in it). The preset reads it when it is created and when it creates its loader, which happens lazily on the first icon, so `icons.ts` triggers that with an icon name rejected before any loading (`prettier-plugin-unocss:prime`). Overlapping loads keep the variable until the last one ends.
- The cache is invalidated when a config file changes, because editors keep Prettier running between saves. After a successful load, the modification time and size of each file in `sources` from `loadConfig` are stored: the config file itself and its `configDeps`. Before reusing a generator these files are `stat`ed again; any difference, including a file that appeared or disappeared, starts a new load. The config file's state is taken before loading, so an edit made during the load is not missed. Files the config imports are not tracked, because the loader doesn't report them (`unconfig`'s `dependencies` is empty with jiti's module cache off): list them in `configDeps`, as for the Vite plugin.

## AST rewriting (`transform/`)

**Collection.** A class context is:

- the value of a JSX attribute listed in `unoAttributes`;
- an argument of a call to a function listed in `unoFunctions`;
- the quasi of a tagged template whose tag is in `unoFunctions`;
- the value of a variable whose name matches a regex from `unoVariables` (case-insensitive, like the ESLint rule): a class value, an object whose values are such values (keys are names), or a function returning one (top-level `return`s only). Calls of other functions are not class positions here, unlike in the ESLint rule: their arguments may be anything (`const clsx = require('clsx')`).

Inside a class context, strings and template literals are collected from **class positions** only, recursively: the branches of a conditional (not its test), both sides of a logical expression, array elements, spread arguments, object property **values**, and template expressions that stand apart from the text around them (`` `p-4 ${on ? 'a b' : ''}` ``). TypeScript wrappers (`as`, `satisfies`, `!`) are transparent, and `` String.raw`…` `` is handled like a plain template literal (as in the ESLint rule). Any other expression (`a === 'x'`, `other('x')`, `obj['x']`, `'x'.split(' ')`) is not a class position: its strings are left alone, but it is still searched for nested class contexts, so `merge(clsx('…'))` is sorted.

**Object keys** are classes inside clsx-like functions (`clsx({ 'p-4 flex': on })`), but names in `tv` and `cva` (`tv({ base: '…' })`) and in JSX attributes, where they are never touched. The variant functions are a fixed list (`tv`, `cva`) in `collect.ts`. Only static keys are sorted (`'a b'`, `['a b']`, `` [`a b`] ``), and only in objects without spreads. The keys of one object are sorted as a group: if sorting would make two keys equal (`{ 'p-4 flex': a, 'flex p-4': b }`), the later one would override the earlier one, so the whole object's keys are left alone.

This is a superset of the ESLint `order` rule, which looks only one level deep (call arguments, and literals directly in JSX attributes).

**Comparison with the ESLint rule.** `test/eslint.test.ts` runs every fixture through `eslint --fix` with `@unocss/order` and then Prettier, and expects our output. The fixtures listed there differ on purpose: either we sort more (nested positions), or the ESLint fix breaks code (escapes, classes glued to `${…}`, `w-(--x)`, two equal object keys) or adds a space between `${…}` expressions. `CORPUS=<dir> pnpm vitest run test/eslint-corpus.test.ts` does the same comparison on a directory of real files. Tailwind projects work for this, as `presetWind3` understands most of their classes. Prettier also formats code embedded in `` html`…` `` templates, and our parsers run there too, while ESLint doesn't look inside.

Strings are collected first and sorted after the walk, because sorting is async and mutating while walking is error-prone.

**Rewriting.** Prettier printers print string literals from their **raw** source text (to keep quotes and escapes), so we update `value`, `raw` and Babel's `extra.raw` / `extra.rawValue` together, keeping the original quote character.

**Quotes and escapes.** Classes may contain quotes (`content-['x']`) and a string may spell them with escapes (`"content-[\"x\"]"`, `&quot;` in JSX). The source text between the quotes is split into units, each a character or an escape with its value (`escapes.ts`); decoding must give exactly the parser's `value`, otherwise the string is skipped. The value is sorted, and every whitespace-separated piece of the result that is in the source gets its original spelling back, escapes included. A new piece, which only a variant group collapsed differently can produce, is written as is unless it contains a character that would need escaping (both quotes and `\` in strings, `` ` `` / `\` / `${` in templates, quotes and `&` in JSX); then the string is skipped. Both quotes count for strings because Prettier may switch the quote character, and the next format must take the same decision (idempotency).

Skipped on purpose: escaped whitespace other than HTML whitespace (`\v`, `\u00A0`; see below), line continuations, legacy octal escapes, unknown JSX entities (`&nbsp;`; a bare `&` as in `[&>svg]:size-4` is a plain character), backslashes in `` String.raw`…` `` (its value is the raw text). Prettier's parsers keep named JSX entities in `value` (`&quot;`) but decode numeric ones; the value check accepts that, and the sort uses fully decoded text, as Prettier prints `&quot;` as `"`.

**Whitespace and multiline strings.** Whitespace between classes, line breaks and escaped whitespace (`\n`, `\t`) included, is collapsed to single spaces, so a class list split over several lines ends up on one line. The ESLint rule does the same, and keeping the line breaks would need a layout decision (which class goes on which line) with no right answer. At the edges: in strings, whitespace with a line break is dropped (`"\n  p-4 flex\n"` → `"flex p-4"`, as the ESLint rule trims) and other whitespace stays as one space; in template chunks it always stays as one space, because it separates classes from expressions. Only HTML whitespace (space, `\t`, `\n`, `\f`, `\r`) separates classes in the browser, while UnoCSS splits at any whitespace: a string with other whitespace (`\u00A0`, `\v`, escaped or not) is left alone.

**Changed classes.** Sorting must only move classes. A variant group is expanded for sorting and only known classes are grouped back, so a class that merely looks like a group changes: `w-(--x)` would come back as `w---x`, and `hover:(foo p-4)` (with an unknown `foo`) as `hover:foo hover:p-4`. Every item of the result must be in the input or be a regrouped variant group; otherwise the string is left alone. The ESLint rule has no such check.

**Duplicates.** Duplicate classes are kept and sorted next to each other (`p-4 flex p-4` → `flex p-4 p-4`), each with its own spelling. Removing them would not match the ESLint rule, would change string values that code may rely on (comparisons, object keys, where it could also make two keys equal), and could only be done within one string: duplicates across template chunks, `clsx` arguments or conditional branches would stay anyway. Linting duplicates is a job for a lint rule, not for the formatter.

**Template literals.** An expression is a class position only when whitespace or the template's edge is on both sides of it. In `` `bg-${on ? 'red-500 x' : 'blue-500'}` `` the strings are fragments of the class `bg-…`, and sorting them would change the class, so they are left alone (nested `clsx(…)` calls are still sorted).

A quasi chunk may be glued to an expression: in `` `p-2 bg-${c}-500` `` the chunk `p-2 bg-` ends with a partial class. Glued fragments at the edges of a chunk are kept in place; only whole classes in between are sorted. Leading/trailing whitespace of each chunk is preserved, because it separates classes from expressions.

**Safety rule.** When unsure, don't touch. A wrong sort is worse than no sort: formatting must never change behaviour.

## HTML and Vue (`transform/html.ts`, `transform/vue.ts`)

The `html` and `vue` parsers (Prettier's HTML parser, in Vue mode for `vue`) are wrapped like the JS ones. `<script>` blocks need nothing extra: Prettier formats them with the `babel` / `typescript` parsers, which are ours. The other HTML-based parsers (`angular`, `lwc`, `mjml`) are not wrapped yet.

- **`class="…"`** (any name in `unoAttributes`; the parser lowercases HTML attribute names, so `CLASS` too): Prettier's AST keeps the value as written, entities included (`&amp;`), and prints it trimmed with whitespace collapsed. The value is decoded and sorted like a JSX string (same entities, same rules for new pieces), and `value` is replaced with the sorted source text. Values with `{{` are left alone, as Prettier does, and so are values with other entities (`&nbsp;`).

Vue templates also have bound classes:

- **`:class="…"` / `v-bind:class="…"`**: the value is a JavaScript expression that Prettier formats with its `__vue_expression` parser (`__vue_ts_expression` when the component's `<script>` is TypeScript, the same check as Prettier's). That parser can't be wrapped: it parses every binding (`:title`, `v-if`) and doesn't know which attribute it is in. So the `vue` parser parses `:class` values itself with the same parser, collects class strings with the whole expression as a class value (`collectClassNodes(…, classValue)`: strings, branches, arrays, object keys, as Vue's object syntax uses keys as classes), sorts them in that AST and writes their new source text back into the attribute value at their positions (`locStart` / `locEnd`). Prettier then formats the changed value as usual. A value Babel can't parse is left alone (Prettier reports it), and so is a value with an HTML entity: Vue decodes `&amp;` in attributes, Prettier doesn't, so the strings would be sorted by the wrong text.

The ESLint rule doesn't support HTML files (`test/eslint.test.ts` skips them), and sorts only `class="…"` in Vue templates (and `<script>`), so `:class` is a superset again. It writes the decoded value back into the source, which breaks `&quot;` and drops `&nbsp;`; we keep entities, and skip values with entities we don't know.

## Parsers of other plugins (`parsers.ts`)

Prettier lets one plugin own a parser name: it uses the parser of the last plugin that registers it. Other plugins register the same names: `prettier-plugin-svelte` / `prettier-plugin-astro` add `svelte` / `astro` (Prettier has none), and the import sorters (`prettier-plugin-organize-imports`, `@ianvs/…` and `@trivago/prettier-plugin-sort-imports`) replace `babel`, `typescript`, `vue`, … with Prettier's parsers plus a `preprocess` that reorders imports.

So every parser of ours (`wrapParser`) builds on a **base parser** found at runtime (`baseParser`): the parser of the same name from the last plugin **before ours** in `options.plugins` (the plugin objects Prettier loaded for the file: its own plugins first, then the user's), falling back to Prettier's own parser. The base parser's `preprocess` and `parse` run, then classes are sorted, and the base plugin's printer (found by `astFormat`) prints. Other plugins stay optional: the user's own versions are used, and none is imported here.

Details:

- Plugins after ours are never looked at, so two plugins that both build on the previous one can't call each other in a loop. With ours listed first, the other plugin's parser is used and ours does nothing for that parser name. The README asks for ours to be last.
- Prettier's own plugins load parsers lazily (the entry is a function); `@ianvs/…` has getters that throw when an optional plugin is missing. Both are handled.
- `preprocess` is async (Prettier awaits it, its type says otherwise), because finding a lazy base parser is.
- Svelte and Astro have no Prettier parser: without the plugin, ours throws an error that names it.

How the sorted classes get printed depends on the printer: Svelte's prints expressions from the source text, Astro's and Prettier's print the AST.

`test/compat.test.ts` checks for every import sorter that the result with ours last is theirs with classes sorted.

## Svelte (`transform/svelte.ts`)

The Svelte printer prints expressions from the **source text** (`getText` by `start` / `end`), not from the AST, so changing AST nodes would have no effect. Instead `svelteClassEdits` collects the changes as text edits (`classNodeEdits`, the same helper as Vue's `:class`), the parser applies them, parses the changed text again and sets it as `options.originalText`, as the plugin's own `preprocess` does. The only side effect: Prettier computes the cursor position (editors) from the text before sorting, so the cursor may move a little within a sorted line. Only the modern AST (plugin v4, Svelte 5) is supported; with v3 the markup is left alone.

In the markup:

- **`class="…"`**: a list of `Text` and `ExpressionTag` parts. Text has HTML entities, decoded as in JSX (decoding must give Svelte's `data`); new pieces must not bring quotes, `&` or braces. A single text part is sorted like a string; with expressions around, each text part is a chunk, like in a template literal: glued fragments (`bg-{c}-500`) stay in place, and an expression with whitespace or the value's edge on both sides is a class value whose object keys are *not* classes (it is turned into a string).
- **`class={…}`**: a class value with object keys as classes, as Svelte 5 passes it through `clsx`.
- **`class:name={…}`**: directives, never sorted.
- Any other expression in the markup is searched for class contexts (`clsx(…)`, `{@const cls = …}`).

The ESLint rule sorts the text parts of `class` and string branches of `{c ? '…' : '…'}` inside it, and `clsx(…)`; it decodes `&quot;` into a `class="…"` value, which breaks the markup.

## Astro (`transform/astro.ts`)

`prettier-plugin-astro` (v1) turns the markup into a JSX AST (`ast.template`) printed by Prettier's estree printer, from the AST. So the markup is sorted in place exactly like JSX: `class="…"` (attribute strings keep entities as written, as in JSX), `class={…}`, `clsx(…)` anywhere. On top of that, `class:list={…}` is a class value whose object keys are classes too, as Astro passes it through `clsx` (the `listAttributes` collect option, not a user option). The frontmatter and `<script>` are formatted with `babel-ts`, which is ours; the frontmatter's AST in `ast.frontmatter` is not touched, as it is not printed.

The ESLint rule (with `astro-eslint-parser`) sorts `class` and `clsx(…)` in the markup and the frontmatter, but not `class:list` or `<script>`, and decodes `&quot;` into a `class="…"` value, which breaks the markup.

## Key decisions

| Decision                                          | Why                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Wrap built-in parsers instead of a custom printer | Formatting stays 100% Prettier; we only change string contents                                              |
| Async parse                                       | Prettier 3 supports it; `loadConfig` and `parseToken` are async; no `synckit` worker needed (unlike ESLint) |
| Same ordering as the ESLint rule                  | Predictable for UnoCSS users; one source of truth                                                           |
| No config → no-op                                 | Guessing presets would produce wrong orders silently                                                        |
| Object keys only in clsx-like functions           | In `tv`/`cva` keys are names (`base`, `size`), not classes                                                  |
| Duplicate classes are kept                        | Same as the ESLint rule; see Duplicates above                                                                |

## Known limitations

- This plugin must be the last one in `plugins` (see Parsers of other plugins). Plugins that replace parsers other than the ones listed in the README may work the same way, but are not tested.
- Only one class sorter: with `prettier-plugin-tailwindcss` the two would undo each other's work. Out of scope.
- Attributify mode is not supported.

## References

- UnoCSS ESLint plugin: `packages-integrations/eslint-plugin` (rule `order`, `worker.ts`)
- UnoCSS sort utility: `virtual-shared/integration/src/sort-rules.ts`
- `prettier-plugin-tailwindcss` source: parser wrapping and plugin compatibility
- Prettier plugin API: `https://prettier.io/docs/plugins`

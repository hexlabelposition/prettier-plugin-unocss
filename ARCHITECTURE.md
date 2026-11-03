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
  parsers.ts      Wraps built-in parsers (withSorting)
  generator.ts    Loads uno.config, caches UnoGenerator instances
  sort.ts         Ordering algorithm (string in → string out)
  transform/
    index.ts      sortClassesInAst: collect, sort, rewrite
    walk.ts       Generic AST walker
    collect.ts    Finds class strings in an ESTree/Babel AST
    rewrite.ts    Writes sorted strings back (value + raw)
    template.ts   Template literal handling
  options.ts      Option definitions and their types
```

Dependency direction: `index → parsers → (generator, transform) → sort`. `sort.ts` knows nothing about Prettier or ASTs; `transform/` knows nothing about UnoCSS internals beyond calling `sort`.

> Language-specific transforms (HTML, Vue, Svelte, Astro) will live next to `collect.ts` as separate collectors, because each has its own AST shape.

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

Open issue: the cache never invalidates. Editors keep Prettier alive between saves, so a changed `uno.config` is not picked up until restart. See BACKLOG.

## AST rewriting (`transform/`)

**Collection.** A class context is:

- the value of a JSX attribute listed in `unoAttributes`;
- an argument of a call to a function listed in `unoFunctions`;
- the quasi of a tagged template whose tag is in `unoFunctions`.

Inside a class context, strings and template literals are collected from **class positions** only, recursively: the branches of a conditional (not its test), both sides of a logical expression, array elements, spread arguments, object property **values**, and template expressions that stand apart from the text around them (`` `p-4 ${on ? 'a b' : ''}` ``). TypeScript wrappers (`as`, `satisfies`, `!`) are transparent, and `` String.raw`…` `` is handled like a plain template literal (as in the ESLint rule). Any other expression (`a === 'x'`, `other('x')`, `obj['x']`, `'x'.split(' ')`) is not a class position: its strings are left alone, but it is still searched for nested class contexts, so `merge(clsx('…'))` is sorted.

**Object keys** are classes inside clsx-like functions (`clsx({ 'p-4 flex': on })`), but names in `tv` and `cva` (`tv({ base: '…' })`) and in JSX attributes, where they are never touched. The variant functions are a fixed list (`tv`, `cva`) in `collect.ts`. Only static keys are sorted (`'a b'`, `['a b']`, `` [`a b`] ``), and only in objects without spreads. The keys of one object are sorted as a group: if sorting would make two keys equal (`{ 'p-4 flex': a, 'flex p-4': b }`), the later one would override the earlier one, so the whole object's keys are left alone.

This is a superset of the ESLint `order` rule, which looks only one level deep (call arguments, and literals directly in JSX attributes).

Strings are collected first and sorted after the walk, because sorting is async and mutating while walking is error-prone.

**Rewriting.** Prettier printers print string literals from their **raw** source text (to keep quotes and escapes), so we update `value`, `raw` and Babel's `extra.raw` / `extra.rawValue` together, keeping the original quote character.

**Template literals.** An expression is a class position only when whitespace or the template's edge is on both sides of it. In `` `bg-${on ? 'red-500 x' : 'blue-500'}` `` the strings are fragments of the class `bg-…`, and sorting them would change the class, so they are left alone (nested `clsx(…)` calls are still sorted).

A quasi chunk may be glued to an expression: in `` `p-2 bg-${c}-500` `` the chunk `p-2 bg-` ends with a partial class. Glued fragments at the edges of a chunk are kept in place; only whole classes in between are sorted. Leading/trailing whitespace of each chunk is preserved, because it separates classes from expressions.

**Safety rule.** When unsure, don't touch. Strings with quotes or backslashes inside are currently skipped. A wrong sort is worse than no sort: formatting must never change behaviour.

## Key decisions

| Decision                                          | Why                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Wrap built-in parsers instead of a custom printer | Formatting stays 100% Prettier; we only change string contents                                              |
| Async parse                                       | Prettier 3 supports it; `loadConfig` and `parseToken` are async; no `synckit` worker needed (unlike ESLint) |
| Same ordering as the ESLint rule                  | Predictable for UnoCSS users; one source of truth                                                           |
| No config → no-op                                 | Guessing presets would produce wrong orders silently                                                        |
| Object keys only in clsx-like functions           | In `tv`/`cva` keys are names (`base`, `size`), not classes                                                  |

## Known limitations

- Only one plugin can wrap a given parser: combining with other parser-wrapping plugins (organize-imports, sort-imports, prettier-plugin-svelte, …) needs a compatibility layer.
- Attributify mode is not supported.

## References

- UnoCSS ESLint plugin: `packages-integrations/eslint-plugin` (rule `order`, `worker.ts`)
- UnoCSS sort utility: `virtual-shared/integration/src/sort-rules.ts`
- `prettier-plugin-tailwindcss` source: parser wrapping and plugin compatibility
- Prettier plugin API: `https://prettier.io/docs/plugins`

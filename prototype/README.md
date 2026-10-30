# prettier-plugin-unocss (prototype)

Prettier 3 plugin that sorts UnoCSS utilities in the order UnoCSS emits them in CSS,
using your own `uno.config.*`, the same approach as the `order` rule of `@unocss/eslint-plugin`.

```bash
npm install
npm run play   # format playground/example.tsx
npm test
```

## How it works

```text
source → built-in Prettier parser → AST → [plugin rewrites class strings] → Prettier printer → output
```

1. **`src/index.js`**: wraps Prettier's own `babel`, `babel-ts` and `typescript` parsers
   (`withSorting`). After the original parser builds the AST, the plugin walks it, collects
   strings that contain classes, sorts them, and returns the AST to Prettier unchanged otherwise.
   This is the same trick `prettier-plugin-tailwindcss` uses.
   - What counts as "classes": JSX attributes from `unoAttributes` (`class`, `className`)
     and string arguments of functions from `unoFunctions` (`clsx`, `cn`, `tv`, `cva`, …).
   - In objects (`tv({ base: '…' })`) only **values** are sorted, keys are left alone.
   - `setStringValue` also updates `raw` / `extra.raw`, because printers print the raw text.
   - Template literals: chunks glued to `${…}` (like `bg-${color}`) stay where they are.
2. **`src/generator.js`**: loads `uno.config.*` via `@unocss/config` (searching up from the
   formatted file, so monorepos work) and caches one generator per config location.
   No config → the file is left untouched.
3. **`src/sort.js`**: the ordering itself, adapted from UnoCSS's internal `sort-rules.ts` (MIT):
   - `uno.parseToken(cls)` → index of the matched rule in the config;
   - each variant (`hover:`, `md:`) adds `100_000`, pushing the class back;
   - unknown classes go first, in their original order;
   - variant groups `hover:(a b)` are expanded before sorting and collapsed after.

## Options

| Option          | Default                                           |                                        |
| --------------- | ------------------------------------------------- | -------------------------------------- |
| `unoConfig`     | auto                                              | Path to `uno.config.*`                 |
| `unoAttributes` | `["class", "className"]`                          | JSX attributes to sort                 |
| `unoFunctions`  | `["clsx", "cn", "cx", "classnames", "tv", "cva"]` | Functions whose string args are sorted |

## Not done yet (known limitations)

- Only JS/TS/JSX. No Vue, Svelte, Astro, HTML.
- No compatibility layer with other plugins that wrap the same parsers
  (`prettier-plugin-organize-imports`, sort-imports, …): whichever is listed last wins.
- clsx-style object keys (`clsx({ 'p-4 flex': cond })`) are not sorted.
- Strings with quotes or backslashes inside are skipped.
- Strings inside `${…}` of a template literal are not sorted.
- Attributify mode (`<div p-4 flex>`) is not supported.
- No duplicate removal.

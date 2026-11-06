# prettier-plugin-unocss

> 🚧 Work in progress, not published to npm yet.

A [Prettier](https://prettier.io) plugin that sorts [UnoCSS](https://unocss.dev) utilities, using **your own `uno.config`**. Custom rules, shortcuts and presets are sorted correctly, in the same order as the UnoCSS ESLint rule.

```diff
- <div className="shadow md:p-8 p-4 my-custom rounded-lg bg-white flex">
+ <div className="my-custom flex rounded-lg bg-white p-4 shadow md:p-8">
```

Think [`prettier-plugin-tailwindcss`](https://github.com/tailwindlabs/prettier-plugin-tailwindcss), but for UnoCSS.

| Section                                                                 | What's inside                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Why](#why)                                                             | What the plugin is for                                       |
| [Installation](#installation)                                           | Install and enable it                                        |
| [What gets sorted](#what-gets-sorted)                                   | Languages, attributes and functions                          |
| [How classes are ordered](#how-classes-are-ordered)                     | The order, duplicates, line breaks                           |
| [Using with other Prettier plugins](#using-with-other-prettier-plugins) | Plugin order, Svelte, Astro, import sorters                  |
| [Options](#options)                                                     | `unoConfig`, `unoAttributes`, `unoFunctions`, `unoVariables` |
| [Performance](#performance)                                             | Cost of the first and every next file                        |
| [Development](#development)                                             | Scripts and tests                                            |
| [Credits](#credits)                                                     | Where the code comes from                                    |
| [License](#license)                                                     | MIT                                                          |

## Why

UnoCSS already sorts classes with the ESLint rule [`@unocss/order`](https://unocss.dev/integrations/eslint). This plugin brings the same order to Prettier, for projects that format with Prettier and want classes sorted on save. Discussion: [unocss/unocss#5411](https://github.com/unocss/unocss/discussions/5411).

## Installation

```bash
pnpm add -D prettier prettier-plugin-unocss
```

```json
// .prettierrc
{
  "plugins": ["prettier-plugin-unocss"]
}
```

That's it. The plugin finds `uno.config.*` (or `unocss.config.*`) next to each file or in a parent directory, so monorepos with several configs work. A file without a config is left untouched.

## What gets sorted

| Where               | What                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| JS / TS / JSX / TSX | `class` and `className`, `clsx` / `cn` / `cx` / `classnames` / `tv` / `cva` calls, class variables (`const clsButton = '…'`) |
| Vue                 | `class`, `:class` (strings, arrays, objects), attributify (`<div p-4 flex>`)                                                 |
| HTML                | `class`                                                                                                                      |
| Svelte              | `class="…"`, `class={…}`; `class:name` directives are left alone                                                             |
| Astro               | `class`, `class:list`                                                                                                        |

`<script>` blocks and the Astro frontmatter are sorted like any JS/TS file.

Inside class functions and attributes, the plugin also follows conditionals (`on ? 'a b' : 'c'`), `&&` / `||` / `??`, arrays, object values, template literals and tagged templates (``tw`…` ``). Object **keys** are classes in `clsx`-like functions (`clsx({ 'p-4 flex': on })`), but never in `tv` / `cva`, where they are names.

Attributify utilities are sorted only when `presetAttributify` is in your config.

## How classes are ordered

1. Classes UnoCSS doesn't know come first, in their original order.
2. Then utilities, in the order of the rules that match them in your config.
3. Utilities with variants (`hover:`, `md:`) come after the ones without; more variants, further back.
4. Variant groups `hover:(a b)` are sorted inside and stay grouped.

Like `eslint --fix` with the UnoCSS rule, the plugin keeps duplicate classes (`p-4 flex p-4` → `flex p-4 p-4`) and puts a class list split over several lines on one line.

Formatting never changes what your code does: when a string is ambiguous (unusual escapes, a class glued to `${…}`), it is left alone.

## Using with other Prettier plugins

Put `prettier-plugin-unocss` **last** in `plugins`:

```json
{
  "plugins": [
    "prettier-plugin-svelte",
    "prettier-plugin-astro",
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-unocss"
  ]
}
```

Prettier lets only one plugin own a parser, the last one. This plugin builds on the parser of the plugins before it, so their changes are kept and classes are sorted on top. Tested with:

| Plugin                                  | Notes                      |
| --------------------------------------- | -------------------------- |
| `prettier-plugin-svelte`                | Needed for `.svelte` (v4+) |
| `prettier-plugin-astro`                 | Needed for `.astro` (v1+)  |
| `prettier-plugin-organize-imports`      | JS, TS, Vue                |
| `@ianvs/prettier-plugin-sort-imports`   | JS, TS, Vue                |
| `@trivago/prettier-plugin-sort-imports` | JS, TS, Vue, Svelte        |

Don't use it together with `prettier-plugin-tailwindcss`: both sort classes, by different orders.

## Options

| Option          | Default                                           | Description                                               |
| --------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `unoConfig`     | found automatically                               | Path to the UnoCSS config file                            |
| `unoAttributes` | `["class", "className"]`                          | Attributes whose value is sorted                          |
| `unoFunctions`  | `["clsx", "cn", "cx", "classnames", "tv", "cva"]` | Functions whose arguments are sorted                      |
| `unoVariables`  | `["^cls", "classNames?$"]`                        | Regular expressions (case-insensitive) for variable names |

## Performance

The config is loaded once per Prettier process, so the first file pays for it; every next file pays only for sorting. In an editor Prettier keeps running, so a save costs only the per-file time, and the config is loaded again only when it changes.

`pnpm bench`: 200 generated TSX files with about 50 class strings each, median of 5 runs, Intel Core i5-11400H, Node 26, `presetWind3`:

|                   | First file | Each next file |
| ----------------- | ---------: | -------------: |
| Prettier          |      99 ms |         6.3 ms |
| Prettier + plugin |     482 ms |        10.9 ms |
| Plugin overhead   |     383 ms |         4.6 ms |

`presetWind4`, `presetMini` and `presetIcons` give about the same numbers. Icon collections are not loaded for sorting.

## Development

```bash
pnpm install
pnpm test        # Vitest
pnpm play        # format playground/example.tsx with the local build
pnpm bench       # benchmark, see Performance
pnpm lint
pnpm typescheck
```

Tests check that every fixture gives the same result as `eslint --fix` with the UnoCSS rules, apart from documented differences. To compare on a real project: `CORPUS=path/to/project pnpm vitest run test/eslint-corpus.test.ts`.

How it works: [`ARCHITECTURE.md`](./ARCHITECTURE.md). What's next: [`BACKLOG.md`](./BACKLOG.md).

## Credits

The ordering algorithm is adapted from the `sortRules` utility of [UnoCSS](https://github.com/unocss/unocss) ([MIT](https://github.com/unocss/unocss/blob/main/LICENSE)), used by its ESLint plugin. The parser wrapping follows `prettier-plugin-tailwindcss`.

This is an independent community project, not affiliated with or endorsed by the UnoCSS team.

## License

[MIT](./LICENSE)

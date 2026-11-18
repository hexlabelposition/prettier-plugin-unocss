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
| [Limitations](#limitations)                                             | What isn't sorted or needs care                              |
| [Performance](#performance)                                             | Cost of the first and every next file                        |
| [Development](#development)                                             | Scripts and tests                                            |
| [Credits](#credits)                                                     | Where the code comes from                                    |
| [License](#license)                                                     | MIT                                                          |

## Why

UnoCSS already sorts classes with the ESLint rule [`@unocss/order`](https://unocss.dev/integrations/eslint). This plugin brings the same order to Prettier, for projects that format with Prettier and want classes sorted on save, without running ESLint for it.

## Installation

Requires Node.js 22.18 or later and Prettier 3.

```bash
pnpm add -D prettier prettier-plugin-unocss
# or
npm install -D prettier prettier-plugin-unocss
```

```js
// prettier.config.js

/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ['prettier-plugin-unocss'],
}

export default config
```

That's it. The plugin finds `uno.config.*` (or `unocss.config.*`) next to each file or in a parent directory, so monorepos with several configs work. A file without a config is left untouched. If the config fails to load, Prettier reports the error with the config path, instead of silently not sorting.

In an editor, the config is loaded again when it changes, so there is no need to restart Prettier.

## What gets sorted

| Where               | What                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| JS / TS / JSX / TSX | `class` and `className`, `clsx` / `cn` / `cx` / `classnames` / `tv` / `cva` calls, class variables (`const clsButton = '…'`) |
| Vue                 | `class`, `:class` (strings, arrays, objects), attributify (`<div p-4 flex>`)                                                 |
| HTML                | `class`                                                                                                                      |
| Svelte              | `class="…"`, `class={…}`; `class:name` directives are left alone                                                             |
| Astro               | `class`, `class:list`                                                                                                        |

`<script>` blocks and the Astro frontmatter are sorted like any JS/TS file.

Inside class functions and attributes, the plugin also follows conditionals (`on ? 'a b' : 'c'`), `&&` / `||` / `??`, arrays, object values, template literals, and tagged templates whose tag is in `unoFunctions` (add `tw` there for ``tw`…` ``). Object **keys** are classes in `clsx`-like functions (`clsx({ 'p-4 flex': on })`), but never in `tv` / `cva`, where they are names.

Attributify utilities are sorted only when `presetAttributify` is in your config.

## How classes are ordered

1. Classes UnoCSS doesn't know come first, in their original order.
2. Then utilities, in the order of the rules that match them in your config.
3. Utilities with variants (`hover:`, `md:`) come after the ones without; more variants, further back.
4. Variant groups `hover:(a b)` are sorted inside and stay grouped.

Icons from `presetIcons` count as unknown classes and go first, as with the ESLint rule: icon collections are not loaded for sorting.

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
| `unoConfig`     | found automatically                               | Path to the UnoCSS config file, relative to the cwd       |
| `unoAttributes` | `["class", "className"]`                          | Attributes whose value is sorted                          |
| `unoFunctions`  | `["clsx", "cn", "cx", "classnames", "tv", "cva"]` | Functions and template tags whose arguments are sorted    |
| `unoVariables`  | `["^cls", "classNames?$"]`                        | Regular expressions (case-insensitive) for variable names |

A list you set replaces the default, so repeat the defaults you want to keep:

```ts
// prettier.config.ts
import type { Config } from 'prettier'
import type { PluginOptions } from 'prettier-plugin-unocss'

const config: Config & PluginOptions = {
  plugins: ['prettier-plugin-unocss'],
  unoFunctions: ['clsx', 'cn', 'tw'],
}

export default config
```

## Limitations

- **Config imports.** Only the config file and its `configDeps` are watched for changes. If `uno.config.ts` imports your own files (a shared preset, a theme), list them in `configDeps`, or the editor keeps the old order until it restarts Prettier.
- **Attributify** is sorted only in Vue templates, and only valueless attributes (`<div p-4 flex>`, not `text="sm white"`).
- **CSS** is not touched: `@apply` and `--at-apply` lists are left as they are.
- **Plugin order.** This plugin must be last in `plugins`, see above. Plugins that replace other parsers than the tested ones may work, but are not tested.
- **Svelte:** in editors, the cursor may move a little within a line whose classes were sorted.

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
pnpm typecheck
```

Tests check that every fixture gives the same result as `eslint --fix` with the UnoCSS rules, apart from documented differences. To compare on a real project: `CORPUS=path/to/project pnpm vitest run test/eslint-corpus.test.ts`.

Releases: `pnpm release` asks for the new version, then commits, tags (both signed) and pushes it; the tag makes CI create the GitHub release with notes from the commit messages. Changes: [`CHANGELOG.md`](./CHANGELOG.md).

How it works: [`ARCHITECTURE.md`](./ARCHITECTURE.md). What's next: [`BACKLOG.md`](./BACKLOG.md).

## Credits

Classes are sorted by `sortRules` from [`@unocss/core`](https://github.com/unocss/unocss), the function behind the UnoCSS ESLint plugin. The parser wrapping follows `prettier-plugin-tailwindcss`.

This is an independent community project, not affiliated with or endorsed by the UnoCSS team.

## License

[MIT](./LICENSE)

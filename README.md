# prettier-plugin-unocss

> 🚧 Work in progress, not published to npm yet.

A [Prettier](https://prettier.io) plugin that sorts [UnoCSS](https://unocss.dev) utilities in the same order UnoCSS emits them in the generated CSS, using **your own `uno.config`**, so custom rules, shortcuts and presets are sorted correctly.

Think [`prettier-plugin-tailwindcss`](https://github.com/tailwindlabs/prettier-plugin-tailwindcss), but for UnoCSS.

```diff
- <div className="shadow md:p-8 p-4 my-custom rounded-lg bg-white flex">
+ <div className="my-custom flex rounded-lg bg-white p-4 shadow md:p-8">
```

## Why

UnoCSS already ships class sorting as an ESLint rule ([`@unocss/order`](https://unocss.dev/integrations/eslint)). Many projects format with Prettier only, and want sorting to happen on save together with the rest of formatting. This plugin brings the same ordering to Prettier.

Related discussion in the UnoCSS repository: [unocss/unocss#5411](https://github.com/unocss/unocss/discussions/5411).

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

The plugin finds `uno.config.*` (or `unocss.config.*`) by searching up from each formatted file, so monorepos with several configs work. If no config is found, the file is left untouched.

## What gets sorted

- JSX attributes `class` and `className`
- HTML: `class="…"` (`<script>` is sorted like any JS file)
- Vue templates: `class="…"`, and `:class` / `v-bind:class` as a whole: strings, arrays, objects (keys are classes, as in Vue), conditionals; `<script>` is sorted like any JS/TS file
- String arguments of `clsx`, `cn`, `cx`, `classnames`, `tv`, `cva`
- Inside those: branches of `cond ? 'a' : 'b'`, both sides of `&&` / `||` / `??`, arrays, object **values**
- Object **keys** in clsx-like functions: `clsx({ 'p-4 flex': on })`, but never in `tv` / `cva`, where keys are names
- Tagged templates of the functions above, e.g. ``tw`...` ``, and ``String.raw`...` ``
- Template literals, keeping fragments glued to `${…}` (like `bg-${color}`) in place; strings inside a standalone `${…}` are sorted too
- Values of variables whose name matches `unoVariables`: `const clsButton = '…'`, `const buttonClassNames = { … }`

## How classes are ordered

1. Classes unknown to UnoCSS go first, in their original order.
2. Known utilities follow, in the order of the rules that match them in your config.
3. Utilities with variants (`hover:`, `md:`, `dark:`) go after those without; more variants → further back.
4. Variant groups `hover:(a b)` are sorted inside and kept collapsed.

Duplicate classes are kept (`p-4 flex p-4` → `flex p-4 p-4`), as with the UnoCSS `order` rule.

Whitespace between classes is collapsed to single spaces, so a class list split over several lines ends up on one line, as with `eslint --fix` and the UnoCSS `order` rule. A line break at the start or end of a string is dropped; in a template literal it becomes one space, which may separate classes from `${…}`.

## Options

| Option          | Default                                           | Description                                                         |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `unoConfig`     | auto                                              | Path to the UnoCSS config file                                      |
| `unoAttributes` | `["class", "className"]`                          | Attributes whose value is sorted (JSX, HTML, Vue `class`/`:class`)  |
| `unoFunctions`  | `["clsx", "cn", "cx", "classnames", "tv", "cva"]` | Functions whose string arguments are sorted                         |
| `unoVariables`  | `["^cls", "classNames?$"]`                        | Regular expressions (case-insensitive) for variable names to sort   |

## Performance

Loading `uno.config` and creating the UnoCSS generator happens once per config file and Prettier process, so it is paid by the first formatted file. Every next file pays only for sorting. In editors Prettier keeps running, so a save costs the per-file time; the config is loaded again only when it changes.

`pnpm bench` formats 200 generated TSX files (about 170 lines and 50 class strings each, once formatted) with the `playground` config (`presetWind3`), median of 5 runs, on an Intel Core i5-11400H with Node 26:

|                   | First file | Each next file |
| ----------------- | ---------: | -------------: |
| Prettier          |      99 ms |         6.3 ms |
| Prettier + plugin |     482 ms |        10.9 ms |
| Plugin overhead   |     383 ms |         4.6 ms |

Icon collections from `@iconify-json/*` are not loaded for sorting, so `presetIcons` doesn't add to these numbers.

## Supported languages

| Language                            | Status     |
| ----------------------------------- | ---------- |
| JavaScript / TypeScript / JSX / TSX | ✅         |
| HTML                                | ✅         |
| Vue                                 | ✅         |
| Svelte                              | 🚧 planned |
| Astro                               | 🚧 planned |

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm play        # format playground/ with the local build
pnpm bench       # first-file and per-file cost, see Performance
pnpm lint
```

`test/eslint.test.ts` checks that every fixture gives the same result as `eslint --fix` with the UnoCSS `order` rule, except for the documented differences. To compare on real files: `CORPUS=path/to/project pnpm vitest run test/eslint-corpus.test.ts`.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the plugin works and [`BACKLOG.md`](./BACKLOG.md) for what's next.

## Disclaimer

This is an independent community project. It is not affiliated with or endorsed by the UnoCSS team.

## Credits

The ordering algorithm is adapted from UnoCSS's internal `sort-rules` utility used by `@unocss/eslint-plugin` ([MIT](https://github.com/unocss/unocss/blob/main/LICENSE)). The parser-wrapping approach follows `prettier-plugin-tailwindcss`.

## License

[MIT](./LICENSE)

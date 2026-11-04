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
| `unoAttributes` | `["class", "className"]`                          | JSX attributes whose value is sorted                                |
| `unoFunctions`  | `["clsx", "cn", "cx", "classnames", "tv", "cva"]` | Functions whose string arguments are sorted                         |
| `unoVariables`  | `["^cls", "classNames?$"]`                        | Regular expressions (case-insensitive) for variable names to sort   |

## Supported languages

| Language                            | Status     |
| ----------------------------------- | ---------- |
| JavaScript / TypeScript / JSX / TSX | ✅         |
| HTML                                | 🚧 planned |
| Vue                                 | 🚧 planned |
| Svelte                              | 🚧 planned |
| Astro                               | 🚧 planned |

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm play        # format playground/ with the local build
pnpm lint
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the plugin works and [`BACKLOG.md`](./BACKLOG.md) for what's next.

## Disclaimer

This is an independent community project. It is not affiliated with or endorsed by the UnoCSS team.

## Credits

The ordering algorithm is adapted from UnoCSS's internal `sort-rules` utility used by `@unocss/eslint-plugin` ([MIT](https://github.com/unocss/unocss/blob/main/LICENSE)). The parser-wrapping approach follows `prettier-plugin-tailwindcss`.

## License

[MIT](./LICENSE)

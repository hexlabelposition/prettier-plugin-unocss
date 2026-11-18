# Backlog

1.0 is released on npm as an unofficial community package. Below: what is done, and ideas that are not planned yet. Rules for changing the code are in [`AGENTS.md`](./AGENTS.md).

| Section                                 | What's inside                                    |
| --------------------------------------- | ------------------------------------------------ |
| [Done](#done)                           | What the plugin does today, in the order it came |
| [Ideas](#ideas)                         | Possible next steps, not planned                 |

## Done

1. **Project setup.** pnpm, ESM, strict TypeScript, `tsdown`, Vitest, `@antfu/eslint-config`, MIT license, CI with lint, typecheck and tests on Node 22, 24 and 26, `playground/`.
2. **Prototype ported to TypeScript.** Config loading with a cache, parser wrapping for `babel`, `babel-ts`, `typescript`, `acorn`, `espree` and `meriyah`, options `unoConfig`, `unoAttributes`, `unoFunctions`. The prototype tests became fixtures.
3. **JS / TS edge cases.**
   - Conditionals, `&&` / `||` / `??`, arrays, `${…}` in templates, `String.raw`.
   - Object keys as classes in `clsx`-like functions, never in `tv` / `cva`.
   - `unoVariables`, like the ESLint rule.
   - Quotes, escapes and entities are kept as written.
   - Multiline class lists go on one line, and duplicates are kept, both as with the ESLint rule.
   - Output compared with `eslint --fix` on fixtures and on real projects.
4. **Config and performance.**
   - The config is reloaded when it or its `configDeps` change.
   - Icon collections aren't loaded for sorting.
   - A config that fails to load is reported with its path.
   - Benchmark numbers are in the README.
5. **Other languages.** Vue (`class`, `:class`, `<script>`), HTML, Svelte (`class:` directives are left alone), Astro (`class`, `class:list`).
6. **Other Prettier plugins.** Built on the parsers of `prettier-plugin-svelte`, `prettier-plugin-astro`, `prettier-plugin-organize-imports`, `@ianvs/prettier-plugin-sort-imports` and `@trivago/prettier-plugin-sort-imports`, with ours last in `plugins`. Use with `prettier-plugin-tailwindcss` is not supported: only one class sorter should run.
7. **Attributify** in Vue templates, like `order-attributify`, when `presetAttributify` is in the config.
8. **Official order.** Classes are sorted by `sortRules` from `@unocss/core` 66.13.0 ([unocss/unocss#5439](https://github.com/unocss/unocss/pull/5439)), instead of a local copy.
9. **Release 1.0.**
   - Released as a community package: [discussion #5411](https://github.com/unocss/unocss/discussions/5411) gave no answer on moving it into the UnoCSS monorepo.
   - The README says that the plugin is unofficial.
   - `pnpm release` (`bumpp`, signed commit and tag).
   - A release workflow that checks the tag, runs CI, builds without publishing permissions, stages the package on npm with trusted publishing and provenance, and creates the GitHub release with `changelogithub`.
   - The release is announced in the discussion.

## Ideas

Not planned. Each one needs a reason (a user request, an upstream change) before it is picked up.

**Upstream, if the UnoCSS team is interested:**

- Move the plugin into the UnoCSS monorepo as `@unocss/prettier-plugin`.
- An official way for `@unocss/preset-icons` to skip loading collections, instead of setting `process.env.ESLINT` (`src/icons.ts`).
- Export the config file names from `@unocss/config` (`CONFIG_FILES` in `src/generator.ts`).

**In this plugin** (from the limitations in the README and `ARCHITECTURE.md`):

- Attributify outside Vue templates (Svelte, Astro, JSX), and attributes with a value (`text="sm white"`).
- Class lists in CSS: `@apply` and `--at-apply`.
- Track the files a config imports, so `configDeps` isn't needed for them.
- Wrap the remaining HTML parsers: `angular`, `lwc`, `mjml`.

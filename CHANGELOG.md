# Changelog

Full release notes, generated from the commit messages, are on [GitHub Releases](https://github.com/hexlabelposition/prettier-plugin-unocss/releases).

## 1.0.0 (2026-11-18)

First release.

- Sorts UnoCSS utilities with your own `uno.config`, in the same order as the UnoCSS ESLint rule (`sortRules` from `@unocss/core`).
- Finds `uno.config.*` / `unocss.config.*` for each file, so monorepos with several configs work; files without a config are left alone.
- Reloads the config in editors when it or its `configDeps` change; reports a config that fails to load.
- Languages: JS, TS, JSX, TSX, Vue, HTML, Svelte, Astro, including `<script>` blocks and the Astro frontmatter.
- Class attributes, `clsx`-like functions, `tv` / `cva`, class variables, conditionals, arrays, objects and template literals.
- Attributify in Vue templates, when `presetAttributify` is in the config.
- Works with `prettier-plugin-svelte`, `prettier-plugin-astro`, `prettier-plugin-organize-imports`, `@ianvs/prettier-plugin-sort-imports` and `@trivago/prettier-plugin-sort-imports`.
- Options: `unoConfig`, `unoAttributes`, `unoFunctions`, `unoVariables`.
- Requires Node.js 22.18 or later and Prettier 3.

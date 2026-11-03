# Backlog

Work is split into milestones. Do them in order: each one builds on the previous.
Check items off (`[x]`) in the same commit that completes them.

## For coding agents: read first

- Read `ARCHITECTURE.md` before changing code. If a change contradicts it, update the doc in the same commit.
- The JavaScript prototype (commit `defa9a9`, removed in U1) was the reference implementation; its tests live on as fixtures in `test/fixtures/`. Don't redesign ported behaviour without a reason written in the commit or PR.
- **Never change behaviour of formatted code.** When a case is ambiguous (escapes, partial classes, unknown syntax), skip it. A missed sort is acceptable; a broken string is not.
- Every behaviour change gets a test. Prefer fixture tests (`test/fixtures/<case>/input.* → output.*`).
- Output must match the UnoCSS ESLint `order` rule for the same input. When in doubt, compare against it.
- Every formatter test must also check **idempotency**: formatting the output again gives the same output.
- Stack: TypeScript (strict), pnpm, Vitest, `@antfu/eslint-config`. Keep it close to UnoCSS conventions, so the code stays easy to contribute upstream if the UnoCSS team is interested.
- Don't publish to npm. Releases are done manually by the project author.
- Small commits, conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Open questions

Discussion: `https://github.com/unocss/unocss/discussions/5411`

- [ ] Monorepo package (`@unocss/prettier-plugin`) or community package?
- [ ] Will `sortRules` be exported, or do we keep our copy in `src/sort.ts`?

If the plugin ends up in the UnoCSS monorepo, stop after U2: the project author will discuss the next steps with the UnoCSS team.

---

## U0: Project setup

- [x] pnpm project, `"type": "module"`, Node ≥ 22 (Node 20 is EOL; tsdown and Vitest need ≥ 22), `prettier` ^3 as peer dependency
- [x] TypeScript strict config; build with `tsdown` (or `unbuild`, like UnoCSS) to ESM + `.d.ts`
- [x] Vitest, `@antfu/eslint-config`, scripts: `build`, `test`, `lint`, `typecheck`, `play`
- [x] `LICENSE` (MIT). Keep the attribution comment for the code adapted from UnoCSS in `src/sort.ts`
- [x] GitHub Actions CI: lint, typecheck, test on Node 22, 24 and 26
- [x] `playground/` with `uno.config.ts` and example files

**Done when:** `pnpm build && pnpm test && pnpm lint` pass in CI on an empty plugin.

## U1: Port the prototype to TypeScript

- [x] `sort.ts`: ordering algorithm + unit tests (unknown first, variants last, variant groups, shortcuts, empty input, extra whitespace)
- [x] `generator.ts`: config loading + cache (promise cache, no config → `undefined`)
- [x] `transform/`: walk, collect, rewrite, template handling, split as in ARCHITECTURE
- [x] `parsers.ts`: wrap `babel`, `babel-ts`, `typescript`, `acorn`, `espree`, `meriyah`
- [x] `options.ts`: `unoConfig`, `unoAttributes`, `unoFunctions` with types for `prettier.config.ts` users
- [x] Port all prototype tests to fixtures; delete `prototype/`

**Done when:** every prototype test passes as a fixture, `playground/example.tsx` formats identically to the prototype.

## U2: Correctness and edge cases (JS/TS)

- [x] Conditional / logical / array expressions inside class contexts: `cond ? 'a b' : 'c d'`, `[a && 'x y']`
- [x] clsx-style object **keys**: `clsx({ 'p-4 flex': on })`. Sort keys only inside clsx-like functions, never inside `tv`/`cva`
- [x] Strings inside `${…}` of class template literals
- [x] `String.raw` templates (the ESLint rule supports them)
- [ ] `unoVariables` option, like the ESLint rule: sort string values assigned to variables matching regexes (`^cls`, `classNames?$`)
- [ ] Strings with quotes / escapes: handle correctly instead of skipping, with tests for `'`, `"`, `\\`
- [ ] Multiline class strings: decide (keep line breaks or collapse?) and document
- [ ] Duplicate classes: decide whether to remove (the ESLint rule doesn't) and document
- [ ] Compare output with `@unocss/eslint-plugin` on a corpus of real files; add mismatches as fixtures

**Done when:** a shared fixture set gives identical results with this plugin and with `eslint --fix` using `@unocss/order`.

## U3: Config handling and performance

- [ ] Cache invalidation: reload the generator when `uno.config.*` (or its imports, see `sources` from `loadConfig`) changes; check mtime
- [ ] Icons preset: avoid loading icon collections during sorting (the ESLint plugin sets `process.env.ESLINT`); find a clean equivalent
- [ ] Clear error when the config fails to load (show the path and the cause, don't crash Prettier silently)
- [ ] Benchmark: format N files, measure first-file and per-file cost; add the numbers to the README

## U4: Other languages

Each language is its own collector + fixtures. Order by usage among UnoCSS users:

- [ ] Vue: `class`, `:class` (static strings, arrays, objects), `<script>` via the JS collector
- [ ] HTML: `class` attribute
- [ ] Svelte: `class`, `class:` directives are NOT sorted; requires compatibility with `prettier-plugin-svelte` (see U5)
- [ ] Astro: `class`, `class:list`; requires `prettier-plugin-astro` compatibility

## U5: Compatibility with other Prettier plugins

Prettier lets only one plugin own a parser name. Study how `prettier-plugin-tailwindcss` solves this (it detects known plugins and wraps their parsers) and implement:

- [ ] `prettier-plugin-svelte`, `prettier-plugin-astro`
- [ ] `prettier-plugin-organize-imports`, `@ianvs/prettier-plugin-sort-imports`, `@trivago/prettier-plugin-sort-imports`
- [ ] Document the required plugin order in `plugins` (ours last)
- [ ] Coexistence with `prettier-plugin-tailwindcss` is out of scope: document that only one sorter should be used

## U6: Attributify (optional)

- [ ] Sort attributify attributes like the ESLint rule `order-attributify` (`<div p-4 flex>`), only when `presetAttributify` is in the config

## U7: First release

- [ ] README: final usage, options, limitations, comparison with the ESLint rule
- [ ] `CHANGELOG.md`, release tooling (`bumpp` + `changelogithub`, like UnoCSS)
- [ ] npm publish with provenance from CI (the project author triggers it)
- [ ] Post the release in discussion #5411

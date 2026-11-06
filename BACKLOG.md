# Backlog

Work is split into milestones, done in order: each one builds on the previous. U0–U6 are done; what's left depends on the UnoCSS team, see **Waiting on UnoCSS**.
Check items off (`[x]`) in the same commit that completes them.

| Section                                                                     | Status                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------- |
| [Waiting on UnoCSS](#waiting-on-unocss)                                     | ⏳ Decided by the UnoCSS team; blocks what follows |
| [↳ Release](#release-only-as-a-community-package)                           | ⏸️ On hold until the package question is answered  |
| [↳ Later](#later-only-if-the-unocss-team-is-interested)                     | 💡 Ideas for upstream, not planned                 |
| [For coding agents](#for-coding-agents-read-first)                          | Rules for changing the code                        |
| [U0: Project setup](#u0-project-setup)                                      | ✅ Done                                            |
| [U1: Port the prototype](#u1-port-the-prototype-to-typescript)              | ✅ Done                                            |
| [U2: Correctness and edge cases](#u2-correctness-and-edge-cases-jsts)       | ✅ Done                                            |
| [U3: Config handling and performance](#u3-config-handling-and-performance)  | ✅ Done                                            |
| [U4: Other languages](#u4-other-languages)                                  | ✅ Done                                            |
| [U5: Other Prettier plugins](#u5-compatibility-with-other-prettier-plugins) | ✅ Done                                            |
| [U6: Attributify](#u6-attributify)                                          | ✅ Done                                            |

## Waiting on UnoCSS

These decide what happens next, and the answers come from the UnoCSS team. Check them first: until they are answered, the work below them is on hold.

- [ ] **Monorepo or community package?** Asked in [discussion #5411](https://github.com/unocss/unocss/discussions/5411), no answer yet.
  - Monorepo (`@unocss/prettier-plugin`): the code moves to the UnoCSS repository and **Release** below is dropped; the project author discusses the next steps with the UnoCSS team.
  - Community package: do **Release** below from this repository.
- [ ] **`sortRules` exported from `@unocss/core`**: [PR #5439](https://github.com/unocss/unocss/pull/5439), open. Once it is released:
  - [ ] Replace the copy in `src/sort.ts` with the import; keep `sortPreservingEdges`, it is ours
  - [ ] Raise the minimum `@unocss/core` version to that release
  - [ ] Drop the attribution comment in `src/sort.ts` and update Credits in the README and the ordering section in `ARCHITECTURE.md`

### Release (only as a community package)

- [ ] README: final pass on usage, options and limitations
- [ ] `CHANGELOG.md`, release tooling (`bumpp` + `changelogithub`, like UnoCSS)
- [ ] npm publish with provenance from CI (the project author triggers it)
- [ ] Post the release in discussion #5411

### Later, only if the UnoCSS team is interested

- An official way for `@unocss/preset-icons` to skip loading collections, instead of setting `process.env.ESLINT` (`src/icons.ts`)
- Export the config file names from `@unocss/config` (`CONFIG_FILES` in `src/generator.ts`)

## For coding agents: read first

- Read `ARCHITECTURE.md` before changing code. If a change contradicts it, update the doc in the same commit.
- The JavaScript prototype (commit `defa9a9`, removed in U1) was the reference implementation; its tests live on as fixtures in `test/fixtures/`. Don't redesign ported behaviour without a reason written in the commit or PR.
- **Never change behaviour of formatted code.** When a case is ambiguous (escapes, partial classes, unknown syntax), skip it. A missed sort is acceptable; a broken string is not.
- Every behaviour change gets a test. Prefer fixture tests (`test/fixtures/<case>/input.* → output.*`).
- Output must match the UnoCSS ESLint rules (`order`, `order-attributify`) for the same input. When in doubt, compare against it.
- Every formatter test must also check **idempotency**: formatting the output again gives the same output.
- Stack: TypeScript (strict), pnpm, Vitest, `@antfu/eslint-config`. Keep it close to UnoCSS conventions, so the code stays easy to contribute upstream if the UnoCSS team is interested.
- Don't publish to npm. Releases are done manually by the project author.
- Small commits, conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

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
- [x] `unoVariables` option, like the ESLint rule: sort string values assigned to variables matching regexes (`^cls`, `classNames?$`)
- [x] Strings with quotes / escapes: handle correctly instead of skipping, with tests for `'`, `"`, `\\`
- [x] Multiline class strings: decide (keep line breaks or collapse?) and document
- [x] Duplicate classes: decide whether to remove (the ESLint rule doesn't) and document
- [x] Compare output with `@unocss/eslint-plugin` on a corpus of real files; add mismatches as fixtures

**Done when:** a shared fixture set gives identical results with this plugin and with `eslint --fix` using `@unocss/order`.

## U3: Config handling and performance

- [x] Cache invalidation: reload the generator when `uno.config.*` (or its imports, see `sources` from `loadConfig`) changes; check mtime
- [x] Icons preset: avoid loading icon collections during sorting (the ESLint plugin sets `process.env.ESLINT`); find a clean equivalent
- [x] Clear error when the config fails to load (show the path and the cause, don't crash Prettier silently)
- [x] Benchmark: format N files, measure first-file and per-file cost, for several presets; add the numbers to the README

## U4: Other languages

Each language is its own collector + fixtures. Order by usage among UnoCSS users:

- [x] Vue: `class`, `:class` (static strings, arrays, objects), `<script>` via the JS collector
- [x] HTML: `class` attribute
- [x] Svelte: `class`, `class:` directives are NOT sorted; requires compatibility with `prettier-plugin-svelte` (see U5)
- [x] Astro: `class`, `class:list`; requires `prettier-plugin-astro` compatibility

## U5: Compatibility with other Prettier plugins

Prettier lets only one plugin own a parser name. Study how `prettier-plugin-tailwindcss` solves this (it detects known plugins and wraps their parsers) and implement:

- [x] `prettier-plugin-svelte` (done with U4 Svelte)
- [x] `prettier-plugin-astro` (done with U4 Astro)
- [x] `prettier-plugin-organize-imports`, `@ianvs/prettier-plugin-sort-imports`, `@trivago/prettier-plugin-sort-imports`
- [x] Document the required plugin order in `plugins` (ours last)
- [x] Coexistence with `prettier-plugin-tailwindcss` is out of scope: document that only one sorter should be used

## U6: Attributify

- [x] Sort attributify attributes like the ESLint rule `order-attributify` (`<div p-4 flex>`), only when `presetAttributify` is in the config

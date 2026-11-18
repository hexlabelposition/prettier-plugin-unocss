# Rules for coding agents

`prettier-plugin-unocss` is a Prettier plugin that sorts UnoCSS utilities with the project's own `uno.config`. How it works: [`ARCHITECTURE.md`](./ARCHITECTURE.md). What's done and possible next steps: [`BACKLOG.md`](./BACKLOG.md).

## Commands

```bash
pnpm test        # Vitest
pnpm lint        # ESLint, also checks code blocks in Markdown
pnpm typecheck
pnpm build
pnpm play        # format playground/example.tsx with the local build
```

## Rules

- Read `ARCHITECTURE.md` before changing code. If a change contradicts it, update the doc in the same commit.
- The JavaScript prototype (commit `defa9a9`) was the reference implementation; its tests live on as fixtures in `test/fixtures/`. Don't redesign ported behaviour without a reason written in the commit or PR.
- **Never change behaviour of formatted code.** When a case is ambiguous (escapes, partial classes, unknown syntax), skip it. A missed sort is acceptable; a broken string is not.
- Every behaviour change gets a test. Prefer fixture tests (`test/fixtures/<case>/input.* → output.*`).
- Output must match the UnoCSS ESLint rules (`order`, `order-attributify`) for the same input. When in doubt, compare against it.
- Every formatter test must also check **idempotency**: formatting the output again gives the same output.
- Stack: TypeScript (strict), pnpm, Vitest, `@antfu/eslint-config`. Keep it close to UnoCSS conventions, so the code stays easy to contribute upstream if the UnoCSS team is interested.
- Don't publish to npm or run `pnpm release`. The project author releases: `pnpm release`, then approves the staged version on npm.
- Small commits, conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). When an idea from `BACKLOG.md` is done, move it to **Done** in the same commit.

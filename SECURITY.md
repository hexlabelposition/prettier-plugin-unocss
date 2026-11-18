# Security Policy

## Supported versions

Security fixes are released for the latest minor version of 1.x.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately on GitHub instead: [Report a vulnerability](https://github.com/hexlabelposition/prettier-plugin-unocss/security/advisories/new) (the Security tab of this repository).

Include what you can: the affected version, steps or a file that reproduces it, and what an attacker could do with it.

What to expect:

- A first reply within a week. This is a project maintained by one person in their free time, so it may take a few days.
- If the report is accepted: a fix in a patch release, and a GitHub security advisory that credits you, unless you prefer not to be named.
- If the report is declined: an explanation why.

Please keep the details private until a fix is released.

## Scope

The plugin runs inside Prettier with the same rights as Prettier itself. Some things it does by design are not vulnerabilities:

- It loads and runs your `uno.config` and the files it imports, like UnoCSS, Vite and ESLint do. A config is code you trust.
- It runs the parsers of other Prettier plugins listed before it in `plugins`.

Examples of what is in scope: code from a formatted file being executed, or files outside the project being read or written. A class list sorted wrongly or a broken string after formatting is a bug: please [open an issue](https://github.com/hexlabelposition/prettier-plugin-unocss/issues) for it.

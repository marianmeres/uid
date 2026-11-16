# @marianmeres/uid — Agent Guide

## Quick Reference

- **Stack**: TypeScript (erasable-only), Node LTS (`.node-version`), pnpm,
  `node:test`, Biome. Core has zero runtime deps; `rhr` is an optional peer dep
  (`@marianmeres/random-human-readable`).
- **Install**: `pnpm install` | **Test**: `pnpm test` (watch: `pnpm run test:watch`)
  | **Check all**: `pnpm run ci` (typecheck + lint + test)
- **Deno suite**: `pnpm run test:deno` | **JSR dry run**: `pnpm run jsr:check`
  (must report no slow types)
- **Build npm**: `pnpm run build` (`tsc` → `dist/`) | **Release + publish**:
  `pnpm run rp` / `rpm` (human action)
- **Registries**: npm gets `dist/` (manifest `package.json`, the version of
  record); JSR gets the `.ts` source (manifest `jsr.json`, no version).
- **Targets**: browsers, Node 19+, Deno (Web Crypto global required).

## Project Structure

```
/src
  mod.ts        — core entry point (re-exports everything except rhr)
  uid.ts        — uid() dispatcher, strategy registry, per-strategy option types
  random.ts     — crypto core: randomBytes, randomString (rejection sampling),
                  ALPHABETS, DEFAULT_LENGTH, assert helpers
  uuid.ts       — uuid (v4), uuidv7, ulid
  base56.ts     — base56 random + reversible uuid<->base56 (fixed 23 chars)
  alphabet.ts   — nanoid, hex, base32, base36, base58, base62, numeric
  counter.ts    — counter (shared, per-prefix), createCounter, resetCounters
  reversible.ts — encodeInt / decodeInt (salt-shuffled, reversible)
  rhr.ts        — OPT-IN subpath "@marianmeres/uid/rhr": rhr() + self-registers
/tests          — one *.test.ts per src module (node:test + node:assert/strict)
/example        — interactive showcase (GitHub Pages via the root index.html)
  src/app.ts    — the page, bundled by @marianmeres/bundle to dist/bundle.js
                  (committed; `pnpm run release` rebuilds it before committing)
  server.ts     — static server for local viewing (demino), `pnpm run example:serve`
  themes/       — _generate.ts writes theme.css (design-tokens), `example:themes`
package.json    — manifest of record: version, npm exports, peer/dev deps, scripts
jsr.json        — JSR manifest: exports, jsr: import map, publish.include
tsconfig.json   — type gate (src + tests + example, noEmit)
tsconfig.build.json — src → dist (ESM + .d.ts) for npm
```

## Public API

Entry `@marianmeres/uid`: `uid(strategy?, options?)` dispatcher plus standalone
named exports for every strategy.

| Export                                                                   | Signature                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `uid`                                                                    | `(strategy?: string, options?) => string` (overloaded per strategy) |
| `uuid` / `uuidv7` / `ulid`                                               | `() => string` / `(timestamp?) => string`                           |
| `base56` / `base56Uuid`                                                  | `(length?) => string` / `() => string`                              |
| `uuidToBase56` / `base56ToUuid`                                          | `(string) => string` (reversible)                                   |
| `nanoid` / `hex` / `base32` / `base36` / `base58` / `base62` / `numeric` | `(length?, …) => string`                                            |
| `randomString` / `randomBytes`                                           | `(length, alphabet?) => string` / `(size) => Uint8Array`            |
| `counter` / `createCounter` / `resetCounters`                            | counter helpers                                                     |
| `encodeInt` / `decodeInt`                                                | reversible integer codec                                            |
| `registerStrategy` / `listStrategies`                                    | registry                                                            |
| `ALPHABETS` / `DEFAULT_LENGTH`                                           | constants                                                           |

Subpath `@marianmeres/uid/rhr`: `rhr(options?) => string` (also registers the
`rhr` strategy on import).

## Critical Conventions

1. **Core is zero-dependency.** Never import `@marianmeres/random-human-readable`
   from any module except `src/rhr.ts`. It is an _optional peer dep_ (and a
   devDependency, for the tests and the example) surfaced only via the `./rhr`
   subpath so its word lists stay out of the core bundle. Keep its range equal
   in `package.json` (peer + dev) and in `jsr.json`'s `imports`.
2. **All randomness flows through `random.ts`** (`randomBytes` / `randomString`,
   Web Crypto + rejection sampling). Never use `Math.random`.
3. **Adding a strategy** = (a) implement it as a standalone named export in the
   relevant file, (b) `registerStrategy("name", …)` in `src/uid.ts`, (c) add a
   typed overload signature to `uid` and an options interface. Keep both the
   named export and the dispatcher path working.
4. **Explicit return types on every exported symbol** — JSR rejects slow types.
   Verify with `pnpm run jsr:check` before publishing.
5. **base56-from-uuid is fixed-width 23 chars** (128 bits need 23 base56 digits;
   `56^22 < 2^128`). Do not "fix" it back to 22.
6. **Multi-file layout is intentional** (tree-shaking). Keep pure modules pure;
   `counter.ts` holds the only module-level mutable state (the shared counters).
7. **rhr strategy is opt-in**: `uid("rhr")` throws a helpful error until
   `import "@marianmeres/uid/rhr"` registers it. Tests must isolate this (see
   `tests/rhr.test.ts` — dynamic import, the only file touching the subpath).
   For the same reason `package.json` has **no `"sideEffects": false`**: the
   `./rhr` import is a side-effect import, and a bundler told the package is
   side-effect free may drop it.

## Tooling Conventions

1. **Runtime policy** — Node at the keyboard, npm as the registry of record, JSR
   kept for Deno consumers. No `Deno.*`, `Bun.*`, `jsr:` or `npm:` specifiers in
   `src/`, `tests/` or `example/`.
2. **Erasable TypeScript** — no `enum`, `namespace`, constructor parameter
   properties; `import type` for types; explicit `.ts` import extensions
   (rewritten to `.js` on emit). Node strips types and never checks them:
   `pnpm run typecheck` is the only type gate. `noUncheckedIndexedAccess` is off
   (Deno never had it, and the move off Deno changed no code).
3. **Formatting** — tabs, 4 wide, 90 columns, double quotes (`biome.json`);
   manifests at 2 spaces. `pnpm run format` before committing. Biome rules the
   code broke before the move are downgraded to `warn` in `biome.json`; fixing
   them is its own change. `example/reboot.css` (vendored) and
   `example/themes/theme.css` (generated) are excluded.
4. **JSR** — `deno publish` rewrites bare specifiers through `jsr.json`'s
   `imports` (so the JSR artifact depends on `jsr:@marianmeres/random-human-readable`,
   the copy Deno consumers already use) and gets the version via `--set-version`.
   It runs with `--no-check` (Deno's checker trips over `@types/node` in
   `node_modules`); the slow-types check still runs.
5. **Never run a script named `publish`** (npm lifecycle hook); publishing is
   `publish:all` / `publish:jsr`, via `rp` / `rpm`.

## Validation Rules (enforced at runtime)

| Input                                     | Constraint                                | Throws                     |
| ----------------------------------------- | ----------------------------------------- | -------------------------- |
| `randomString` length, `randomBytes` size | positive integer                          | `TypeError`                |
| `randomString` alphabet                   | string, 1–256 chars                       | `TypeError` / `RangeError` |
| `uuidv7` / `ulid` timestamp               | integer in `[0, 2^48)`                    | `RangeError`               |
| `uuidToBase56` input                      | valid 32-hex-digit UUID                   | `TypeError`                |
| `counter` prefix/start/step/pad           | string / int / positive int / non-neg int | `TypeError`                |
| `encodeInt` value                         | safe non-negative integer                 | `RangeError`               |
| reversible alphabet                       | ≥ 2 unique characters                     | `RangeError`               |
| `uid(strategy)` unknown name              | —                                         | `Error` (lists available)  |
| `uid("custom")` / `uid("reversible")`     | required `alphabet` / `value`             | `TypeError`                |

## Documentation Index

- [README.md](./README.md) — user-facing overview and usage
- [API.md](./API.md) — complete API reference

## Before Making Changes

- [ ] Check existing patterns in the relevant `src/*.ts` and its test
- [ ] Add or extend tests for new behavior, then `pnpm run ci`
- [ ] `pnpm run format`
- [ ] `pnpm run jsr:check` (no slow types) and `pnpm run test:deno`
- [ ] If the public API changed: update [README.md](./README.md),
      [API.md](./API.md), and this file

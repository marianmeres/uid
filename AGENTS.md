# @marianmeres/uid — Agent Guide

## Quick Reference

- **Stack**: Deno, TypeScript. Core has zero runtime deps; `rhr` is an optional
  peer dep (`@marianmeres/random-human-readable`).
- **Test**: `deno task test` | **Watch**: `deno task test:watch`
- **Lint**: `deno lint` | **Format**: `deno fmt`
- **JSR check**: `deno publish --dry-run --allow-dirty` (must report no slow types)
- **Build npm**: `deno task npm:build` | **Publish**: `deno task publish`
- **Targets**: browsers, Deno, Node 19+, Bun (Web Crypto global required).

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
/tests          — one *.test.ts per src module
/scripts
  build-npm.ts  — npm distribution builder (dnt via @marianmeres/npmbuild)
mcp.ts          — MCP tool definitions (generate-uid + base56 / integer codecs)
mcp-include.txt — MCP discovery description (opts the package into the MCP server)
```

## MCP Tools (mcp.ts)

Exposed to AI agents via `@marianmeres/mcp-server` (namespaced `uid:<tool>`):
`generate-uid` (any strategy + options; imports `./src/rhr.ts` so `rhr` works),
`uuid-to-base56`, `base56-to-uuid`, `encode-int`, `decode-int`. Handlers return
plain strings; every param uses `.describe()`. Keep tools in sync with the public
API when strategies change.

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
   from any module except `src/rhr.ts`. It is an _optional peer dep_ surfaced
   only via the `./rhr` subpath so its word lists stay out of the core bundle.
2. **All randomness flows through `random.ts`** (`randomBytes` / `randomString`,
   Web Crypto + rejection sampling). Never use `Math.random`.
3. **Adding a strategy** = (a) implement it as a standalone named export in the
   relevant file, (b) `registerStrategy("name", …)` in `src/uid.ts`, (c) add a
   typed overload signature to `uid` and an options interface. Keep both the
   named export and the dispatcher path working.
4. **Explicit return types on every exported symbol** — JSR rejects slow types.
   Verify with `deno publish --dry-run` before publishing.
5. **base56-from-uuid is fixed-width 23 chars** (128 bits need 23 base56 digits;
   `56^22 < 2^128`). Do not "fix" it back to 22.
6. **Multi-file layout is intentional** (tree-shaking). Keep pure modules pure;
   `counter.ts` holds the only module-level mutable state (the shared counters).
7. **rhr strategy is opt-in**: `uid("rhr")` throws a helpful error until
   `import "@marianmeres/uid/rhr"` registers it. Tests must isolate this (see
   `tests/rhr.test.ts` — dynamic import, the only file touching the subpath).

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
- [ ] `deno task test` (add/extend tests for new behavior)
- [ ] `deno fmt` and `deno lint`
- [ ] `deno publish --dry-run --allow-dirty` (no slow types)
- [ ] `deno task npm:build` if deps, entry points, or build config changed
- [ ] If the public API changed: update [README.md](./README.md),
      [API.md](./API.md), and this file

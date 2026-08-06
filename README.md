# @marianmeres/uid

[![JSR](https://jsr.io/badges/@marianmeres/uid)](https://jsr.io/@marianmeres/uid)
[![NPM](https://img.shields.io/npm/v/@marianmeres/uid)](https://www.npmjs.com/package/@marianmeres/uid)
[![License](https://img.shields.io/npm/l/@marianmeres/uid)](LICENSE)

One `uid()` function, many id strategies — UUIDs, sortable ids (UUID v7 / ULID),
URL-safe random ids (nanoid-style), human-friendly alphabets (base56/58/62/…),
in-memory counters, reversible integer codecs, and human-readable ids.

- **Works everywhere** — browsers, Deno, Node 19+, Bun.
- **Crypto-backed** — all randomness comes from the Web Crypto API, with
  rejection sampling so non-power-of-two alphabets stay unbiased.
- **Zero dependencies** in the core (the optional `rhr` strategy is the only
  add-on, and it's opt-in).
- **Type-safe** — `options` are checked per strategy, and every strategy is also
  a standalone, tree-shakeable named export.

> Good-quality randomness, but **not** intended for cryptographic secrets
> (tokens, keys, password resets). Use a dedicated crypto routine for those.

## Installation

```bash
# deno
deno add jsr:@marianmeres/uid

# npm (or pnpm / yarn / bun)
npx jsr add @marianmeres/uid
```

## Quick start

```typescript
import { uid } from "@marianmeres/uid";

uid(); // uuid v4 (default)
uid("uuidv7"); // sortable, UUID-compatible
uid("ulid"); // sortable, 26-char Crockford base32
uid("nanoid", { length: 12 }); // "V1StGXR8_Z5j"
uid("base58", { length: 10 }); // "3kP9xQ2mWz"
uid("numeric", { length: 6 }); // "048217"  (OTP / coupon)
uid("counter", { prefix: "n" }); // "n0", "n1", "n2", …
```

Every strategy is also a direct, tree-shakeable named export — handy when you
want one specific generator without the dispatcher:

```typescript
import { base62, nanoid, ulid, uuidv7 } from "@marianmeres/uid";

uuidv7(); // "0192f6c4-1d2e-7a3b-8c4d-5e6f7a8b9c0d"
nanoid(); // 21-char URL-safe id
base62(8); // "aZ09Kp3X"
```

## Strategies

| Strategy                                            | `uid(...)`                                         | Output                                  |
| --------------------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| `uuid` / `uuidv4`                                   | `uid()` / `uid("uuid")`                            | RFC 9562 UUID v4                        |
| `uuidv7`                                            | `uid("uuidv7", { timestamp? })`                    | Time-sortable UUID                      |
| `ulid`                                              | `uid("ulid", { timestamp? })`                      | 26-char Crockford base32, sortable      |
| `base56`                                            | `uid("base56", { length?, uuid? })`                | No-ambiguous random / reversible uuid   |
| `nanoid`                                            | `uid("nanoid", { length?, alphabet? })`            | URL-safe random id                      |
| `hex` `base32` `base36` `base58` `base62` `numeric` | `uid("base58", { length? })`                       | Random string over a named alphabet     |
| `custom`                                            | `uid("custom", { alphabet, length? })`             | Random string over your alphabet        |
| `counter`                                           | `uid("counter", { prefix?, start?, step?, pad? })` | In-memory incrementing id               |
| `reversible`                                        | `uid("reversible", { value, salt?, … })`           | Short reversible encoding of an integer |
| `rhr`                                               | `uid("rhr", { … })` _(opt-in, see below)_          | Human-readable id                       |

Default length for random strategies is **21**. A UUID encoded as base56 is
always **23** characters (128 bits need 23 base56 digits).

### Sortable ids — `uuidv7` vs `ulid`

Both embed a 48-bit millisecond timestamp prefix and sort by creation time.
`uuidv7` is a valid UUID (drops into any `uuid` DB column); `ulid` is shorter,
dash-free, and case-insensitive but not a valid UUID string.

```typescript
uid("uuidv7"); // "0192f6c4-1d2e-7a3b-..."
uid("ulid"); // "01J9Z7Q8K3M4N5P6R7S8T9V0W1"
uid("uuidv7", { timestamp: 0 }); // back-dated / deterministic time for tests
```

### base56 — random or reversible UUID

`base56` drops visually ambiguous characters (`0 O o 1 l I`), so it's safe to
read aloud or retype.

```typescript
import { base56, base56ToUuid, base56Uuid, uuidToBase56 } from "@marianmeres/uid";

base56(10); // random, e.g. "7vNpRmXj4Q"
base56Uuid(); // fresh uuid, 23-char base56 (reversible)

const enc = uuidToBase56("550e8400-e29b-41d4-a716-446655440000");
base56ToUuid(enc); // back to the original uuid
```

### counter — in-memory sequence

State lives for the lifetime of the process/page (it resets on reload) and is
**not** for cross-process uniqueness. Each prefix has its own sequence.

```typescript
import { createCounter } from "@marianmeres/uid";

uid("counter", { prefix: "node_" }); // "node_0", "node_1", …
uid("counter", { prefix: "x", pad: 4 }); // "x0000", "x0001", …

// fully isolated instance (best for tests / multiple independent sequences):
const next = createCounter({ prefix: "row-", start: 1, pad: 4 });
next(); // "row-0001"
next(); // "row-0002"
```

### reversible — encode integers ↔ short strings

A small "sqids/hashids-lite". With a `salt` the alphabet is deterministically
shuffled so sequential ids don't look sequential — useful for exposing database
row ids in URLs without leaking the row count.

```typescript
import { decodeInt, encodeInt } from "@marianmeres/uid";

const code = encodeInt(12345, { salt: "my-secret" }); // e.g. "Yq9"
decodeInt(code, { salt: "my-secret" }); // 12345
```

> Like hashids, this is **obfuscation, not encryption** — anyone who knows the
> salt and alphabet can reverse it. Don't use it to protect data.

### rhr — human-readable ids (opt-in)

Human-readable ids are built on
[`@marianmeres/random-human-readable`](https://jsr.io/@marianmeres/random-human-readable).
To keep its word lists out of the core bundle, this strategy lives behind a
subpath you import explicitly:

```typescript
// register the strategy once (e.g. in your entry file):
import "@marianmeres/uid/rhr";
import { uid } from "@marianmeres/uid";
uid("rhr"); // "happy-blue-otter-canyon"

// …or call it directly (tree-shakeable, no registration needed):
import { rhr } from "@marianmeres/uid/rhr";
rhr({ nounsCount: 1 });
```

On npm, install the peer dependency yourself:
`npm install @marianmeres/random-human-readable`.

## Custom alphabets & strategies

```typescript
import { randomString, registerStrategy, uid } from "@marianmeres/uid";

// arbitrary alphabet, one-off:
uid("custom", { alphabet: "ABCDEF01", length: 8 });
randomString(8, "ABCDEF01");

// register your own reusable strategy:
registerStrategy("order", () => "ORD-" + uid("numeric", { length: 8 }));
uid("order"); // "ORD-40582193"
```

## Validation

Options are validated rather than coerced: non-positive/fractional lengths,
out-of-range UUID v7 / ULID timestamps, missing required options (`custom`'s
`alphabet`, `reversible`'s `value`), duplicate reversible alphabets, and invalid
counter options all throw `TypeError` / `RangeError`.

## Interactive example

[`example/`](example/) is a single-page playground for every strategy: edit the
options, watch the `uid()` call update to the minimal code that reproduces the
result, and copy any generated id with one tap. Run it locally with:

```bash
deno task example:build   # bundle example/src/app.ts -> example/dist/bundle.js
deno task example:serve   # http://localhost:8000
```

Use `deno task example:watch` while editing, and `deno task example:themes` to
regenerate the stylesheet from a different
[`@marianmeres/design-tokens`](https://jsr.io/@marianmeres/design-tokens) theme.

## API

See [API.md](API.md) for the complete API reference.

## License

[MIT](LICENSE)

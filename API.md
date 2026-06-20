# API

Complete reference for `@marianmeres/uid`.

- Core entry point: `@marianmeres/uid` — everything below **except** `rhr`.
- Opt-in subpath: `@marianmeres/uid/rhr` — the `rhr` function and strategy.

All generators are crypto-backed (`crypto.getRandomValues` / `crypto.randomUUID`)
and work in browsers, Deno, Node 19+, and Bun. Randomness is good quality but
**not** cryptographically secret — do not use for tokens, keys, or password
resets.

---

## The dispatcher

### `uid(strategy?, options?)`

Generates a unique id using the named `strategy`. Defaults to `uuid` (v4). The
`options` shape is validated per strategy (TypeScript overloads narrow it from
the strategy name). The `rhr` strategy must be enabled first via
`import "@marianmeres/uid/rhr"`.

**Parameters:**

- `strategy` (string, optional) — one of: `uuid`, `uuidv4`, `uuidv7`, `ulid`,
  `base56`, `nanoid`, `hex`, `base32`, `base36`, `base58`, `base62`, `numeric`,
  `custom`, `counter`, `reversible`, `rhr`, or any name registered via
  `registerStrategy`. Default: `"uuid"`.
- `options` (object, optional) — strategy-specific; see each strategy below.

**Returns:** `string`

**Throws:** `Error` if the strategy is unknown (message lists available
strategies), or a strategy-specific `TypeError`/`RangeError` for invalid options.

**Example:**

```typescript
import { uid } from "@marianmeres/uid";

uid(); // uuid v4
uid("uuidv7"); // sortable uuid
uid("nanoid", { length: 12 }); // "V1StGXR8_Z5j"
uid("custom", { alphabet: "AB01", length: 6 });
```

| Strategy          | Options type        | Backing function                   |
| ----------------- | ------------------- | ---------------------------------- |
| `uuid`/`uuidv4`   | `UuidOptions`       | `uuid()`                           |
| `uuidv7`          | `Uuidv7Options`     | `uuidv7(timestamp)`                |
| `ulid`            | `UlidOptions`       | `ulid(timestamp)`                  |
| `base56`          | `Base56Options`     | `base56()` / `uuidToBase56()`      |
| `nanoid`          | `NanoidOptions`     | `nanoid(length, alphabet)`         |
| `hex` … `numeric` | `AlphabetOptions`   | `hex(length)`, `base58(length)`, … |
| `custom`          | `CustomOptions`     | `randomString(length, alphabet)`   |
| `counter`         | `CounterOptions`    | `counter(options)`                 |
| `reversible`      | `ReversibleOptions` | `encodeInt(value, options)`        |
| `rhr`             | `RhrOptions`        | `rhr(options)` _(opt-in)_          |

---

## UUID & sortable strategies

### `uuid()`

Random RFC 9562 UUID v4 via native `crypto.randomUUID()`.

**Returns:** `string` — e.g. `"1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"`

### `uuidv7(timestamp?)`

RFC 9562 UUID v7 — a 48-bit Unix-millisecond timestamp prefix plus random bits.
Valid UUID **and** lexicographically sortable by creation time. Ideal for
database primary keys.

**Parameters:**

- `timestamp` (number, optional) — Unix epoch milliseconds to embed. Must be in
  `[0, 2^48)`. Default: `Date.now()`.

**Returns:** `string`
**Throws:** `RangeError` if `timestamp` is outside `[0, 2^48)`.

**Example:**

```typescript
uuidv7(); // "0192f6c4-1d2e-7a3b-8c4d-5e6f7a8b9c0d"
uuidv7(0); // deterministic time prefix (tests / back-dating)
```

### `ulid(timestamp?)`

ULID — 26-character Crockford-base32 string: 48-bit ms timestamp (10 chars) +
80 bits of randomness (16 chars). Sorts by time like UUID v7, but shorter,
dash-free, and case-insensitive (not a valid UUID string).

**Parameters:**

- `timestamp` (number, optional) — Unix epoch milliseconds. Must be in
  `[0, 2^48)`. Default: `Date.now()`.

**Returns:** `string` — e.g. `"01J9Z7Q8K3M4N5P6R7S8T9V0W1"`
**Throws:** `RangeError` if `timestamp` is outside `[0, 2^48)`.

---

## Base56 strategy

Human-friendly alphabet with no ambiguous characters (`0 O o 1 l I`).

### `base56(length?)`

Random base56 string.

**Parameters:** `length` (number, optional) — default `DEFAULT_LENGTH` (21).
**Returns:** `string`

### `uuidToBase56(uuid)`

Encodes a UUID into a fixed-width **23-character** base56 string. Reversible via
`base56ToUuid`. (128 bits need 23 base56 digits — `56^22 ≈ 2^127.76 < 2^128`.)

**Parameters:** `uuid` (string) — a UUID, with or without dashes.
**Returns:** `string` (23 chars)
**Throws:** `TypeError` if `uuid` is not a valid 32-hex-digit UUID.

### `base56ToUuid(encoded)`

Decodes a base56 string from `uuidToBase56` back to a canonical UUID.

**Parameters:** `encoded` (string)
**Returns:** `string` — canonical UUID
**Throws:** `Error` if `encoded` contains characters outside the base56 alphabet.

### `base56Uuid()`

Generates a fresh UUID and returns its 23-character base56 encoding. Equivalent
to `uuidToBase56(uuid())`.

**Returns:** `string` (23 chars)

**Example:**

```typescript
const id = base56Uuid(); // "2WjkHTAH3tTuAHceeZxnuDL"
base56ToUuid(id); // the original uuid
```

---

## Alphabet strategies

Fixed-length random strings over a named alphabet. Each takes an optional
`length` (default `DEFAULT_LENGTH` = 21) and returns a `string`.

| Function                     | Alphabet                                                      |
| ---------------------------- | ------------------------------------------------------------- |
| `nanoid(length?, alphabet?)` | URL-safe 64-char (`A–Z a–z 0–9 _ -`); custom alphabet allowed |
| `hex(length?)`               | `0-9 a-f`                                                     |
| `base32(length?)`            | Crockford (no I L O U)                                        |
| `base36(length?)`            | `0-9 a-z`                                                     |
| `base58(length?)`            | Bitcoin (no 0 O I l)                                          |
| `base62(length?)`            | `0-9 A-Z a-z`                                                 |
| `numeric(length?)`           | `0-9` (OTP / numeric coupons)                                 |

**Example:**

```typescript
nanoid(); // 21-char URL-safe id
hex(32); // 32-char hex
numeric(6); // "048217"
nanoid(10, "ABCDEF01"); // custom alphabet
```

---

## Counter strategy

In-memory, monotonically increasing ids. State lives for the lifetime of the
process/page and resets on reload — **not** for cross-process uniqueness.

### `counter(options?)`

Returns the next value of a shared, per-prefix counter. Each distinct `prefix`
has its own sequence. `start`/`step`/`pad` are honored only on the first call
that creates a prefix's sequence.

**Parameters:** `options` (`CounterOptions`, optional)
**Returns:** `string`
**Throws:** `TypeError` for invalid `prefix`/`start`/`step`/`pad`.

### `createCounter(options?)`

Creates an isolated counter function with its own private state — no sharing with
`counter()` or other instances. Prefer this for independent sequences or
deterministic tests.

**Parameters:** `options` (`CounterOptions`, optional)
**Returns:** `() => string`

### `resetCounters(prefix?)`

Clears the shared state used by `counter()`. Mainly for tests. Does not affect
`createCounter` instances.

**Parameters:** `prefix` (string, optional) — reset only this prefix; omit to
reset all.
**Returns:** `void`

**Example:**

```typescript
const next = createCounter({ prefix: "row-", start: 1, pad: 4 });
next(); // "row-0001"
next(); // "row-0002"
```

---

## Reversible integer codec

A small "sqids/hashids-lite": encode a non-negative integer to a short string
and back. A `salt` deterministically shuffles the alphabet so sequential ids
don't look sequential. **Obfuscation, not encryption** — reversible by anyone
who knows the salt and alphabet.

### `encodeInt(value, options?)`

**Parameters:**

- `value` (number) — non-negative safe integer (`0 … Number.MAX_SAFE_INTEGER`).
- `options` (`EncodeIntOptions`, optional)

**Returns:** `string`
**Throws:** `RangeError` if `value` is out of range, or `alphabet` has fewer than
2 characters or contains duplicates.

### `decodeInt(str, options?)`

**Parameters:**

- `str` (string) — a string produced by `encodeInt`.
- `options` (`DecodeIntOptions`, optional) — `alphabet`/`salt` must match those
  used to encode.

**Returns:** `number`
**Throws:** `Error` for characters outside the alphabet; `RangeError` for a bad
alphabet or if the decoded value exceeds the safe-integer range.

**Example:**

```typescript
const code = encodeInt(12345, { salt: "my-secret" }); // "Yq9"
decodeInt(code, { salt: "my-secret" }); // 12345
```

---

## Core primitives

### `randomString(length, alphabet?)`

Random string of `length` characters from `alphabet`, using rejection sampling
(the nanoid algorithm) so output is unbiased even for non-power-of-two alphabets.

**Parameters:**

- `length` (number) — positive integer.
- `alphabet` (string, optional) — 1–256 characters. Default: the URL-safe nanoid
  alphabet.

**Returns:** `string`
**Throws:** `TypeError` for non-positive-integer `length` or non-string
`alphabet`; `RangeError` if `alphabet` length is outside 1–256.

### `randomBytes(size)`

`size` cryptographically-strong random bytes. Transparently chunks calls larger
than the 65536-byte `getRandomValues` limit.

**Parameters:** `size` (number) — positive integer.
**Returns:** `Uint8Array`

### `assertPositiveInt(n, label)` / `assertNonNegativeInt(n, label)`

Throw `TypeError` unless `n` is an integer `>= 1` / `>= 0`. The `label` is used
in the error message. Exposed for building custom strategies with consistent
validation.

**Returns:** `void` (assertion functions)

---

## Registry

### `registerStrategy(name, fn)`

Registers (or overrides) a strategy under `name`, making it callable via
`uid(name, options)`.

**Parameters:**

- `name` (string) — non-empty strategy name.
- `fn` (`StrategyFn`) — `(options?) => string`.

**Returns:** `void`
**Throws:** `TypeError` for an empty `name` or non-function `fn`.

### `listStrategies()`

**Returns:** `string[]` — names of all currently registered strategies.

**Example:**

```typescript
import { registerStrategy, uid } from "@marianmeres/uid";

registerStrategy("order", () => "ORD-" + uid("numeric", { length: 8 }));
uid("order"); // "ORD-40582193"
```

---

## Opt-in: `@marianmeres/uid/rhr`

### `rhr(options?)`

Human-readable id built on `@marianmeres/random-human-readable`. Joined with `-`
by default. Importing this module also registers the `rhr` strategy so
`uid("rhr", …)` works.

**Parameters:** `options` (`RhrOptions`, optional) — passed through to
`getRandomHumanReadable` (e.g. `adjCount`, `colorsCount`, `nounsCount`,
`randomizeCase`, `joinWith`).

**Returns:** `string` — e.g. `"happy-blue-otter-canyon"`

**Example:**

```typescript
import "@marianmeres/uid/rhr"; // enables uid("rhr")
import { rhr } from "@marianmeres/uid/rhr";

rhr(); // "happy-blue-otter-canyon"
rhr({ nounsCount: 1 }); // "otter"
```

On npm, install the peer dependency:
`npm install @marianmeres/random-human-readable`.

---

## Types

```typescript
interface Uuidv7Options {
	timestamp?: number;
}
interface UlidOptions {
	timestamp?: number;
}
interface Base56Options {
	length?: number;
	uuid?: string;
}
interface NanoidOptions {
	length?: number;
	alphabet?: string;
}
interface AlphabetOptions {
	length?: number;
}
interface CustomOptions {
	alphabet: string;
	length?: number;
}
interface CounterOptions {
	prefix?: string;
	start?: number;
	step?: number;
	pad?: number;
}
interface EncodeIntOptions {
	alphabet?: string;
	salt?: string;
	minLength?: number;
}
interface DecodeIntOptions {
	alphabet?: string;
	salt?: string;
}
interface ReversibleOptions {
	value: number;
	alphabet?: string;
	salt?: string;
	minLength?: number;
}
interface RhrOptions {/* getRandomHumanReadable options that return a string */}
type StrategyFn = (options?: Record<string, unknown>) => string;
```

---

## Constants

### `DEFAULT_LENGTH`

`21` — default length for random, fixed-length strategies.

### `ALPHABETS`

Named alphabets used by the built-in strategies:

```typescript
ALPHABETS.hex; // "0123456789abcdef"
ALPHABETS.base32; // Crockford (no I L O U)
ALPHABETS.base36; // "0-9a-z"
ALPHABETS.base56; // no 0 O o 1 l I
ALPHABETS.base58; // Bitcoin (no 0 O I l)
ALPHABETS.base62; // "0-9A-Za-z"
ALPHABETS.numeric; // "0123456789"
ALPHABETS.alphanumeric; // alias of base62
ALPHABETS.nanoid; // URL-safe 64-char set
```

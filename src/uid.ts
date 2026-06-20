/**
 * The unified `uid(strategy, options)` dispatcher plus a small strategy
 * registry. Every built-in strategy is also available as a standalone named
 * export (see ./mod.ts) for tree-shaking and ergonomics; the dispatcher is the
 * convenience entry point.
 */

import { DEFAULT_LENGTH, randomString } from "./random.ts";
import { ulid, uuid, uuidv7 } from "./uuid.ts";
import { base56, uuidToBase56 } from "./base56.ts";
import { base32, base36, base58, base62, hex, nanoid, numeric } from "./alphabet.ts";
import { counter, type CounterOptions } from "./counter.ts";
import { encodeInt } from "./reversible.ts";

// ── Per-strategy option types ────────────────────────────────────────────────

/** Options for the `uuid` / `uuidv4` strategies (none). */
// deno-lint-ignore no-empty-interface
export interface UuidOptions {}

/** Options for the `uuidv7` strategy. */
export interface Uuidv7Options {
	/** Unix epoch milliseconds to embed (default: now). */
	timestamp?: number;
}

/** Options for the `ulid` strategy. */
export interface UlidOptions {
	/** Unix epoch milliseconds to embed (default: now). */
	timestamp?: number;
}

/** Options for the `base56` strategy. */
export interface Base56Options {
	/** Length of the random string (ignored when `uuid` is given). */
	length?: number;
	/** If given, reversibly encode this UUID instead of generating randomly. */
	uuid?: string;
}

/** Options for the `nanoid` strategy. */
export interface NanoidOptions {
	/** Number of characters (default: 21). */
	length?: number;
	/** Override the alphabet (default: URL-safe 64-char set). */
	alphabet?: string;
}

/** Options for the alphabet strategies (`hex`, `base32`, `numeric`, …). */
export interface AlphabetOptions {
	/** Number of characters (default: 21). */
	length?: number;
}

/** Options for the `custom` strategy. */
export interface CustomOptions {
	/** Alphabet to draw from (required, 1–256 chars). */
	alphabet: string;
	/** Number of characters (default: 21). */
	length?: number;
}

/** Options for the `reversible` strategy. */
export interface ReversibleOptions {
	/** The non-negative integer to encode (required). */
	value: number;
	/** Alphabet of unique characters (default: base62). */
	alphabet?: string;
	/** Salt that shuffles the alphabet (default: none). */
	salt?: string;
	/** Left-pad the result to at least this length. */
	minLength?: number;
}

/**
 * Options for the `rhr` (random-human-readable) strategy. The strategy is
 * opt-in: `import "@marianmeres/uid/rhr"` once to register it. Mirrors the
 * subset of `@marianmeres/random-human-readable` options that yield a string.
 */
export interface RhrOptions {
	/** Number of adjectives (default: 1). */
	adjCount?: number;
	/** Number of color names (default: 1). */
	colorsCount?: number;
	/** Number of nouns (default: 2). */
	nounsCount?: number;
	/** Number of nonsense CV syllables to append (default: 0). */
	syllablesCount?: number;
	/** Number of random digits to append (default: 0). */
	digitsCount?: number;
	/** Number of special characters to append (default: 0). */
	specialCharsCount?: number;
	/** Randomize letter casing (default: false). */
	randomizeCase?: boolean;
	/** Separator between parts (default: "-"). */
	joinWith?: string;
}

// ── Registry ─────────────────────────────────────────────────────────────────

/** A strategy implementation: takes its options object, returns a string. */
export type StrategyFn = (options?: Record<string, unknown>) => string;

const _registry = new Map<string, StrategyFn>();

/**
 * Registers (or overrides) a strategy under `name`, making it callable via
 * `uid(name, options)`. Used internally for the built-ins and by the opt-in
 * `./rhr` subpath; also available for your own custom strategies.
 */
export function registerStrategy(name: string, fn: StrategyFn): void {
	if (typeof name !== "string" || !name) {
		throw new TypeError(`registerStrategy: "name" must be a non-empty string`);
	}
	if (typeof fn !== "function") {
		throw new TypeError(`registerStrategy: "fn" must be a function`);
	}
	_registry.set(name, fn);
}

/** Returns the names of all currently registered strategies. */
export function listStrategies(): string[] {
	return [..._registry.keys()];
}

// Register the zero-dependency built-ins.
registerStrategy("uuid", () => uuid());
registerStrategy("uuidv4", () => uuid());
registerStrategy("uuidv7", (o = {}) => uuidv7((o as Uuidv7Options).timestamp));
registerStrategy("ulid", (o = {}) => ulid((o as UlidOptions).timestamp));
registerStrategy("base56", (o = {}) => {
	const { uuid: u, length } = o as Base56Options;
	return u != null ? uuidToBase56(u) : base56(length);
});
registerStrategy("nanoid", (o = {}) => {
	const { length, alphabet } = o as NanoidOptions;
	return nanoid(length, alphabet);
});
registerStrategy("hex", (o = {}) => hex((o as AlphabetOptions).length));
registerStrategy("base32", (o = {}) => base32((o as AlphabetOptions).length));
registerStrategy("base36", (o = {}) => base36((o as AlphabetOptions).length));
registerStrategy("base58", (o = {}) => base58((o as AlphabetOptions).length));
registerStrategy("base62", (o = {}) => base62((o as AlphabetOptions).length));
registerStrategy("numeric", (o = {}) => numeric((o as AlphabetOptions).length));
registerStrategy("custom", (o = {}) => {
	const { alphabet, length } = o as unknown as CustomOptions;
	if (typeof alphabet !== "string") {
		throw new TypeError(`uid("custom"): "alphabet" option is required`);
	}
	return randomString(length ?? DEFAULT_LENGTH, alphabet);
});
registerStrategy("counter", (o = {}) => counter(o as CounterOptions));
registerStrategy("reversible", (o = {}) => {
	const { value, ...rest } = o as unknown as ReversibleOptions;
	if (typeof value !== "number") {
		throw new TypeError(`uid("reversible"): "value" option is required`);
	}
	return encodeInt(value, rest);
});

// ── Dispatcher ───────────────────────────────────────────────────────────────

/** Generates a UUID v4 — the default strategy. */
export function uid(strategy?: "uuid" | "uuidv4", options?: UuidOptions): string;
/** Generates a time-sortable UUID v7. */
export function uid(strategy: "uuidv7", options?: Uuidv7Options): string;
/** Generates a time-sortable ULID (Crockford base32). */
export function uid(strategy: "ulid", options?: UlidOptions): string;
/** Generates a random base56 string, or reversibly encodes `options.uuid`. */
export function uid(strategy: "base56", options?: Base56Options): string;
/** Generates a URL-safe nanoid-style id. */
export function uid(strategy: "nanoid", options?: NanoidOptions): string;
/** Generates a random string over a named alphabet. */
export function uid(
	strategy: "hex" | "base32" | "base36" | "base58" | "base62" | "numeric",
	options?: AlphabetOptions,
): string;
/** Generates a random string over a custom `options.alphabet`. */
export function uid(strategy: "custom", options: CustomOptions): string;
/** Returns the next value of an in-memory, per-prefix counter. */
export function uid(strategy: "counter", options?: CounterOptions): string;
/** Reversibly encodes `options.value` into a short string. */
export function uid(strategy: "reversible", options: ReversibleOptions): string;
/** Generates a human-readable id (requires `import "@marianmeres/uid/rhr"`). */
export function uid(strategy: "rhr", options?: RhrOptions): string;
/** Generates an id using any registered strategy, looked up by name. */
export function uid(strategy: string, options?: Record<string, unknown>): string;
/**
 * Generates a unique id using the named `strategy`.
 *
 * Defaults to `uuid` (v4) when called with no arguments. The `options` shape
 * depends on the strategy — see the per-strategy option interfaces. The `rhr`
 * strategy must be enabled first via `import "@marianmeres/uid/rhr"`.
 *
 * @example
 * uid();                                  // uuid v4
 * uid("uuidv7");                          // sortable uuid
 * uid("nanoid", { length: 12 });          // "V1StGXR8_Z5j"
 * uid("numeric", { length: 6 });          // "048217"
 * uid("counter", { prefix: "n", pad: 3 }); // "n000"
 */
export function uid(
	strategy: string = "uuid",
	// deno-lint-ignore no-explicit-any -- implementation signature for overloads
	options: any = {},
): string {
	const fn = _registry.get(strategy);
	if (!fn) {
		if (strategy === "rhr") {
			throw new Error(
				`The "rhr" strategy is opt-in. Enable it once with:\n` +
					`  import "@marianmeres/uid/rhr";\n` +
					`(or use the named export: import { rhr } from "@marianmeres/uid/rhr")`,
			);
		}
		throw new Error(
			`Unknown uid strategy "${strategy}". Available: ${
				listStrategies().join(", ")
			}`,
		);
	}
	return fn(options);
}

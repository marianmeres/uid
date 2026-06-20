/**
 * Counter strategy — a simple, monotonically increasing, in-memory counter
 * with an optional prefix. State lives for the lifetime of the running
 * process/page; it is NOT persisted and resets on reload. Suitable for
 * within-process unique ids (tree nodes, DOM ids, test fixtures), not for
 * cross-process uniqueness.
 */

import { assertNonNegativeInt } from "./random.ts";

/** Options shared by {@link counter} and {@link createCounter}. */
export interface CounterOptions {
	/** String prepended to the number (also the key for the shared counter). */
	prefix?: string;
	/** First value emitted (default: `0`). */
	start?: number;
	/** Increment between successive values (default: `1`). */
	step?: number;
	/** Zero-pad the numeric part to this width (default: `0`, no padding). */
	pad?: number;
}

function validate(o: CounterOptions): Required<CounterOptions> {
	const { prefix = "", start = 0, step = 1, pad = 0 } = o;
	if (typeof prefix !== "string") {
		throw new TypeError(`counter: "prefix" must be a string`);
	}
	if (!Number.isInteger(start)) {
		throw new TypeError(`counter: "start" must be an integer`);
	}
	if (!Number.isInteger(step) || step < 1) {
		throw new TypeError(`counter: "step" must be a positive integer`);
	}
	assertNonNegativeInt(pad, "pad");
	return { prefix, start, step, pad };
}

function format(prefix: string, n: number, pad: number): string {
	const s = pad > 0 ? String(n).padStart(pad, "0") : String(n);
	return prefix + s;
}

// One independent counter per prefix, shared across the module. The full config
// (current value + step + pad) is captured on first use so a prefix's sequence
// stays consistent regardless of options passed to later calls.
const _counters = new Map<string, { value: number; step: number; pad: number }>();

/**
 * Returns the next value of the shared, per-prefix counter.
 *
 * Each distinct `prefix` has its own independent sequence. The **first** call
 * for a given prefix configures it (`start`, `step`, `pad`) and returns `start`;
 * subsequent calls advance it by the captured `step` and reuse the captured
 * `pad`, so option overrides passed to later calls for the same prefix are
 * ignored (and the id width stays stable). Use {@link createCounter} when you
 * want explicit per-instance configuration.
 *
 * Options are still validated on every call, so malformed input throws even when
 * the values would be ignored.
 *
 * @example
 * counter({ prefix: "node_" });            // "node_0"
 * counter({ prefix: "node_" });            // "node_1"
 * counter({ prefix: "x", pad: 3 });        // "x000"
 */
export function counter(options: CounterOptions = {}): string {
	const { prefix, start, step, pad } = validate(options);
	const existing = _counters.get(prefix);
	const entry = existing
		? { ...existing, value: existing.value + existing.step }
		: { value: start, step, pad };
	_counters.set(prefix, entry);
	return format(prefix, entry.value, entry.pad);
}

/**
 * Creates an isolated counter function with its own private state — no sharing
 * with {@link counter} or with other instances. Prefer this when you need
 * several independent sequences or deterministic behavior in tests.
 *
 * @example
 * const next = createCounter({ prefix: "row-", start: 1, pad: 4 });
 * next(); // "row-0001"
 * next(); // "row-0002"
 */
export function createCounter(options: CounterOptions = {}): () => string {
	const { prefix, start, step, pad } = validate(options);
	let current = start - step;
	return (): string => {
		current += step;
		return format(prefix, current, pad);
	};
}

/**
 * Clears the shared per-prefix counter state used by {@link counter}.
 * Mainly useful in tests. Does not affect {@link createCounter} instances.
 *
 * @param prefix If given, resets only that prefix; otherwise resets all.
 */
export function resetCounters(prefix?: string): void {
	if (prefix === undefined) _counters.clear();
	else _counters.delete(prefix);
}

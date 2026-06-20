/**
 * Reversible integer ↔ short-string codec (a small "sqids/hashids-lite").
 *
 * Encodes a non-negative integer into a short opaque string and back. With a
 * `salt`, the alphabet is deterministically shuffled so sequential ids do not
 * produce obviously sequential output — handy for exposing database row ids in
 * URLs without leaking the row count.
 *
 * NOT a security mechanism: like hashids, the mapping is reversible by anyone
 * who knows (or guesses) the salt and alphabet. Do not use it to protect data.
 */

import { ALPHABETS } from "./random.ts";

/** Options for {@link encodeInt}. */
export interface EncodeIntOptions {
	/** Alphabet of unique characters to encode into (default: base62). */
	alphabet?: string;
	/** Salt that deterministically shuffles the alphabet (default: none). */
	salt?: string;
	/** Left-pad the result to at least this length (default: `0`). */
	minLength?: number;
}

/** Options for {@link decodeInt}. */
export interface DecodeIntOptions {
	/** Must match the alphabet used to encode (default: base62). */
	alphabet?: string;
	/** Must match the salt used to encode (default: none). */
	salt?: string;
}

/**
 * Deterministically shuffles `alphabet` based on `salt` (the hashids
 * "consistent shuffle" — stable across runtimes, no RNG involved).
 */
function consistentShuffle(alphabet: string, salt: string): string {
	if (!salt.length) return alphabet;
	const a = alphabet.split("");
	for (let i = a.length - 1, v = 0, p = 0; i > 0; i--, v++) {
		v %= salt.length;
		const int = salt.charCodeAt(v);
		p += int;
		const j = (int + v + p) % i;
		const tmp = a[i];
		a[i] = a[j];
		a[j] = tmp;
	}
	return a.join("");
}

/**
 * The codec requires an alphabet of at least 2 *unique* characters — duplicates
 * would make `indexOf`-based decoding ambiguous and silently corrupt the
 * round-trip, so we reject them up front rather than return wrong values.
 */
function assertReversibleAlphabet(alphabet: string, fn: string): void {
	if (alphabet.length < 2) {
		throw new RangeError(`${fn}: "alphabet" needs at least 2 characters`);
	}
	if (new Set(alphabet).size !== alphabet.length) {
		throw new RangeError(`${fn}: "alphabet" must have unique characters`);
	}
}

/**
 * Encodes a non-negative integer into a short string.
 *
 * @example
 * encodeInt(12345);                         // base62, e.g. "3D7"
 * encodeInt(12345, { salt: "secret" });     // shuffled, e.g. "Yq9"
 * encodeInt(7, { minLength: 5 });           // "00007"-style padding
 */
export function encodeInt(value: number, options: EncodeIntOptions = {}): string {
	const { alphabet = ALPHABETS.base62, salt = "", minLength = 0 } = options;
	if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
		throw new RangeError(
			`encodeInt: value must be a safe non-negative integer, got ${String(value)}`,
		);
	}
	assertReversibleAlphabet(alphabet, "encodeInt");
	const a = consistentShuffle(alphabet, salt);
	const base = a.length;
	let n = value;
	let out = "";
	do {
		out = a[n % base] + out;
		n = Math.floor(n / base);
	} while (n > 0);
	// pad with the alphabet's zero char; harmless because leading "zeros"
	// decode back to 0 in positional notation.
	while (out.length < minLength) out = a[0] + out;
	return out;
}

/**
 * Decodes a string produced by {@link encodeInt}. The `alphabet` and `salt`
 * must match those used to encode.
 */
export function decodeInt(str: string, options: DecodeIntOptions = {}): number {
	const { alphabet = ALPHABETS.base62, salt = "" } = options;
	assertReversibleAlphabet(alphabet, "decodeInt");
	const a = consistentShuffle(alphabet, salt);
	const base = a.length;
	let n = 0;
	for (const ch of str) {
		const idx = a.indexOf(ch);
		if (idx < 0) throw new Error(`decodeInt: invalid character "${ch}"`);
		n = n * base + idx;
		if (n > Number.MAX_SAFE_INTEGER) {
			throw new RangeError(`decodeInt: decoded value exceeds safe integer range`);
		}
	}
	return n;
}

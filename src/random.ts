/**
 * Crypto-backed randomness primitives shared by every strategy.
 *
 * All randomness goes through the Web Crypto API (`crypto.getRandomValues`),
 * which is available in every modern runtime (browsers, Deno, Node 19+, Bun)
 * without any external dependency. This is good-quality randomness, but the
 * library is NOT intended for cryptographic secrets (tokens, keys, etc.).
 */

/** Default length for random, fixed-length strategies (nanoid, base*, hex, …). */
export const DEFAULT_LENGTH = 21;

/**
 * Named alphabets used by the built-in strategies.
 *
 * The "no-ambiguous" alphabets (`base56`, `base58`, `base32`) drop visually
 * confusable characters so the output is safe to read aloud / retype.
 */
export const ALPHABETS: {
	hex: string;
	base32: string;
	base36: string;
	base56: string;
	base58: string;
	base62: string;
	numeric: string;
	alphanumeric: string;
	nanoid: string;
} = {
	// lowercase hex
	hex: "0123456789abcdef",
	// Crockford base32 (no I, L, O, U) — power of two, sorts case-insensitively
	base32: "0123456789ABCDEFGHJKMNPQRSTVWXYZ",
	// lowercase base36
	base36: "0123456789abcdefghijklmnopqrstuvwxyz",
	// no 0 O o 1 l I — safe to read aloud / retype
	base56: "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz",
	// Bitcoin base58 (no 0 O I l)
	base58: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
	// full base62
	base62: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	// digits only — handy for OTPs / numeric coupon codes
	numeric: "0123456789",
	// alias of base62
	alphanumeric: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	// URL-safe 64-char set (A–Z a–z 0–9 _ -)
	nanoid: "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
};

/** Throws `TypeError` unless `n` is an integer `>= 1`. */
export function assertPositiveInt(n: unknown, label: string): asserts n is number {
	if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
		throw new TypeError(`"${label}" must be a positive integer, got ${String(n)}`);
	}
}

/** Throws `TypeError` unless `n` is an integer `>= 0`. */
export function assertNonNegativeInt(
	n: unknown,
	label: string,
): asserts n is number {
	if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
		throw new TypeError(
			`"${label}" must be a non-negative integer, got ${String(n)}`,
		);
	}
}

/**
 * Returns `size` cryptographically-strong random bytes.
 *
 * Transparently chunks calls larger than the 65536-byte `getRandomValues`
 * limit so any `size` is supported.
 */
export function randomBytes(size: number): Uint8Array {
	assertPositiveInt(size, "size");
	const bytes = new Uint8Array(size);
	const MAX = 65536; // crypto.getRandomValues hard limit per call
	for (let offset = 0; offset < size; offset += MAX) {
		crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + MAX, size)));
	}
	return bytes;
}

/**
 * Generates a random string of `length` characters from `alphabet`.
 *
 * Uses rejection sampling (the nanoid algorithm) so the output is unbiased
 * even when `alphabet.length` is not a power of two — no modulo skew.
 *
 * @param length   Number of characters to produce (positive integer).
 * @param alphabet Characters to choose from (1–256 chars). Defaults to the
 *                 URL-safe nanoid alphabet.
 */
export function randomString(
	length: number,
	alphabet: string = ALPHABETS.nanoid,
): string {
	assertPositiveInt(length, "length");
	if (typeof alphabet !== "string") {
		throw new TypeError(`"alphabet" must be a string, got ${typeof alphabet}`);
	}
	const alen = alphabet.length;
	if (alen < 1 || alen > 256) {
		throw new RangeError(
			`"alphabet" length must be between 1 and 256, got ${alen}`,
		);
	}
	// degenerate single-char alphabet: every position is that char
	if (alen === 1) return alphabet.repeat(length);

	// smallest 2^k - 1 mask that can index the whole alphabet
	const mask = (2 << Math.floor(Math.log2(alen - 1))) - 1;
	// over-fetch factor (1.6) keeps the rejection loop fast on average
	const step = Math.ceil((1.6 * mask * length) / alen);

	let id = "";
	while (true) {
		const bytes = randomBytes(step);
		for (let i = 0; i < step; i++) {
			const idx = bytes[i] & mask;
			if (idx < alen) {
				id += alphabet[idx];
				if (id.length === length) return id;
			}
		}
	}
}

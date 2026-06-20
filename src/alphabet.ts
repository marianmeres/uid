/**
 * Fixed-length random strings over the built-in named alphabets.
 *
 * These are thin, well-named wrappers around {@link randomString} so the most
 * common cases read cleanly: `hex(32)`, `numeric(6)`, `base62()`, …
 */

import { ALPHABETS, DEFAULT_LENGTH, randomString } from "./random.ts";

/**
 * nanoid-style id: URL-safe (`A–Z a–z 0–9 _ -`), crypto-backed, unbiased.
 *
 * @param length   Number of characters (default: {@link DEFAULT_LENGTH}).
 * @param alphabet Override the alphabet (default: URL-safe 64-char set).
 */
export function nanoid(
	length: number = DEFAULT_LENGTH,
	alphabet: string = ALPHABETS.nanoid,
): string {
	return randomString(length, alphabet);
}

/** Random lowercase hex string. */
export function hex(length: number = DEFAULT_LENGTH): string {
	return randomString(length, ALPHABETS.hex);
}

/** Random Crockford base32 string (no I, L, O, U). */
export function base32(length: number = DEFAULT_LENGTH): string {
	return randomString(length, ALPHABETS.base32);
}

/** Random lowercase base36 string. */
export function base36(length: number = DEFAULT_LENGTH): string {
	return randomString(length, ALPHABETS.base36);
}

/** Random Bitcoin base58 string (no 0, O, I, l). */
export function base58(length: number = DEFAULT_LENGTH): string {
	return randomString(length, ALPHABETS.base58);
}

/** Random full base62 string. */
export function base62(length: number = DEFAULT_LENGTH): string {
	return randomString(length, ALPHABETS.base62);
}

/** Random digits-only string — handy for OTPs / numeric coupon codes. */
export function numeric(length: number = DEFAULT_LENGTH): string {
	return randomString(length, ALPHABETS.numeric);
}

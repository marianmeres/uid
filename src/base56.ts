/**
 * Base56 strategy — human-friendly, no ambiguous characters (no 0 O o 1 l I).
 *
 * Two modes:
 *  - {@link base56}      random fixed-length string (coupon-style)
 *  - {@link uuidToBase56} / {@link base56ToUuid} fully reversible 23-char
 *    encoding of a UUID
 *
 * Note: 128 bits need ceil(128 / log2(56)) = 23 base56 characters in the worst
 * case (since 56^22 ≈ 2^127.76 < 2^128), so the encoded width is fixed at 23.
 */

import { ALPHABETS, DEFAULT_LENGTH, randomString } from "./random.ts";

const BASE56 = ALPHABETS.base56;

/**
 * Generates a random base56 string.
 *
 * @param length Number of characters (default: {@link DEFAULT_LENGTH}).
 */
export function base56(length: number = DEFAULT_LENGTH): string {
	return randomString(length, BASE56);
}

/**
 * Encodes a UUID into a 23-character base56 string. Fully reversible via
 * {@link base56ToUuid}.
 *
 * @param uuid A UUID string, with or without dashes.
 */
export function uuidToBase56(uuid: string): string {
	const hex = uuid.replace(/-/g, "").toLowerCase();
	if (!/^[0-9a-f]{32}$/.test(hex)) {
		throw new TypeError(`uuidToBase56: invalid uuid "${uuid}"`);
	}
	let num = BigInt("0x" + hex);
	let result = "";
	while (num > 0n) {
		result = BASE56[Number(num % 56n)] + result;
		num = num / 56n;
	}
	return result.padStart(23, BASE56[0]);
}

/**
 * Decodes a base56 string produced by {@link uuidToBase56} back into a
 * canonical UUID string.
 */
export function base56ToUuid(encoded: string): string {
	let num = 0n;
	for (const ch of encoded) {
		const idx = BASE56.indexOf(ch);
		if (idx < 0) {
			throw new Error(`base56ToUuid: invalid character "${ch}"`);
		}
		num = num * 56n + BigInt(idx);
	}
	const hex = num.toString(16).padStart(32, "0");
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20),
	].join("-");
}

/**
 * Generates a fresh UUID and returns its 23-character base56 encoding.
 * Equivalent to `uuidToBase56(uuid())`.
 */
export function base56Uuid(): string {
	return uuidToBase56(crypto.randomUUID());
}

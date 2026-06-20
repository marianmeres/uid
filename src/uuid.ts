/**
 * UUID and UUID-shaped, time-sortable strategies.
 */

import { ALPHABETS, randomBytes, randomString } from "./random.ts";

/** Formats 16 bytes as a canonical lowercase UUID string. */
function bytesToUuid(bytes: Uint8Array): string {
	let h = "";
	for (let i = 0; i < 16; i++) h += bytes[i].toString(16).padStart(2, "0");
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${
		h.slice(20)
	}`;
}

/**
 * Generates a random RFC 9562 UUID v4 via the native `crypto.randomUUID()`.
 *
 * @example
 * uuid(); // "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
 */
export function uuid(): string {
	return crypto.randomUUID();
}

/**
 * Generates a UUID v7 (RFC 9562): a 48-bit Unix-millisecond timestamp prefix
 * followed by random bits. The result is a valid UUID *and* lexicographically
 * sortable by creation time — ideal for database primary keys.
 *
 * @param timestamp Unix epoch milliseconds to embed (default: `Date.now()`).
 *                  Useful for tests or back-dating; must be in `[0, 2^48)`.
 * @example
 * uuidv7(); // "0192f6c4-1d2e-7a3b-8c4d-5e6f7a8b9c0d"
 */
export function uuidv7(timestamp: number = Date.now()): string {
	const ts = Math.floor(timestamp);
	if (!Number.isFinite(ts) || ts < 0 || ts > 0xffffffffffff) {
		throw new RangeError(
			`uuidv7: timestamp must be in [0, 2^48), got ${String(timestamp)}`,
		);
	}
	const bytes = randomBytes(16);
	// 48-bit big-endian timestamp in the first 6 bytes (division avoids the
	// 32-bit truncation of bitwise shifts).
	bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
	bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
	bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
	bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
	bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
	bytes[5] = ts & 0xff;
	bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
	return bytesToUuid(bytes);
}

/**
 * Generates a ULID: a 26-character Crockford-base32 string with a 48-bit
 * millisecond timestamp prefix (10 chars) and 80 bits of randomness (16 chars).
 *
 * Like UUID v7 it sorts by creation time, but it is shorter, case-insensitive,
 * and dash-free — not a valid UUID string.
 *
 * @param timestamp Unix epoch milliseconds to embed (default: `Date.now()`).
 * @example
 * ulid(); // "01J9Z7Q8K3M4N5P6R7S8T9V0W1"
 */
export function ulid(timestamp: number = Date.now()): string {
	const ts = Math.floor(timestamp);
	if (!Number.isFinite(ts) || ts < 0 || ts > 0xffffffffffff) {
		throw new RangeError(
			`ulid: timestamp must be in [0, 2^48), got ${String(timestamp)}`,
		);
	}
	const enc = ALPHABETS.base32;
	let time = ts;
	let timeChars = "";
	for (let i = 0; i < 10; i++) {
		timeChars = enc[time % 32] + timeChars;
		time = Math.floor(time / 32);
	}
	// base32 is a power of two, so randomString is unbiased and rejection-free
	return timeChars + randomString(16, enc);
}

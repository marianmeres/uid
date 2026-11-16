import assert from "node:assert/strict";
import { test } from "node:test";
import {
	ALPHABETS,
	assertNonNegativeInt,
	assertPositiveInt,
	randomBytes,
	randomString,
} from "../src/random.ts";

test("randomString length + charset", () => {
	const s = randomString(50, "abc");
	assert.deepStrictEqual(s.length, 50);
	assert.ok(/^[abc]+$/.test(s));
});

test("randomString single-char alphabet repeats", () => {
	assert.deepStrictEqual(randomString(5, "z"), "zzzzz");
});

test("randomString is unbiased enough to hit every symbol", () => {
	// over many draws from a non-power-of-two alphabet, every char should appear
	const alphabet = ALPHABETS.base62; // 62 — not a power of two
	const seen = new Set<string>();
	for (let i = 0; i < 200; i++) {
		for (const c of randomString(62, alphabet)) seen.add(c);
	}
	assert.deepStrictEqual(seen.size, alphabet.length);
});

test("randomString rejects bad input", () => {
	assert.throws(() => randomString(0, "abc"), { name: "TypeError", message: /length/ });
	assert.throws(() => randomString(1.5, "abc"), {
		name: "TypeError",
		message: /length/,
	});
	assert.throws(() => randomString(5, ""), { name: "RangeError", message: /alphabet/ });
	// deno-lint-ignore no-explicit-any
	assert.throws(() => randomString(5, 123 as any), {
		name: "TypeError",
		message: /alphabet/,
	});
});

test("randomBytes length + chunking beyond 65536", () => {
	assert.deepStrictEqual(randomBytes(10).length, 10);
	const big = randomBytes(70000);
	assert.deepStrictEqual(big.length, 70000);
	// extremely unlikely to be all zeros if it was actually filled
	assert.ok(big.some((b) => b !== 0));
});

test("assert helpers", () => {
	assertPositiveInt(1, "x");
	assertNonNegativeInt(0, "x");
	assert.throws(() => assertPositiveInt(0, "x"), TypeError);
	assert.throws(() => assertNonNegativeInt(-1, "x"), TypeError);
});

test("named alphabets have the expected sizes", () => {
	assert.deepStrictEqual(ALPHABETS.hex.length, 16);
	assert.deepStrictEqual(ALPHABETS.base32.length, 32);
	assert.deepStrictEqual(ALPHABETS.base36.length, 36);
	assert.deepStrictEqual(ALPHABETS.base56.length, 56);
	assert.deepStrictEqual(ALPHABETS.base58.length, 58);
	assert.deepStrictEqual(ALPHABETS.base62.length, 62);
	assert.deepStrictEqual(ALPHABETS.numeric.length, 10);
	assert.deepStrictEqual(ALPHABETS.nanoid.length, 64);
	// no duplicate characters in any alphabet
	for (const [name, alpha] of Object.entries(ALPHABETS)) {
		assert.deepStrictEqual(new Set(alpha).size, alpha.length, `dupes in ${name}`);
	}
});

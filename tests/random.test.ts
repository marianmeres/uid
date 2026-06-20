import { assert, assertEquals, assertThrows } from "@std/assert";
import {
	ALPHABETS,
	assertNonNegativeInt,
	assertPositiveInt,
	randomBytes,
	randomString,
} from "../src/random.ts";

Deno.test("randomString length + charset", () => {
	const s = randomString(50, "abc");
	assertEquals(s.length, 50);
	assert(/^[abc]+$/.test(s));
});

Deno.test("randomString single-char alphabet repeats", () => {
	assertEquals(randomString(5, "z"), "zzzzz");
});

Deno.test("randomString is unbiased enough to hit every symbol", () => {
	// over many draws from a non-power-of-two alphabet, every char should appear
	const alphabet = ALPHABETS.base62; // 62 — not a power of two
	const seen = new Set<string>();
	for (let i = 0; i < 200; i++) {
		for (const c of randomString(62, alphabet)) seen.add(c);
	}
	assertEquals(seen.size, alphabet.length);
});

Deno.test("randomString rejects bad input", () => {
	assertThrows(() => randomString(0, "abc"), TypeError, "length");
	assertThrows(() => randomString(1.5, "abc"), TypeError, "length");
	assertThrows(() => randomString(5, ""), RangeError, "alphabet");
	// deno-lint-ignore no-explicit-any
	assertThrows(() => randomString(5, 123 as any), TypeError, "alphabet");
});

Deno.test("randomBytes length + chunking beyond 65536", () => {
	assertEquals(randomBytes(10).length, 10);
	const big = randomBytes(70000);
	assertEquals(big.length, 70000);
	// extremely unlikely to be all zeros if it was actually filled
	assert(big.some((b) => b !== 0));
});

Deno.test("assert helpers", () => {
	assertPositiveInt(1, "x");
	assertNonNegativeInt(0, "x");
	assertThrows(() => assertPositiveInt(0, "x"), TypeError);
	assertThrows(() => assertNonNegativeInt(-1, "x"), TypeError);
});

Deno.test("named alphabets have the expected sizes", () => {
	assertEquals(ALPHABETS.hex.length, 16);
	assertEquals(ALPHABETS.base32.length, 32);
	assertEquals(ALPHABETS.base36.length, 36);
	assertEquals(ALPHABETS.base56.length, 56);
	assertEquals(ALPHABETS.base58.length, 58);
	assertEquals(ALPHABETS.base62.length, 62);
	assertEquals(ALPHABETS.numeric.length, 10);
	assertEquals(ALPHABETS.nanoid.length, 64);
	// no duplicate characters in any alphabet
	for (const [name, alpha] of Object.entries(ALPHABETS)) {
		assertEquals(new Set(alpha).size, alpha.length, `dupes in ${name}`);
	}
});

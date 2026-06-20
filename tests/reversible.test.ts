import { assert, assertEquals, assertThrows } from "@std/assert";
import { decodeInt, encodeInt } from "../src/reversible.ts";

Deno.test("round-trips a range of values (no salt)", () => {
	for (let v = 0; v <= 2000; v++) {
		assertEquals(decodeInt(encodeInt(v)), v);
	}
});

Deno.test("round-trips with a salt", () => {
	const opts = { salt: "my-secret" };
	for (const v of [0, 1, 42, 12345, 999999, Number.MAX_SAFE_INTEGER]) {
		assertEquals(decodeInt(encodeInt(v, opts), opts), v);
	}
});

Deno.test("round-trips with a custom alphabet", () => {
	const opts = { alphabet: "ABCDEFGHJKMNPQRSTVWXYZ", salt: "x" }; // Crockford
	for (const v of [0, 7, 58, 1000, 123456789]) {
		assertEquals(decodeInt(encodeInt(v, opts), opts), v);
	}
});

Deno.test("minLength pads but still decodes", () => {
	const enc = encodeInt(7, { minLength: 8 });
	assert(enc.length >= 8);
	assertEquals(decodeInt(enc), 7);
});

Deno.test("salt obfuscates sequential values", () => {
	const opts = { salt: "abc" };
	// consecutive ids should not look consecutive (different leading chars etc.)
	const a = encodeInt(1000, opts);
	const b = encodeInt(1001, opts);
	assert(a !== b);
	// a different salt yields a different encoding for the same value
	assert(encodeInt(1000, { salt: "abc" }) !== encodeInt(1000, { salt: "xyz" }));
});

Deno.test("encodeInt rejects bad values", () => {
	assertThrows(() => encodeInt(-1), RangeError);
	assertThrows(() => encodeInt(1.5), RangeError);
	assertThrows(() => encodeInt(Number.MAX_SAFE_INTEGER + 2), RangeError);
	assertThrows(() => encodeInt(5, { alphabet: "x" }), RangeError, "alphabet");
});

Deno.test("duplicate alphabet chars are rejected (would corrupt round-trip)", () => {
	assertThrows(() => encodeInt(5, { alphabet: "aab" }), RangeError, "unique");
	assertThrows(() => decodeInt("ab", { alphabet: "aab" }), RangeError, "unique");
});

Deno.test("decodeInt rejects invalid characters", () => {
	assertThrows(() => decodeInt("!!!"), Error, "invalid character");
});

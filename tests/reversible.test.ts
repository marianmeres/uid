import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeInt, encodeInt } from "../src/reversible.ts";

test("round-trips a range of values (no salt)", () => {
	for (let v = 0; v <= 2000; v++) {
		assert.deepStrictEqual(decodeInt(encodeInt(v)), v);
	}
});

test("round-trips with a salt", () => {
	const opts = { salt: "my-secret" };
	for (const v of [0, 1, 42, 12345, 999999, Number.MAX_SAFE_INTEGER]) {
		assert.deepStrictEqual(decodeInt(encodeInt(v, opts), opts), v);
	}
});

test("round-trips with a custom alphabet", () => {
	const opts = { alphabet: "ABCDEFGHJKMNPQRSTVWXYZ", salt: "x" }; // Crockford
	for (const v of [0, 7, 58, 1000, 123456789]) {
		assert.deepStrictEqual(decodeInt(encodeInt(v, opts), opts), v);
	}
});

test("minLength pads but still decodes", () => {
	const enc = encodeInt(7, { minLength: 8 });
	assert.ok(enc.length >= 8);
	assert.deepStrictEqual(decodeInt(enc), 7);
});

test("salt obfuscates sequential values", () => {
	const opts = { salt: "abc" };
	// consecutive ids should not look consecutive (different leading chars etc.)
	const a = encodeInt(1000, opts);
	const b = encodeInt(1001, opts);
	assert.ok(a !== b);
	// a different salt yields a different encoding for the same value
	assert.ok(encodeInt(1000, { salt: "abc" }) !== encodeInt(1000, { salt: "xyz" }));
});

test("encodeInt rejects bad values", () => {
	assert.throws(() => encodeInt(-1), RangeError);
	assert.throws(() => encodeInt(1.5), RangeError);
	assert.throws(() => encodeInt(Number.MAX_SAFE_INTEGER + 2), RangeError);
	assert.throws(() => encodeInt(5, { alphabet: "x" }), {
		name: "RangeError",
		message: /alphabet/,
	});
});

test("duplicate alphabet chars are rejected (would corrupt round-trip)", () => {
	assert.throws(() => encodeInt(5, { alphabet: "aab" }), {
		name: "RangeError",
		message: /unique/,
	});
	assert.throws(() => decodeInt("ab", { alphabet: "aab" }), {
		name: "RangeError",
		message: /unique/,
	});
});

test("decodeInt rejects invalid characters", () => {
	assert.throws(() => decodeInt("!!!"), {
		name: "Error",
		message: /invalid character/,
	});
});

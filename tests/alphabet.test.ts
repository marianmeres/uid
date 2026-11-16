import assert from "node:assert/strict";
import { test } from "node:test";
import { base32, base36, base58, base62, hex, nanoid, numeric } from "../src/alphabet.ts";
import { DEFAULT_LENGTH } from "../src/random.ts";

test("default lengths", () => {
	assert.deepStrictEqual(nanoid().length, DEFAULT_LENGTH);
	assert.deepStrictEqual(hex().length, DEFAULT_LENGTH);
	assert.deepStrictEqual(base62().length, DEFAULT_LENGTH);
});

test("charsets", () => {
	assert.ok(/^[-0-9A-Za-z_]{40}$/.test(nanoid(40)));
	assert.ok(/^[0-9a-f]{40}$/.test(hex(40)));
	assert.ok(/^[0-9A-HJKMNP-TV-Z]{40}$/.test(base32(40)));
	assert.ok(/^[0-9a-z]{40}$/.test(base36(40)));
	assert.ok(/^[1-9A-HJ-NP-Za-km-z]{40}$/.test(base58(40)));
	assert.ok(/^[0-9A-Za-z]{40}$/.test(base62(40)));
	assert.ok(/^[0-9]{40}$/.test(numeric(40)));
});

test("nanoid accepts a custom alphabet", () => {
	assert.ok(/^[ab]{100}$/.test(nanoid(100, "ab")));
});

test("ids are practically unique", () => {
	const ids = new Set(Array.from({ length: 5000 }, () => nanoid()));
	assert.deepStrictEqual(ids.size, 5000);
});

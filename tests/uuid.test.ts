import assert from "node:assert/strict";
import { test } from "node:test";
import { ulid, uuid, uuidv7 } from "../src/uuid.ts";

test("uuid v4 format + uniqueness", () => {
	assert.match(
		uuid(),
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
	const set = new Set(Array.from({ length: 1000 }, () => uuid()));
	assert.deepStrictEqual(set.size, 1000);
});

test("uuidv7 format (version 7, variant)", () => {
	assert.match(
		uuidv7(),
		/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
});

test("uuidv7 embeds and sorts by timestamp", () => {
	const a = uuidv7(0x0190_0000_0000); // some ms value
	const b = uuidv7(0x0190_0000_0001);
	assert.ok(a < b, "later timestamp should sort after");

	// the first 48 bits (12 hex chars, minus the dash at index 8) encode the ms
	const ts = 0x017f_2200_3344;
	const id = uuidv7(ts);
	const hex = id.replace(/-/g, "").slice(0, 12);
	assert.deepStrictEqual(parseInt(hex, 16), ts);
});

test("uuidv7 monotonic across real now()", () => {
	const ids = Array.from({ length: 50 }, () => uuidv7());
	assert.deepStrictEqual(new Set(ids).size, 50);
});

test("uuidv7 rejects out-of-range timestamps", () => {
	assert.throws(() => uuidv7(-1), RangeError);
	assert.throws(() => uuidv7(2 ** 48), RangeError);
});

test("ulid format + length", () => {
	assert.match(ulid(), /^[0-9A-HJKMNP-TV-Z]{26}$/);
	assert.deepStrictEqual(ulid().length, 26);
});

test("ulid sorts by timestamp", () => {
	const a = ulid(1_000_000);
	const b = ulid(2_000_000);
	assert.ok(a.slice(0, 10) < b.slice(0, 10));
});

test("ulid time prefix round-trips through Crockford32", () => {
	const enc = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
	const ts = 1_700_000_000_000;
	const time = ulid(ts).slice(0, 10);
	let decoded = 0;
	for (const ch of time) decoded = decoded * 32 + enc.indexOf(ch);
	assert.deepStrictEqual(decoded, ts);
});

test("ulid rejects out-of-range timestamps", () => {
	assert.throws(() => ulid(-1), RangeError);
	assert.throws(() => ulid(2 ** 48), RangeError);
});

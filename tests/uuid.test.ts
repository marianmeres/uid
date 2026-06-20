import { assert, assertEquals, assertMatch, assertThrows } from "@std/assert";
import { ulid, uuid, uuidv7 } from "../src/uuid.ts";

Deno.test("uuid v4 format + uniqueness", () => {
	assertMatch(
		uuid(),
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
	const set = new Set(Array.from({ length: 1000 }, () => uuid()));
	assertEquals(set.size, 1000);
});

Deno.test("uuidv7 format (version 7, variant)", () => {
	assertMatch(
		uuidv7(),
		/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
});

Deno.test("uuidv7 embeds and sorts by timestamp", () => {
	const a = uuidv7(0x0190_0000_0000); // some ms value
	const b = uuidv7(0x0190_0000_0001);
	assert(a < b, "later timestamp should sort after");

	// the first 48 bits (12 hex chars, minus the dash at index 8) encode the ms
	const ts = 0x017f_2200_3344;
	const id = uuidv7(ts);
	const hex = id.replace(/-/g, "").slice(0, 12);
	assertEquals(parseInt(hex, 16), ts);
});

Deno.test("uuidv7 monotonic across real now()", () => {
	const ids = Array.from({ length: 50 }, () => uuidv7());
	assertEquals(new Set(ids).size, 50);
});

Deno.test("uuidv7 rejects out-of-range timestamps", () => {
	assertThrows(() => uuidv7(-1), RangeError);
	assertThrows(() => uuidv7(2 ** 48), RangeError);
});

Deno.test("ulid format + length", () => {
	assertMatch(ulid(), /^[0-9A-HJKMNP-TV-Z]{26}$/);
	assertEquals(ulid().length, 26);
});

Deno.test("ulid sorts by timestamp", () => {
	const a = ulid(1_000_000);
	const b = ulid(2_000_000);
	assert(a.slice(0, 10) < b.slice(0, 10));
});

Deno.test("ulid time prefix round-trips through Crockford32", () => {
	const enc = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
	const ts = 1_700_000_000_000;
	const time = ulid(ts).slice(0, 10);
	let decoded = 0;
	for (const ch of time) decoded = decoded * 32 + enc.indexOf(ch);
	assertEquals(decoded, ts);
});

Deno.test("ulid rejects out-of-range timestamps", () => {
	assertThrows(() => ulid(-1), RangeError);
	assertThrows(() => ulid(2 ** 48), RangeError);
});

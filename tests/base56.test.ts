import assert from "node:assert/strict";
import { test } from "node:test";
import { base56, base56ToUuid, base56Uuid, uuidToBase56 } from "../src/base56.ts";

// base56 drops 0 1 I O l o — uppercase: A-H J-N P-Z; lowercase: a-k m-n p-z
const B56 = /^[2-9A-HJ-NP-Za-km-np-z]+$/;

test("base56 random length + charset", () => {
	assert.deepStrictEqual(base56(12).length, 12);
	assert.ok(B56.test(base56(40)));
});

test("uuid <-> base56 round-trips", () => {
	for (let i = 0; i < 1000; i++) {
		const u = crypto.randomUUID();
		assert.deepStrictEqual(base56ToUuid(uuidToBase56(u)), u);
	}
});

test("encoded uuid is always 23 chars (fixed width)", () => {
	// includes the high-bit range that overflows 22 chars (~15% of uuids)
	for (let i = 0; i < 1000; i++) {
		assert.deepStrictEqual(uuidToBase56(crypto.randomUUID()).length, 23);
	}
	// explicit max-value uuid (all bits set) needs the full 23 chars
	assert.deepStrictEqual(
		uuidToBase56("ffffffff-ffff-ffff-ffff-ffffffffffff").length,
		23,
	);
});

test("base56Uuid produces a reversible encoding", () => {
	const enc = base56Uuid();
	assert.deepStrictEqual(enc.length, 23);
	assert.ok(B56.test(enc));
	// decodes to a valid uuid
	assert.deepStrictEqual(base56ToUuid(enc).length, 36);
});

test("zero uuid round-trips", () => {
	const zero = "00000000-0000-0000-0000-000000000000";
	const enc = uuidToBase56(zero);
	assert.deepStrictEqual(enc, "2".repeat(23));
	assert.deepStrictEqual(base56ToUuid(enc), zero);
});

test("uuidToBase56 accepts dashless + rejects garbage", () => {
	const u = crypto.randomUUID();
	assert.deepStrictEqual(uuidToBase56(u.replace(/-/g, "")), uuidToBase56(u));
	assert.throws(() => uuidToBase56("not-a-uuid"), TypeError);
	assert.throws(() => base56ToUuid("0OIl"), Error); // ambiguous chars not in alphabet
});

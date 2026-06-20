import { assert, assertEquals, assertThrows } from "@std/assert";
import { base56, base56ToUuid, base56Uuid, uuidToBase56 } from "../src/base56.ts";

// base56 drops 0 1 I O l o — uppercase: A-H J-N P-Z; lowercase: a-k m-n p-z
const B56 = /^[2-9A-HJ-NP-Za-km-np-z]+$/;

Deno.test("base56 random length + charset", () => {
	assertEquals(base56(12).length, 12);
	assert(B56.test(base56(40)));
});

Deno.test("uuid <-> base56 round-trips", () => {
	for (let i = 0; i < 1000; i++) {
		const u = crypto.randomUUID();
		assertEquals(base56ToUuid(uuidToBase56(u)), u);
	}
});

Deno.test("encoded uuid is always 23 chars (fixed width)", () => {
	// includes the high-bit range that overflows 22 chars (~15% of uuids)
	for (let i = 0; i < 1000; i++) {
		assertEquals(uuidToBase56(crypto.randomUUID()).length, 23);
	}
	// explicit max-value uuid (all bits set) needs the full 23 chars
	assertEquals(uuidToBase56("ffffffff-ffff-ffff-ffff-ffffffffffff").length, 23);
});

Deno.test("base56Uuid produces a reversible encoding", () => {
	const enc = base56Uuid();
	assertEquals(enc.length, 23);
	assert(B56.test(enc));
	// decodes to a valid uuid
	assertEquals(base56ToUuid(enc).length, 36);
});

Deno.test("zero uuid round-trips", () => {
	const zero = "00000000-0000-0000-0000-000000000000";
	const enc = uuidToBase56(zero);
	assertEquals(enc, "2".repeat(23));
	assertEquals(base56ToUuid(enc), zero);
});

Deno.test("uuidToBase56 accepts dashless + rejects garbage", () => {
	const u = crypto.randomUUID();
	assertEquals(uuidToBase56(u.replace(/-/g, "")), uuidToBase56(u));
	assertThrows(() => uuidToBase56("not-a-uuid"), TypeError);
	assertThrows(() => base56ToUuid("0OIl"), Error); // ambiguous chars not in alphabet
});

import { assert, assertEquals } from "@std/assert";
import { base32, base36, base58, base62, hex, nanoid, numeric } from "../src/alphabet.ts";
import { DEFAULT_LENGTH } from "../src/random.ts";

Deno.test("default lengths", () => {
	assertEquals(nanoid().length, DEFAULT_LENGTH);
	assertEquals(hex().length, DEFAULT_LENGTH);
	assertEquals(base62().length, DEFAULT_LENGTH);
});

Deno.test("charsets", () => {
	assert(/^[-0-9A-Za-z_]{40}$/.test(nanoid(40)));
	assert(/^[0-9a-f]{40}$/.test(hex(40)));
	assert(/^[0-9A-HJKMNP-TV-Z]{40}$/.test(base32(40)));
	assert(/^[0-9a-z]{40}$/.test(base36(40)));
	assert(/^[1-9A-HJ-NP-Za-km-z]{40}$/.test(base58(40)));
	assert(/^[0-9A-Za-z]{40}$/.test(base62(40)));
	assert(/^[0-9]{40}$/.test(numeric(40)));
});

Deno.test("nanoid accepts a custom alphabet", () => {
	assert(/^[ab]{100}$/.test(nanoid(100, "ab")));
});

Deno.test("ids are practically unique", () => {
	const ids = new Set(Array.from({ length: 5000 }, () => nanoid()));
	assertEquals(ids.size, 5000);
});

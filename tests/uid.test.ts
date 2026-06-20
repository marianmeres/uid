import { assert, assertEquals, assertMatch, assertThrows } from "@std/assert";
import { listStrategies, registerStrategy, uid } from "../src/uid.ts";
import { encodeInt } from "../src/reversible.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

Deno.test("uid() defaults to uuid v4", () => {
	assertMatch(uid(), UUID_RE);
});

Deno.test("uid('uuid') / uid('uuidv4')", () => {
	assertMatch(uid("uuid"), UUID_RE);
	assertMatch(uid("uuidv4"), UUID_RE);
});

Deno.test("uid('uuidv7') is a valid v7 uuid", () => {
	assertMatch(
		uid("uuidv7"),
		/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
});

Deno.test("uid('ulid') is 26 Crockford chars", () => {
	assertMatch(uid("ulid"), /^[0-9A-HJKMNP-TV-Z]{26}$/);
});

Deno.test("uid('base56') random + reversible-from-uuid", () => {
	assertEquals(uid("base56", { length: 8 }).length, 8);
	const u = crypto.randomUUID();
	assertEquals(uid("base56", { uuid: u }).length, 23);
});

Deno.test("uid('nanoid') honors length + alphabet", () => {
	assertEquals(uid("nanoid", { length: 12 }).length, 12);
	assertMatch(uid("nanoid", { length: 30, alphabet: "ab" }), /^[ab]{30}$/);
});

Deno.test("uid() alphabet presets", () => {
	assertMatch(uid("hex", { length: 16 }), /^[0-9a-f]{16}$/);
	assertMatch(uid("numeric", { length: 6 }), /^[0-9]{6}$/);
	assertMatch(uid("base62", { length: 10 }), /^[0-9A-Za-z]{10}$/);
	assertMatch(uid("base58", { length: 10 }), /^[1-9A-HJ-NP-Za-km-z]{10}$/);
});

Deno.test("uid('custom') requires an alphabet", () => {
	assertMatch(uid("custom", { alphabet: "xyz", length: 5 }), /^[xyz]{5}$/);
	// deno-lint-ignore no-explicit-any
	assertThrows(() => uid("custom", {} as any), TypeError, "alphabet");
});

Deno.test("uid('counter') increments per prefix", () => {
	const p = `t${uid("hex", { length: 6 })}_`; // unique prefix per run
	assertEquals(uid("counter", { prefix: p }), `${p}0`);
	assertEquals(uid("counter", { prefix: p }), `${p}1`);
});

Deno.test("uid('reversible') matches encodeInt and requires value", () => {
	assertEquals(uid("reversible", { value: 12345 }), encodeInt(12345));
	assertEquals(
		uid("reversible", { value: 12345, salt: "s" }),
		encodeInt(12345, { salt: "s" }),
	);
	// deno-lint-ignore no-explicit-any
	assertThrows(() => uid("reversible", {} as any), TypeError, "value");
});

Deno.test("unknown strategy throws with the available list", () => {
	assertThrows(() => uid("nope"), Error, "Unknown uid strategy");
});

Deno.test("registerStrategy adds a custom strategy", () => {
	registerStrategy("always-x", () => "x");
	assertEquals(uid("always-x"), "x");
	assert(listStrategies().includes("always-x"));
	assertThrows(
		// deno-lint-ignore no-explicit-any
		() => registerStrategy("", (() => "") as any),
		TypeError,
	);
});

Deno.test("built-in strategies are all registered", () => {
	const names = listStrategies();
	for (
		const n of [
			"uuid",
			"uuidv4",
			"uuidv7",
			"ulid",
			"base56",
			"nanoid",
			"hex",
			"base32",
			"base36",
			"base58",
			"base62",
			"numeric",
			"custom",
			"counter",
			"reversible",
		]
	) {
		assert(names.includes(n), `missing strategy: ${n}`);
	}
});

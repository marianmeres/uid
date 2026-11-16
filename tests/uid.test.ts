import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeInt } from "../src/reversible.ts";
import { listStrategies, registerStrategy, uid } from "../src/uid.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("uid() defaults to uuid v4", () => {
	assert.match(uid(), UUID_RE);
});

test("uid('uuid') / uid('uuidv4')", () => {
	assert.match(uid("uuid"), UUID_RE);
	assert.match(uid("uuidv4"), UUID_RE);
});

test("uid('uuidv7') is a valid v7 uuid", () => {
	assert.match(
		uid("uuidv7"),
		/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
});

test("uid('ulid') is 26 Crockford chars", () => {
	assert.match(uid("ulid"), /^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test("uid('base56') random + reversible-from-uuid", () => {
	assert.deepStrictEqual(uid("base56", { length: 8 }).length, 8);
	const u = crypto.randomUUID();
	assert.deepStrictEqual(uid("base56", { uuid: u }).length, 23);
});

test("uid('nanoid') honors length + alphabet", () => {
	assert.deepStrictEqual(uid("nanoid", { length: 12 }).length, 12);
	assert.match(uid("nanoid", { length: 30, alphabet: "ab" }), /^[ab]{30}$/);
});

test("uid() alphabet presets", () => {
	assert.match(uid("hex", { length: 16 }), /^[0-9a-f]{16}$/);
	assert.match(uid("numeric", { length: 6 }), /^[0-9]{6}$/);
	assert.match(uid("base62", { length: 10 }), /^[0-9A-Za-z]{10}$/);
	assert.match(uid("base58", { length: 10 }), /^[1-9A-HJ-NP-Za-km-z]{10}$/);
});

test("uid('custom') requires an alphabet", () => {
	assert.match(uid("custom", { alphabet: "xyz", length: 5 }), /^[xyz]{5}$/);
	// deno-lint-ignore no-explicit-any
	assert.throws(() => uid("custom", {} as any), {
		name: "TypeError",
		message: /alphabet/,
	});
});

test("uid('counter') increments per prefix", () => {
	const p = `t${uid("hex", { length: 6 })}_`; // unique prefix per run
	assert.deepStrictEqual(uid("counter", { prefix: p }), `${p}0`);
	assert.deepStrictEqual(uid("counter", { prefix: p }), `${p}1`);
});

test("uid('reversible') matches encodeInt and requires value", () => {
	assert.deepStrictEqual(uid("reversible", { value: 12345 }), encodeInt(12345));
	assert.deepStrictEqual(
		uid("reversible", { value: 12345, salt: "s" }),
		encodeInt(12345, { salt: "s" }),
	);
	// deno-lint-ignore no-explicit-any
	assert.throws(() => uid("reversible", {} as any), {
		name: "TypeError",
		message: /value/,
	});
});

test("unknown strategy throws with the available list", () => {
	assert.throws(() => uid("nope"), { name: "Error", message: /Unknown uid strategy/ });
});

test("registerStrategy adds a custom strategy", () => {
	registerStrategy("always-x", () => "x");
	assert.deepStrictEqual(uid("always-x"), "x");
	assert.ok(listStrategies().includes("always-x"));
	assert.throws(
		// deno-lint-ignore no-explicit-any
		() => registerStrategy("", (() => "") as any),
		TypeError,
	);
});

test("built-in strategies are all registered", () => {
	const names = listStrategies();
	for (const n of [
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
	]) {
		assert.ok(names.includes(n), `missing strategy: ${n}`);
	}
});

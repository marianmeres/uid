import assert from "node:assert/strict";
import { test } from "node:test";
import { counter, createCounter, resetCounters } from "../src/counter.ts";

test("createCounter emits an isolated sequence", () => {
	const next = createCounter({ prefix: "row-", start: 1, pad: 4 });
	assert.deepStrictEqual(next(), "row-0001");
	assert.deepStrictEqual(next(), "row-0002");
	assert.deepStrictEqual(next(), "row-0003");
});

test("createCounter respects start/step", () => {
	const next = createCounter({ start: 10, step: 5 });
	assert.deepStrictEqual(next(), "10");
	assert.deepStrictEqual(next(), "15");
	assert.deepStrictEqual(next(), "20");
});

test("createCounter instances are independent", () => {
	const a = createCounter({ prefix: "a" });
	const b = createCounter({ prefix: "b" });
	assert.deepStrictEqual(a(), "a0");
	assert.deepStrictEqual(a(), "a1");
	assert.deepStrictEqual(b(), "b0");
});

test("counter() shares state per prefix", () => {
	resetCounters("p_");
	assert.deepStrictEqual(counter({ prefix: "p_" }), "p_0");
	assert.deepStrictEqual(counter({ prefix: "p_" }), "p_1");
	resetCounters("p_");
	assert.deepStrictEqual(counter({ prefix: "p_" }), "p_0");
});

test("counter() prefixes are independent", () => {
	resetCounters();
	assert.deepStrictEqual(counter({ prefix: "x" }), "x0");
	assert.deepStrictEqual(counter({ prefix: "y" }), "y0");
	assert.deepStrictEqual(counter({ prefix: "x" }), "x1");
});

test("counter() first call configures; later overrides are ignored", () => {
	resetCounters("cfg");
	assert.deepStrictEqual(counter({ prefix: "cfg", step: 1, pad: 3 }), "cfg000");
	// later step/pad overrides for the same prefix are ignored → stable width + step
	assert.deepStrictEqual(counter({ prefix: "cfg", step: 10, pad: 9 }), "cfg001");
	assert.deepStrictEqual(counter({ prefix: "cfg", start: 999 }), "cfg002");
});

test("counter validates options", () => {
	assert.throws(() => counter({ step: 0 }), { name: "TypeError", message: /step/ });
	assert.throws(() => counter({ step: 1.5 }), { name: "TypeError", message: /step/ });
	assert.throws(() => counter({ start: 1.5 }), { name: "TypeError", message: /start/ });
	// deno-lint-ignore no-explicit-any
	assert.throws(() => counter({ prefix: 1 as any }), { name: "TypeError", message: /prefix/ });
});

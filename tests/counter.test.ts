import { assertEquals, assertThrows } from "@std/assert";
import { counter, createCounter, resetCounters } from "../src/counter.ts";

Deno.test("createCounter emits an isolated sequence", () => {
	const next = createCounter({ prefix: "row-", start: 1, pad: 4 });
	assertEquals(next(), "row-0001");
	assertEquals(next(), "row-0002");
	assertEquals(next(), "row-0003");
});

Deno.test("createCounter respects start/step", () => {
	const next = createCounter({ start: 10, step: 5 });
	assertEquals(next(), "10");
	assertEquals(next(), "15");
	assertEquals(next(), "20");
});

Deno.test("createCounter instances are independent", () => {
	const a = createCounter({ prefix: "a" });
	const b = createCounter({ prefix: "b" });
	assertEquals(a(), "a0");
	assertEquals(a(), "a1");
	assertEquals(b(), "b0");
});

Deno.test("counter() shares state per prefix", () => {
	resetCounters("p_");
	assertEquals(counter({ prefix: "p_" }), "p_0");
	assertEquals(counter({ prefix: "p_" }), "p_1");
	resetCounters("p_");
	assertEquals(counter({ prefix: "p_" }), "p_0");
});

Deno.test("counter() prefixes are independent", () => {
	resetCounters();
	assertEquals(counter({ prefix: "x" }), "x0");
	assertEquals(counter({ prefix: "y" }), "y0");
	assertEquals(counter({ prefix: "x" }), "x1");
});

Deno.test("counter() first call configures; later overrides are ignored", () => {
	resetCounters("cfg");
	assertEquals(counter({ prefix: "cfg", step: 1, pad: 3 }), "cfg000");
	// later step/pad overrides for the same prefix are ignored → stable width + step
	assertEquals(counter({ prefix: "cfg", step: 10, pad: 9 }), "cfg001");
	assertEquals(counter({ prefix: "cfg", start: 999 }), "cfg002");
});

Deno.test("counter validates options", () => {
	assertThrows(() => counter({ step: 0 }), TypeError, "step");
	assertThrows(() => counter({ step: 1.5 }), TypeError, "step");
	assertThrows(() => counter({ start: 1.5 }), TypeError, "start");
	// deno-lint-ignore no-explicit-any
	assertThrows(() => counter({ prefix: 1 as any }), TypeError, "prefix");
});

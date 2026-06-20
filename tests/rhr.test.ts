import { assert, assertStringIncludes, assertThrows } from "@std/assert";
import { uid } from "../src/uid.ts";

// NOTE: this is the ONLY test file that touches the opt-in rhr subpath, and it
// imports it dynamically (inside step 2) — so step 1 deterministically observes
// the strategy as not-yet-registered regardless of test file ordering.
Deno.test("rhr is opt-in", async (t) => {
	await t.step("uid('rhr') throws a helpful error before registration", () => {
		assertThrows(() => uid("rhr"), Error, "opt-in");
	});

	await t.step("importing the subpath enables it", async () => {
		const { rhr } = await import("../src/rhr.ts");

		// named export works directly
		const direct = rhr();
		assert(typeof direct === "string" && direct.length > 0);
		assertStringIncludes(direct, "-");

		// and now the dispatcher resolves it too
		const viaUid = uid("rhr");
		assert(typeof viaUid === "string" && viaUid.length > 0);

		// options pass through
		const oneNoun = rhr({ adjCount: 0, colorsCount: 0, nounsCount: 1 });
		assert(!oneNoun.includes("-"), `expected a single word, got "${oneNoun}"`);
	});
});

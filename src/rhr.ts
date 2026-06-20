/**
 * Opt-in `rhr` strategy — human-readable ids built on
 * `@marianmeres/random-human-readable`.
 *
 * Kept out of the core entry point because its word lists add weight to browser
 * bundles. Import this module to use it:
 *
 * ```ts
 * import "@marianmeres/uid/rhr";       // registers the strategy
 * import { uid } from "@marianmeres/uid";
 * uid("rhr");                          // "happy-blue-otter-canyon"
 *
 * // …or call it directly (tree-shakeable, no registration needed):
 * import { rhr } from "@marianmeres/uid/rhr";
 * rhr({ nounsCount: 1 });
 * ```
 */

import { getRandomHumanReadable } from "@marianmeres/random-human-readable";
import { registerStrategy, type RhrOptions } from "./uid.ts";

/**
 * Generates a random human-readable id (e.g. `"happy-blue-otter-canyon"`).
 * Joined with `-` by default; pass any `getRandomHumanReadable` options.
 */
export function rhr(options: RhrOptions = {}): string {
	return getRandomHumanReadable({ joinWith: "-", ...options }) as string;
}

// Self-register so `uid("rhr", …)` works once this module is imported.
registerStrategy("rhr", (o = {}) => rhr(o as RhrOptions));

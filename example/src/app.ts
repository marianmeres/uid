/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

/**
 * Interactive showcase for every @marianmeres/uid strategy.
 *
 * The page is data-driven: {@link CARDS} below describes each strategy — its
 * blurb, its editable options, and (where useful) a caption that proves
 * something about the output (the timestamp a `uuidv7` embeds, the uuid a
 * base56 string decodes back to, …). Everything else — controls, live code
 * snippet, result rows, copy-to-clipboard — is generic.
 *
 * Markup comes from the `<template>`s in index.html; state and wiring come from
 * @marianmeres/vanilla. Build with `deno task example:build`.
 */

import {
	applyBindings,
	createView,
	delegate,
	fromTemplate,
	observable,
	refs,
} from "@marianmeres/vanilla";

import {
	ALPHABETS,
	base56ToUuid,
	decodeInt,
	registerStrategy,
	resetCounters,
	uid,
	uuid,
} from "../../src/mod.ts";

// Registers the opt-in "rhr" strategy — exactly what a consumer would write as
// `import "@marianmeres/uid/rhr"`.
import "../../src/rhr.ts";

// A custom strategy, registered here to show that the dispatcher is extensible.
registerStrategy("order", () => "ORD-" + uid("numeric", { length: 8 }));

/* ============================================================================
 * TYPES
 * ========================================================================== */

type FieldKind = "number" | "text" | "datetime" | "checkbox" | "select";

/** One editable option of a strategy. */
interface FieldSpec {
	/** Option name — also the key in the options object passed to `uid()`. */
	name: string;
	label: string;
	kind: FieldKind;
	/** Initial value (also what the control is rendered with). */
	value?: string | number | boolean;
	placeholder?: string;
	hint?: string;
	min?: number;
	max?: number;
	/** `select` only. */
	options?: string[];
	/** Span the full row (long alphabets / uuids). */
	wide?: boolean;
	/** Keep `""` as a real value instead of falling back to the default. */
	allowEmpty?: boolean;
	/**
	 * What the library itself would use when this option is absent. Matching
	 * values are dropped from the call, so the snippet always shows the *minimal*
	 * code that reproduces the result — and shows you where the defaults are.
	 */
	libraryDefault?: unknown;
}

/** The (strategy, options) pair actually handed to `uid()`. */
interface Call {
	strategy: string;
	options: Record<string, unknown>;
}

type Values = Record<string, unknown>;
type SetValue = (name: string, value: unknown) => void;

interface CardSpec {
	id: string;
	title: string;
	blurb: string;
	fields: FieldSpec[];
	/** Fills in derived defaults right before generating (see base56 ↔ uuid). */
	prepare?: (v: Values, set: SetValue) => void;
	call: (v: Values) => Call;
	/** Small caption under a generated value — usually a round-trip proof. */
	meta?: (value: string, call: Call) => string | undefined;
	/** Runs after a successful generate (see `reversible`). */
	after?: (v: Values, set: SetValue) => void;
	/** An extra button next to "Generate". */
	action?: { label: string; title: string; run: (v: Values) => void };
	/**
	 * Footnote under the controls. A function is re-evaluated whenever a control
	 * moves — the place for something that depends on the options but would be
	 * pure noise repeated on every result row (an alphabet, say).
	 */
	note?: string | ((v: Values) => string);
}

interface Entry {
	value: string;
	meta?: string;
	error?: boolean;
}

/* ============================================================================
 * THE STRATEGIES
 * ========================================================================== */

/** How many results each card keeps on screen. */
const MAX_ENTRIES = 5;

const CARDS: CardSpec[] = [
	{
		id: "uuid",
		title: "uuid",
		blurb: "RFC 9562 UUID v4 — 122 random bits straight from crypto.randomUUID(). " +
			'The default strategy: uid(), uid("uuid") and uid("uuidv4") are the same call.',
		fields: [],
		call: () => ({ strategy: "uuid", options: {} }),
	},
	{
		id: "uuidv7",
		title: "uuidv7",
		blurb:
			"Time-sortable UUID: a 48-bit millisecond timestamp first, randomness after. " +
			"Still a valid UUID, so it drops into any uuid column — and ids sort by creation time.",
		fields: [
			{
				name: "timestamp",
				label: "timestamp",
				kind: "datetime",
				hint: "empty = now",
				wide: true,
			},
		],
		call: (v) => ({ strategy: "uuidv7", options: { timestamp: v.timestamp } }),
		meta: (value) => `embeds ${formatTime(uuidv7Time(value))}`,
		note: "Generate a few — the prefix only moves forward.",
	},
	{
		id: "ulid",
		title: "ulid",
		blurb:
			"Same idea as uuidv7 but shorter, dash-free and case-insensitive: 10 Crockford " +
			"base32 chars of timestamp + 16 of randomness. Sortable, but not a valid UUID string.",
		fields: [
			{
				name: "timestamp",
				label: "timestamp",
				kind: "datetime",
				hint: "empty = now",
				wide: true,
			},
		],
		call: (v) => ({ strategy: "ulid", options: { timestamp: v.timestamp } }),
		meta: (value) => `embeds ${formatTime(ulidTime(value))}`,
	},
	{
		id: "nanoid",
		title: "nanoid",
		blurb:
			"URL-safe random id over the 64-char set A–Z a–z 0–9 _ - . At the default 21 " +
			"characters that is ~126 bits — the usual drop-in for a public id in a URL.",
		fields: [
			{
				name: "length",
				label: "length",
				kind: "number",
				value: 21,
				min: 1,
				libraryDefault: 21,
			},
			{
				name: "alphabet",
				label: "alphabet",
				kind: "text",
				placeholder: "empty = URL-safe default",
				wide: true,
			},
		],
		call: (v) => ({
			strategy: "nanoid",
			options: { length: v.length, alphabet: v.alphabet },
		}),
	},
	{
		id: "alphabets",
		title: "named alphabets",
		blurb:
			"One generator, six curated alphabets. hex and base36 are lowercase; base32 " +
			"(Crockford) and base58 (Bitcoin) drop look-alike characters; numeric is digits " +
			"only — the OTP / coupon-code case.",
		fields: [
			{
				name: "strategy",
				label: "alphabet",
				kind: "select",
				value: "base58",
				options: ["hex", "base32", "base36", "base58", "base62", "numeric"],
			},
			{
				name: "length",
				label: "length",
				kind: "number",
				value: 21,
				min: 1,
				hint: "default 21",
				libraryDefault: 21,
			},
		],
		call: (v) => ({
			strategy: String(v.strategy ?? "base58"),
			options: { length: v.length },
		}),
		note: (v) => `${v.strategy}: ${alphabetOf(String(v.strategy))}`,
	},
	{
		id: "base56",
		title: "base56",
		blurb:
			"base58 minus 1 and o, so none of 0 O o 1 l I survive. Safe to read aloud over " +
			"the phone or retype off a printout.",
		fields: [{
			name: "length",
			label: "length",
			kind: "number",
			value: 10,
			min: 1,
			libraryDefault: 21,
		}],
		call: (v) => ({ strategy: "base56", options: { length: v.length } }),
		note: `base56: ${ALPHABETS.base56}`,
	},
	{
		id: "base56-uuid",
		title: "base56 ↔ uuid",
		blurb:
			"A UUID is 128 bits and 23 base56 characters hold exactly that, so the short " +
			"form is lossless: base56ToUuid() gives you the original back, character for character.",
		fields: [
			{
				name: "uuid",
				label: "uuid",
				kind: "text",
				placeholder: "empty = a fresh uuid",
				wide: true,
			},
		],
		prepare: (v, set) => {
			if (!v.uuid) set("uuid", uuid());
		},
		call: (v) => ({ strategy: "base56", options: { uuid: v.uuid } }),
		meta: (value) => `base56ToUuid() → ${base56ToUuid(value)}`,
		note: "Leave the field empty to encode a fresh uuid each time.",
	},
	{
		id: "custom",
		title: "custom",
		blurb:
			"Any alphabet you like, 1–256 characters. Rejection sampling keeps the output " +
			"unbiased even when the alphabet size is not a power of two — no modulo skew.",
		fields: [
			{
				name: "alphabet",
				label: "alphabet",
				kind: "text",
				value: "ACGT",
				wide: true,
			},
			{
				name: "length",
				label: "length",
				kind: "number",
				value: 24,
				min: 1,
				libraryDefault: 21,
			},
		],
		call: (v) => ({
			strategy: "custom",
			options: { alphabet: v.alphabet, length: v.length },
		}),
		note:
			"Clear the alphabet to see the TypeError — options are validated, never coerced.",
	},
	{
		id: "rhr",
		title: "rhr",
		blurb:
			"Human-readable ids from @marianmeres/random-human-readable. Opt-in, because " +
			'its word lists are heavy: import "@marianmeres/uid/rhr" once to register it.',
		fields: [
			{
				name: "adjCount",
				label: "adjectives",
				kind: "number",
				value: 1,
				min: 0,
				max: 4,
				libraryDefault: 1,
			},
			{
				name: "colorsCount",
				label: "colors",
				kind: "number",
				value: 1,
				min: 0,
				max: 4,
				libraryDefault: 1,
			},
			{
				name: "nounsCount",
				label: "nouns",
				kind: "number",
				value: 2,
				min: 0,
				max: 4,
				libraryDefault: 2,
			},
			{
				name: "syllablesCount",
				label: "syllables",
				kind: "number",
				value: 0,
				min: 0,
				max: 4,
				libraryDefault: 0,
			},
			{
				name: "digitsCount",
				label: "digits",
				kind: "number",
				value: 0,
				min: 0,
				max: 8,
				libraryDefault: 0,
			},
			{
				name: "specialCharsCount",
				label: "specials",
				kind: "number",
				value: 0,
				min: 0,
				max: 4,
				libraryDefault: 0,
			},
			{
				name: "joinWith",
				label: "join with",
				kind: "text",
				value: "-",
				allowEmpty: true,
				libraryDefault: "-",
			},
			{
				name: "randomizeCase",
				label: "randomize case",
				kind: "checkbox",
				value: false,
				libraryDefault: false,
			},
		],
		call: (v) => ({ strategy: "rhr", options: { ...v } }),
	},
	{
		id: "counter",
		title: "counter",
		blurb:
			"An in-memory sequence, one per prefix, alive for the lifetime of the page and " +
			"reset on reload. For DOM ids, tree nodes and test fixtures — not for " +
			"cross-process uniqueness. The first call for a prefix fixes its start/step/pad.",
		fields: [
			{
				name: "prefix",
				label: "prefix",
				kind: "text",
				value: "node_",
				libraryDefault: "",
			},
			{
				name: "start",
				label: "start",
				kind: "number",
				value: 0,
				libraryDefault: 0,
			},
			{
				name: "step",
				label: "step",
				kind: "number",
				value: 1,
				min: 1,
				libraryDefault: 1,
			},
			{
				name: "pad",
				label: "pad",
				kind: "number",
				value: 0,
				min: 0,
				libraryDefault: 0,
			},
		],
		call: (v) => ({
			strategy: "counter",
			options: { prefix: v.prefix, start: v.start, step: v.step, pad: v.pad },
		}),
		action: {
			label: "Reset",
			title: "resetCounters(prefix)",
			run: (v) => resetCounters(String(v.prefix ?? "")),
		},
		note:
			"Change start/step/pad and the prefix keeps its original config — reset it " +
			"(or use createCounter() for an isolated instance) to apply the new one.",
	},
	{
		id: "reversible",
		title: "reversible",
		blurb:
			"A hashids-lite integer codec. The salt deterministically shuffles the alphabet, " +
			"so consecutive row ids stop looking consecutive in your URLs. Obfuscation, not " +
			"encryption — anyone with the salt can reverse it.",
		fields: [
			{ name: "value", label: "value", kind: "number", value: 12345, min: 0 },
			{
				name: "salt",
				label: "salt",
				kind: "text",
				value: "my-secret",
				libraryDefault: "",
			},
			{
				name: "minLength",
				label: "min length",
				kind: "number",
				value: 0,
				min: 0,
				libraryDefault: 0,
			},
			{
				name: "alphabet",
				label: "alphabet",
				kind: "text",
				placeholder: "empty = base62",
				wide: true,
			},
		],
		call: (v) => ({
			strategy: "reversible",
			options: {
				value: v.value,
				salt: v.salt,
				minLength: v.minLength,
				alphabet: v.alphabet,
			},
		}),
		meta: (value, call) => `decodeInt() → ${decodeInt(value, call.options)}`,
		after: (v, set) => set("value", Number(v.value ?? 0) + 1),
		note: "value auto-increments after each encode, so you can see how little " +
			"neighbouring numbers resemble each other.",
	},
	{
		id: "order",
		title: "order — your own",
		blurb:
			"registerStrategy() puts your own generator behind the same dispatcher. This " +
			'one was registered with: registerStrategy("order", () => "ORD-" + ' +
			'uid("numeric", { length: 8 })).',
		fields: [],
		call: () => ({ strategy: "order", options: {} }),
	},
];

/* ============================================================================
 * HELPERS
 * ========================================================================== */

/**
 * Reduces the options to the ones that actually change anything: unset controls
 * (`undefined`) and values equal to the library's own default both drop out.
 * The pruned object is what gets passed to `uid()` *and* what the snippet
 * prints, so the code on screen is never a fiction.
 */
function pruneOptions(
	options: Record<string, unknown>,
	fields: Record<string, FieldSpec>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(options)) {
		if (v === undefined) continue;
		if (v === fields[k]?.libraryDefault) continue;
		out[k] = v;
	}
	return out;
}

/** Renders the call as the line of code you would have written yourself. */
function snippetOf(call: Call): string {
	const parts = Object.entries(call.options).map(
		([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : String(v)}`,
	);
	const opts = parts.length ? `, { ${parts.join(", ")} }` : "";
	return `uid("${call.strategy}"${opts})`;
}

function alphabetOf(name: string): string {
	return (ALPHABETS as Record<string, string>)[name] ?? "";
}

/** Reads back the 48-bit millisecond prefix a uuidv7 embeds. */
function uuidv7Time(id: string): number {
	return Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}

/** Reads back the 48-bit millisecond prefix a ulid embeds (10 base32 chars). */
function ulidTime(id: string): number {
	let ms = 0;
	for (const ch of id.slice(0, 10).toUpperCase()) {
		ms = ms * 32 + ALPHABETS.base32.indexOf(ch);
	}
	return ms;
}

/**
 * Local time, not UTC — the caption sits next to a `datetime-local` picker, and
 * an ISO `Z` string next to a local-time input reads as an off-by-a-timezone bug.
 */
function formatTime(ms: number): string {
	const d = new Date(ms);
	const p = (n: number, w = 2) => String(n).padStart(w, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
		`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${
			p(d.getMilliseconds(), 3)
		} local · ${ms}`;
}

/**
 * Copy that also works outside a secure context (plain http, file://), where
 * the async Clipboard API is simply not there.
 */
async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// fall through to the legacy path
	}
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		ta.style.top = "0";
		document.body.appendChild(ta);
		ta.select();
		ta.setSelectionRange(0, text.length);
		const ok = document.execCommand("copy");
		ta.remove();
		return ok;
	} catch {
		return false;
	}
}

/**
 * Last resort when both copy paths are refused (no permission, no user
 * activation): leave the id selected so the keyboard shortcut still works.
 */
function selectText(el: Element): void {
	try {
		const range = document.createRange();
		range.selectNodeContents(el);
		const sel = globalThis.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	} catch {
		// nothing sensible left to do
	}
}

/* ============================================================================
 * FIELD CONTROLS
 * ========================================================================== */

const FIELD_TEMPLATE: Record<FieldKind, string> = {
	number: "tpl-field-number",
	text: "tpl-field-text",
	datetime: "tpl-field-datetime",
	checkbox: "tpl-field-checkbox",
	select: "tpl-field-select",
};

type Control = HTMLInputElement | HTMLSelectElement;

/** Clones the control for `spec` and primes it with the spec's default. */
function buildField(spec: FieldSpec): { el: HTMLElement; input: Control } {
	const el = fromTemplate(FIELD_TEMPLATE[spec.kind]);
	const r = refs(el);
	const input = r.input as Control;

	input.dataset.field = spec.name;
	if (r.label) r.label.textContent = spec.label;
	if (r.hint) {
		r.hint.textContent = spec.hint ?? "";
		r.hint.hidden = !spec.hint;
	}
	if (spec.wide) el.classList.add("is-wide");

	if (spec.kind === "select") {
		for (const value of spec.options ?? []) {
			const opt = document.createElement("option");
			opt.value = value;
			opt.textContent = value;
			input.appendChild(opt);
		}
		input.value = String(spec.value ?? spec.options?.[0] ?? "");
	} else if (spec.kind === "checkbox") {
		(input as HTMLInputElement).checked = Boolean(spec.value);
	} else {
		const numeric = input as HTMLInputElement;
		if (spec.placeholder) numeric.placeholder = spec.placeholder;
		if (spec.min !== undefined) numeric.min = String(spec.min);
		if (spec.max !== undefined) numeric.max = String(spec.max);
		numeric.value = spec.value === undefined ? "" : String(spec.value);
	}

	return { el, input };
}

/** DOM value → option value. Empty means "unset", not zero / empty string. */
function readField(spec: FieldSpec, input: Control): unknown {
	if (spec.kind === "checkbox") return (input as HTMLInputElement).checked;

	const raw = input.value;
	if (spec.kind === "number") {
		const trimmed = raw.trim();
		return trimmed === "" ? undefined : Number(trimmed);
	}
	if (spec.kind === "datetime") {
		if (!raw) return undefined;
		const ms = Date.parse(raw); // no offset → local time, which is what the picker shows
		return Number.isNaN(ms) ? undefined : ms;
	}
	return raw === "" && !spec.allowEmpty ? undefined : raw;
}

/** Option value → DOM value (for the fields the card writes back into). */
function writeField(spec: FieldSpec, input: Control, value: unknown): void {
	if (spec.kind === "checkbox") {
		(input as HTMLInputElement).checked = Boolean(value);
	} else {
		input.value = value === undefined || value === null ? "" : String(value);
	}
}

/* ============================================================================
 * THE CARD
 * ========================================================================== */

interface CardView {
	el: HTMLElement;
	generate: () => void;
	clear: () => void;
	destroy: () => void;
}

function createCard(spec: CardSpec): CardView {
	return createView((track) => {
		const el = fromTemplate("tpl-card");
		const r = refs(el);
		const entries = observable<Entry[]>([]);
		const values: Values = {};
		const inputs: Record<string, Control> = {};
		const fields: Record<string, FieldSpec> = {};

		el.id = `card-${spec.id}`;
		r.title.textContent = spec.title;
		r.blurb.textContent = spec.blurb;
		r.note.hidden = !spec.note;

		for (const field of spec.fields) {
			const { el: fieldEl, input } = buildField(field);
			fields[field.name] = field;
			inputs[field.name] = input;
			values[field.name] = readField(field, input);
			r.fields.appendChild(fieldEl);
		}
		r.fields.hidden = spec.fields.length === 0;

		if (spec.action) {
			r.actionBtn.textContent = spec.action.label;
			r.actionBtn.title = spec.action.title;
		} else {
			r.actionBtn.hidden = true;
		}

		const setValue: SetValue = (name, value) => {
			const field = fields[name];
			if (!field) return;
			values[name] = value;
			writeField(field, inputs[name], value);
		};

		/** The (strategy, options) pair the current control state describes. */
		const currentCall = (): Call => {
			const call = spec.call(values);
			return {
				strategy: call.strategy,
				options: pruneOptions(call.options, fields),
			};
		};

		const render = (call: Call = currentCall()) => {
			r.snippet.textContent = snippetOf(call);
			if (typeof spec.note === "function") r.note.textContent = spec.note(values);
			else if (spec.note) r.note.textContent = spec.note;
		};

		const push = (entry: Entry) => {
			entries.update((list) => [entry, ...list].slice(0, MAX_ENTRIES));
		};

		const generate = () => {
			spec.prepare?.(values, setValue);
			const call = currentCall();
			render(call);
			try {
				const value = uid(call.strategy, call.options);
				let meta: string | undefined;
				try {
					meta = spec.meta?.(value, call);
				} catch {
					// a caption is a nicety — never let it swallow a good id
				}
				push({ value, meta });
				spec.after?.(values, setValue);
			} catch (e) {
				push({ value: String((e as Error)?.message ?? e), error: true });
			}
		};

		track(
			delegate(el, {
				change: (_e, target) => {
					const input = target as Control;
					const name = input.dataset.field!;
					values[name] = readField(fields[name], input);
					render();
				},
				generate,
				action: () => {
					spec.action?.run(values);
					entries.set([]);
				},
				clear: () => entries.set([]),
				copy: (_e, target) => {
					const valueEl = target.querySelector("[data-ref='value']");
					const badge = target.querySelector("[data-ref='badge']");
					copyText(valueEl?.textContent ?? "").then((ok) => {
						if (!ok && valueEl) selectText(valueEl);
						target.dataset.copied = ok ? "yes" : "no";
						target.title = ok
							? "Copied"
							: "Clipboard blocked — the id is selected, use your copy shortcut";
						if (badge) badge.textContent = ok ? "copied" : "failed";
						globalThis.setTimeout(() => {
							delete target.dataset.copied;
							target.title = "Copy";
							if (badge) badge.textContent = "copy";
						}, 1400);
					});
				},
			}),
		);

		track(
			entries.subscribe((list) => {
				r.outputs.replaceChildren();
				list.forEach((entry, i) => {
					const li = fromTemplate(
						entry.error ? "tpl-output-error" : "tpl-output",
					);
					applyBindings(li, {
						value: entry.value,
						meta: entry.meta ?? "",
						noMeta: !entry.meta,
					});
					if (!entry.error && i === 0) li.classList.add("is-latest");
					r.outputs.appendChild(li);
				});
				r.empty.hidden = list.length > 0;
				r.clearBtn.hidden = list.length === 0;
			}),
		);

		render();

		return { el, generate, clear: () => entries.set([]) };
	});
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

const THEME_KEY = "uid-example-dark";

const dark = observable<boolean>(loadDark());

function loadDark(): boolean {
	try {
		const saved = localStorage.getItem(THEME_KEY);
		if (saved !== null) return saved === "1";
	} catch {
		// private mode / blocked storage — fall back to the OS preference
	}
	return matchMedia("(prefers-color-scheme: dark)").matches;
}

dark.subscribe((on) => {
	document.documentElement.classList.toggle("dark", on);
	const btn = document.getElementById("dark-toggle")!;
	btn.textContent = on ? "☀" : "◐";
	btn.title = on ? "Switch to light" : "Switch to dark";
	btn.setAttribute("aria-pressed", String(on));
	try {
		localStorage.setItem(THEME_KEY, on ? "1" : "0");
	} catch {
		// ignore
	}
});

document.getElementById("dark-toggle")!.addEventListener("click", () => {
	dark.update((on) => !on);
});

const grid = document.getElementById("cards")!;
const cards = CARDS.map(createCard);
for (const card of cards) grid.appendChild(card.el);

document.getElementById("generate-all")!.addEventListener("click", () => {
	for (const card of cards) card.generate();
});

document.getElementById("clear-all")!.addEventListener("click", () => {
	for (const card of cards) card.clear();
});

// Something to look at on first paint.
for (const card of cards) card.generate();

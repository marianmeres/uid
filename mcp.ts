import { z } from "npm:zod";
import type { McpToolDefinition } from "jsr:@marianmeres/mcp-server/types";
import {
	base56ToUuid,
	decodeInt,
	type DecodeIntOptions,
	encodeInt,
	type EncodeIntOptions,
	uid,
	uuidToBase56,
} from "./src/mod.ts";
// Register the opt-in "rhr" strategy so generate-uid can reach it too.
import "./src/rhr.ts";

export const tools: McpToolDefinition[] = [
	{
		name: "generate-uid",
		description:
			"Generate one or more unique ids using a chosen strategy: uuid (v4), " +
			"uuidv7 or ulid (time-sortable database keys), nanoid (URL-safe), " +
			"base56/base58/base62/base36/base32/hex/numeric random strings " +
			"(coupon and OTP codes), custom (your own alphabet), counter (in-memory " +
			"prefixed sequence), reversible (encode an integer — pass `value`), or rhr " +
			"(human-readable). Returns the generated id(s), one per line.",
		params: {
			strategy: z
				.string()
				.optional()
				.describe(
					'Strategy: "uuid" (default), "uuidv7", "ulid", "nanoid", "base56", ' +
						'"base58", "base62", "base36", "base32", "hex", "numeric", "custom", ' +
						'"counter", "reversible", "rhr"',
				),
			length: z
				.number()
				.optional()
				.describe("Character length for random strategies (default: 21)"),
			count: z
				.number()
				.optional()
				.describe("How many ids to generate (default: 1, max: 50)"),
			alphabet: z
				.string()
				.optional()
				.describe('Alphabet for "nanoid"/"custom" (custom requires it)'),
			prefix: z.string().optional().describe('Prefix for "counter"'),
			pad: z
				.number()
				.optional()
				.describe('Zero-pad the numeric part for "counter"'),
			timestamp: z
				.number()
				.optional()
				.describe('Unix epoch ms to embed for "uuidv7"/"ulid"'),
			uuid: z
				.string()
				.optional()
				.describe('For "base56": reversibly encode this UUID instead of random'),
			value: z
				.number()
				.optional()
				.describe('For "reversible": the non-negative integer to encode'),
			salt: z.string().optional().describe(
				'For "reversible": alphabet-shuffling salt',
			),
			minLength: z
				.number()
				.optional()
				.describe('For "reversible": left-pad to at least this length'),
		},
		handler: async (params) => {
			const p = params as {
				strategy?: string;
				length?: number;
				count?: number;
				alphabet?: string;
				prefix?: string;
				pad?: number;
				timestamp?: number;
				uuid?: string;
				value?: number;
				salt?: string;
				minLength?: number;
			};
			const strategy = p.strategy ?? "uuid";
			const options: Record<string, unknown> = {};
			for (
				const k of [
					"length",
					"alphabet",
					"prefix",
					"pad",
					"timestamp",
					"uuid",
					"value",
					"salt",
					"minLength",
				] as const
			) {
				if (p[k] !== undefined) options[k] = p[k];
			}
			const n = Math.min(Math.max(1, p.count ?? 1), 50);
			const results: string[] = [];
			for (let i = 0; i < n; i++) results.push(uid(strategy, options));
			return results.join("\n");
		},
	},
	{
		name: "uuid-to-base56",
		description:
			"Encode a UUID into its fixed-width 23-character base56 representation " +
			"(drops ambiguous characters 0 O o 1 l I). Reversible with base56-to-uuid.",
		params: {
			uuid: z.string().describe("A UUID string, with or without dashes"),
		},
		handler: async ({ uuid: u }) => uuidToBase56(u as string),
	},
	{
		name: "base56-to-uuid",
		description:
			"Decode a 23-character base56 string (produced by uuid-to-base56) back " +
			"into a canonical UUID.",
		params: {
			encoded: z.string().describe("Base56 string produced by uuid-to-base56"),
		},
		handler: async ({ encoded }) => base56ToUuid(encoded as string),
	},
	{
		name: "encode-int",
		description:
			"Reversibly encode a non-negative integer into a short opaque string " +
			"(sqids/hashids-style). With a salt the alphabet is deterministically " +
			"shuffled so sequential ids don't look sequential — useful for exposing " +
			"database row ids in URLs. Obfuscation, not encryption.",
		params: {
			value: z.number().describe("Non-negative safe integer to encode"),
			salt: z
				.string()
				.optional()
				.describe("Salt that shuffles the alphabet (must match when decoding)"),
			alphabet: z
				.string()
				.optional()
				.describe("Alphabet of unique characters (default: base62)"),
			minLength: z
				.number()
				.optional()
				.describe("Left-pad the result to at least this length"),
		},
		handler: async (params) => {
			const { value, salt, alphabet, minLength } = params as {
				value: number;
				salt?: string;
				alphabet?: string;
				minLength?: number;
			};
			const opts: EncodeIntOptions = {};
			if (salt !== undefined) opts.salt = salt;
			if (alphabet !== undefined) opts.alphabet = alphabet;
			if (minLength !== undefined) opts.minLength = minLength;
			return encodeInt(value, opts);
		},
	},
	{
		name: "decode-int",
		description:
			"Decode a string produced by encode-int back into its integer. The salt " +
			"and alphabet must match those used to encode.",
		params: {
			str: z.string().describe("String produced by encode-int"),
			salt: z.string().optional().describe("Salt used when encoding"),
			alphabet: z
				.string()
				.optional()
				.describe("Alphabet used when encoding (default: base62)"),
		},
		handler: async (params) => {
			const { str, salt, alphabet } = params as {
				str: string;
				salt?: string;
				alphabet?: string;
			};
			const opts: DecodeIntOptions = {};
			if (salt !== undefined) opts.salt = salt;
			if (alphabet !== undefined) opts.alphabet = alphabet;
			return String(decodeInt(str, opts));
		},
	},
];

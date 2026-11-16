/**
 * Static file server for the interactive example: serves `example/` as is
 * (index.html, the stylesheets, and the bundle `pnpm run example:build` writes
 * to `example/dist/`).
 *
 * Run: `pnpm run example:serve` (build the bundle first). `PORT` overrides the
 * port.
 *
 * @module
 */

import process from "node:process";
import { fileURLToPath } from "node:url";
import { demino } from "@marianmeres/demino";
import { serve } from "@marianmeres/demino/node";

// 21440: the first of the ports reserved for this project (21440-21449)
const PORT = Number(process.env.PORT) || 21440;

const app = demino("", [], {
	// one line per request instead of the default's full Request dump
	logger: {
		...console,
		access: ({ status, req }) =>
			console.log(`${status} ${req.method} ${new URL(req.url).pathname}`),
	},
});
app.static("/", fileURLToPath(new URL(".", import.meta.url)));

await serve(app, { port: PORT, webSockets: false });

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

const PORT = Number(process.env.PORT) || 8000;

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

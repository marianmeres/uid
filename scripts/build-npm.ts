import { npmBuild, versionizeDeps } from "@marianmeres/npmbuild";

const denoJson = JSON.parse(Deno.readTextFileSync("deno.json"));

const RHR = "@marianmeres/random-human-readable";

await npmBuild({
	name: denoJson.name,
	version: denoJson.version,
	repository: denoJson.name.replace(/^@/, ""),
	// "." (mod) is the zero-dep core; "./rhr" is the opt-in human-readable strategy
	entryPoints: ["mod", "rhr"],
	// rhr is an OPTIONAL peer dep: installed --no-save so tsc can resolve its
	// types during the build, declared as an optional peer in package.json so
	// core-only consumers never pull it (and its word lists) in.
	peerDependencies: versionizeDeps([RHR], denoJson),
	peerDependenciesMeta: { [RHR]: { optional: true } },
	// the Web Crypto globals (crypto.getRandomValues / randomUUID) live in the
	// DOM lib; add it so tsc can type-check the emitted package.
	tsconfig: { compilerOptions: { lib: ["esnext", "dom"] } },
});

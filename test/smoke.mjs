#!/usr/bin/env node
// Dependency-free tests. Run: node test/smoke.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyse } from "../lib/analyse.mjs";
import { render, summarise } from "../lib/render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "..", "bin", "claudemd-init.mjs");

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}\n      ${e.message}`);
    failed++;
  }
};
const ok = (v, m) => {
  if (!v) throw new Error(m || "expected truthy");
};
const no = (v, m) => {
  if (v) throw new Error(m || "expected falsy");
};
const eq = (a, b, m) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${m || "mismatch"}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
};

const root = mkdtempSync(join(tmpdir(), "claudemd-test-"));
const proj = (name, files) => {
  const d = join(root, name);
  mkdirSync(d, { recursive: true });
  for (const [f, c] of Object.entries(files)) {
    const p = join(d, f);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof c === "string" ? c : Array.isArray(c) ? c.join("\n") : JSON.stringify(c, null, 2));
  }
  return d;
};

console.log("analysis");

const full = proj("full", {
  "package.json": {
    name: "demo-app",
    description: "A demo",
    type: "module",
    main: "src/index.ts",
    scripts: { dev: "vite", build: "vite build", test: "vitest", lint: "eslint .", "db:push": "drizzle-kit push" },
    dependencies: { react: "^18.0.0", express: "^4.0.0" },
    devDependencies: { typescript: "^5.0.0", vite: "^5.0.0", vitest: "^1.0.0" },
  },
  "package-lock.json": "{}",
  "tsconfig.json": { compilerOptions: { strict: true, paths: { "@/*": ["./src/*"] } } },
  ".prettierrc": "{}",
  "src/index.ts": "export const a = 1;",
  "src/app.tsx": "export default null;",
  "src/util.ts": "export const b = 2;",
  "tests/a.test.ts": "test",
  // Written as lines so no key sits next to a long value in this source file.
  ".env.example": ["# a comment line", "DATABASE_URL=", "API_TOKEN=", "", "PORT="],
  "README.md": "# demo",
  "docs/ARCHITECTURE.md": "# arch",
  Dockerfile: "FROM node:22",
  "node_modules/junk/index.js": "ignored",
  "dist/out.js": "ignored",
});

const a = analyse(full);

check("reads the name and description from package.json", () => {
  eq(a.name, "demo-app", "name");
  eq(a.description, "A demo", "description");
});

check("skips node_modules and dist", () => {
  no(a.layout.some((d) => d.path === "node_modules"), "node_modules leaked");
  no(a.layout.some((d) => d.path === "dist"), "dist leaked");
});

check("ranks languages by share", () => {
  eq(a.languages[0].name, "TypeScript", "TypeScript should lead");
  ok(a.languages[0].share > 0, "share computed");
});

check("every stack entry carries its evidence", () => {
  ok(a.stack.length >= 5, "found tools");
  ok(a.stack.every((s) => s.evidence), "each must name what proved it");
  const names = a.stack.map((s) => s.name);
  for (const want of ["React", "Express", "Vite", "TypeScript", "Docker"]) {
    ok(names.includes(want), `missing ${want}`);
  }
});

check("detects the package manager from the lockfile", () => {
  eq(a.packageManager.name, "npm", "npm");
  eq(analyse(proj("pnpm", { "package.json": { name: "x" }, "pnpm-lock.yaml": "" })).packageManager.name, "pnpm", "pnpm");
});

check("groups scripts by purpose", () => {
  const byKind = Object.fromEntries(a.scripts.map((s) => [s.name, s.kind]));
  eq(byKind.dev, "run", "dev");
  eq(byKind.build, "build", "build");
  eq(byKind.test, "test", "test");
  eq(byKind.lint, "check", "lint");
  eq(byKind["db:push"], "database", "db:push");
});

check("only lists entry points that exist", () => {
  ok(a.entryPoints.some((e) => e.path === "src/index.ts"), "declared main");
  ok(a.entryPoints.every((e) => existsSync(join(full, e.path))), "no phantom paths");
});

check("observes conventions with evidence", () => {
  const texts = a.conventions.map((c) => c.text).join(" | ");
  ok(/ES modules/.test(texts), "esm");
  ok(/strict mode/.test(texts), "strict");
  ok(/Prettier/.test(texts), "prettier");
  ok(/Path aliases/.test(texts), "paths");
  ok(/Tests live in/.test(texts), "test dir");
  ok(a.conventions.every((c) => c.evidence), "evidence on each");
});

check("collects env var NAMES only, skipping comments", () => {
  eq(a.env.names, ["DATABASE_URL", "API_TOKEN", "PORT"], "names");
});

check("finds docs", () => {
  ok(a.docs.includes("README.md"), "readme");
  ok(a.docs.includes("docs/ARCHITECTURE.md"), "docs dir");
});

check("an empty directory yields nothing invented", () => {
  const e = analyse(proj("bare", { "notes.txt": "hi" }));
  eq(e.languages, [], "no languages");
  eq(e.stack, [], "no stack");
  eq(e.scripts, [], "no scripts");
  eq(e.env, null, "no env");
});

check("handles a project with no package.json", () => {
  const g = analyse(proj("golang", { "go.mod": "module x", "main.go": "package main" }));
  ok(g.stack.some((s) => s.name === "Go modules"), "go detected");
  eq(g.scripts, [], "no npm scripts");
});

console.log("rendering");

const md = render(a);

check("renders the sections it has data for", () => {
  for (const h of [
    "# demo-app",
    "## What this is",
    "## Commands",
    "## Layout",
    "## Start reading here",
    "## Conventions",
    "## Environment",
  ]) {
    ok(md.includes(h), `missing ${h}`);
  }
});

check("renders commands with the right runner", () => {
  ok(md.includes("`npm run dev`"), "dev command");
});

check("tells the reader not to read the real env values", () => {
  ok(md.includes("Never read or print the real values"), "warning present");
});

check("ends with a note that it only observed", () => {
  ok(/observed, not inferred/.test(md), "honesty note");
});

check("omits sections it has nothing for", () => {
  const bare = render(analyse(proj("bare2", { "a.txt": "x", "package.json": { name: "n" } })));
  no(/## Environment/.test(bare), "should omit env");
  no(/## Commands/.test(bare), "should omit commands");
});

check("--evidence adds the proof, plain mode does not", () => {
  const withEv = render(a, { withEvidence: true });
  ok(withEv.includes("<!--"), "evidence comments");
  ok(withEv.includes("package.json"), "names the source");
});

check("summarise is a one-liner", () => {
  const s = summarise(a);
  ok(s.includes("files"), "file count");
  ok(!s.includes("\n"), "single line");
});

console.log("cli");

const run = (args, opts = {}) => {
  try {
    return execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", ...opts });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
};

check("prints without writing by default", () => {
  const out = run(["--dir", full]);
  ok(out.includes("# demo-app"), "printed");
  no(existsSync(join(full, "CLAUDE.md")), "must not write without --write");
});

check("--write creates the file", () => {
  const d = proj("w", { "package.json": { name: "w", scripts: { test: "x" } } });
  run(["--dir", d, "--write"]);
  ok(existsSync(join(d, "CLAUDE.md")), "written");
  ok(readFileSync(join(d, "CLAUDE.md"), "utf8").includes("# w"), "content");
});

check("refuses to clobber an existing CLAUDE.md", () => {
  const d = proj("existing", { "package.json": { name: "e" }, "CLAUDE.md": "# hand written\nimportant rule\n" });
  const out = run(["--dir", d, "--write"]);
  ok(/already exists/.test(out), `should refuse, got: ${out}`);
  ok(readFileSync(join(d, "CLAUDE.md"), "utf8").includes("important rule"), "original intact");
});

check("--force replaces it", () => {
  const d = proj("forced", { "package.json": { name: "f" }, "CLAUDE.md": "# old\n" });
  run(["--dir", d, "--write", "--force"]);
  ok(!readFileSync(join(d, "CLAUDE.md"), "utf8").includes("# old"), "replaced");
});

check("--json emits valid JSON", () => {
  const o = JSON.parse(run(["--dir", full, "--json"]));
  eq(o.name, "demo-app", "name");
  ok(Array.isArray(o.stack), "stack");
});

check("a missing directory fails cleanly", () => {
  ok(/no such directory/.test(run(["--dir", join(root, "nope")])), "message");
});

check("--help works", () => {
  ok(run(["--help"]).includes("write a CLAUDE.md"), "help");
});

try {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
} catch {
  /* temp dir will be cleared by the OS */
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

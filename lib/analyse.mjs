// Work out what a repository actually is, from what is on disk.
//
// Everything here is observed, never guessed. A CLAUDE.md full of plausible
// fiction is worse than no CLAUDE.md, because it is believed.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { execFileSync } from "node:child_process";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "coverage",
  "vendor", "__pycache__", ".venv", "venv", "target", ".cache", ".claude",
  ".serena", ".idea", ".vscode",
]);

const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs",
  ".java", ".kt", ".cs", ".php", ".swift", ".c", ".h", ".cpp", ".hpp", ".vue",
  ".svelte", ".scala", ".ex", ".exs",
]);

export function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Walk the tree once, collecting what every later question needs. */
export function walk(root, { maxFiles = 20_000, maxDepth = 8 } = {}) {
  const files = [];
  const dirs = [];
  const byExt = new Map();
  let truncated = false;

  const rec = (dir, depth) => {
    if (depth > maxDepth || files.length >= maxFiles) {
      if (files.length >= maxFiles) truncated = true;
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
      const p = join(dir, e.name);
      const rel = p.slice(root.length + 1).replace(/\\/g, "/");
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
        dirs.push(rel);
        rec(p, depth + 1);
      } else if (e.isFile()) {
        files.push(rel);
        const ext = extname(e.name).toLowerCase();
        if (CODE_EXT.has(ext)) byExt.set(ext, (byExt.get(ext) || 0) + 1);
      }
    }
  };
  rec(root, 0);
  return { files, dirs, byExt, truncated };
}

/** Languages, most-used first, as a share of code files. */
export function languages(byExt) {
  const groups = {
    TypeScript: [".ts", ".tsx"],
    JavaScript: [".js", ".jsx", ".mjs", ".cjs"],
    Python: [".py"],
    Go: [".go"],
    Rust: [".rs"],
    Ruby: [".rb"],
    Java: [".java", ".kt"],
    "C#": [".cs"],
    PHP: [".php"],
    Swift: [".swift"],
    "C/C++": [".c", ".h", ".cpp", ".hpp"],
    Vue: [".vue"],
    Svelte: [".svelte"],
    Elixir: [".ex", ".exs"],
    Scala: [".scala"],
  };
  const total = [...byExt.values()].reduce((a, b) => a + b, 0) || 1;
  const out = [];
  for (const [name, exts] of Object.entries(groups)) {
    const n = exts.reduce((a, e) => a + (byExt.get(e) || 0), 0);
    if (n) out.push({ name, files: n, share: Math.round((n / total) * 100) });
  }
  return out.sort((a, b) => b.files - a.files);
}

/** Frameworks and tools, each proved by the file or dependency that shows it. */
export function stack(root, pkg) {
  const found = [];
  const add = (name, evidence) => found.push({ name, evidence });
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const dep = (n, label = n) => {
    if (deps[n]) add(label, `${n}@${deps[n]}`);
  };
  const file = (f, label) => {
    if (existsSync(join(root, f))) add(label, f);
  };

  dep("react", "React");
  dep("next", "Next.js");
  dep("vue", "Vue");
  dep("svelte", "Svelte");
  dep("@angular/core", "Angular");
  dep("express", "Express");
  dep("fastify", "Fastify");
  dep("hono", "Hono");
  dep("vite", "Vite");
  dep("webpack", "webpack");
  dep("tailwindcss", "Tailwind CSS");
  dep("typescript", "TypeScript");
  dep("prisma", "Prisma");
  dep("drizzle-orm", "Drizzle");
  dep("firebase", "Firebase (client)");
  dep("firebase-admin", "Firebase Admin");
  dep("@supabase/supabase-js", "Supabase");
  dep("mongoose", "Mongoose");
  dep("pg", "PostgreSQL (pg)");
  dep("vitest", "Vitest");
  dep("jest", "Jest");
  dep("playwright", "Playwright");
  dep("@playwright/test", "Playwright");
  dep("cypress", "Cypress");
  dep("eslint", "ESLint");
  dep("prettier", "Prettier");
  dep("tsx", "tsx");
  dep("electron", "Electron");
  dep("react-native", "React Native");
  dep("expo", "Expo");

  file("Dockerfile", "Docker");
  file("docker-compose.yml", "Docker Compose");
  file("docker-compose.yaml", "Docker Compose");
  file("requirements.txt", "pip requirements");
  file("pyproject.toml", "Python (pyproject)");
  file("Cargo.toml", "Cargo");
  file("go.mod", "Go modules");
  file("Gemfile", "Bundler");
  file("pom.xml", "Maven");
  file("build.gradle", "Gradle");
  file("firebase.json", "Firebase hosting/rules");
  file("vercel.json", "Vercel");
  file("fly.toml", "Fly.io");
  file("terraform", "Terraform");
  file("serverless.yml", "Serverless Framework");

  return found;
}

export function packageManager(root) {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return { name: "pnpm", evidence: "pnpm-lock.yaml" };
  if (existsSync(join(root, "yarn.lock"))) return { name: "yarn", evidence: "yarn.lock" };
  if (existsSync(join(root, "bun.lockb"))) return { name: "bun", evidence: "bun.lockb" };
  if (existsSync(join(root, "package-lock.json"))) return { name: "npm", evidence: "package-lock.json" };
  return null;
}

/** Scripts worth telling an assistant about, grouped by what they are for. */
export function scripts(pkg, pm) {
  if (!pkg || !pkg.scripts) return [];
  const prefix = !pm || pm.name === "npm" ? "npm run" : pm.name;
  const kind = (n) =>
    /^(dev|start|serve)/.test(n) ? "run" :
    /^(build|compile|bundle)/.test(n) ? "build" :
    /^(test|spec|e2e)/.test(n) ? "test" :
    /^(lint|format|typecheck|type-check|tsc|check)/.test(n) ? "check" :
    /^(db|migrate|seed|prisma|drizzle)/.test(n) ? "database" :
    /^(deploy|release|publish)/.test(n) ? "deploy" : "other";
  return Object.entries(pkg.scripts).map(([name, cmd]) => ({
    name,
    command: `${prefix} ${name}`,
    raw: String(cmd),
    kind: kind(name),
  }));
}

/** Entry points, only where a file genuinely exists. */
export function entryPoints(root, pkg, files) {
  const out = [];
  const seen = new Set();
  const add = (p, why) => {
    const rel = p.replace(/\\/g, "/");
    if (seen.has(rel) || !existsSync(join(root, rel))) return;
    seen.add(rel);
    out.push({ path: rel, why });
  };
  if (pkg) {
    if (pkg.main) add(pkg.main, "package.json main");
    if (pkg.module) add(pkg.module, "package.json module");
    if (typeof pkg.bin === "string") add(pkg.bin, "package.json bin");
    else if (pkg.bin) for (const v of Object.values(pkg.bin)) add(v, "package.json bin");
  }
  for (const c of [
    "server.ts", "server.js", "index.ts", "index.js", "main.ts", "main.py",
    "app.py", "manage.py", "src/index.ts", "src/index.tsx", "src/main.ts",
    "src/main.tsx", "src/App.tsx", "src/app.ts", "cmd/main.go", "src/main.rs",
  ]) {
    add(c, "conventional entry point");
  }
  return out.slice(0, 8);
}

/** The directories that actually hold the code, by file count. */
export function layout(files, limit = 10) {
  const counts = new Map();
  for (const f of files) {
    const top = f.includes("/") ? f.slice(0, f.indexOf("/")) : "(root)";
    counts.set(top, (counts.get(top) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([k]) => k !== "(root)")
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path, files]) => ({ path, files }));
}

export function conventions(root, files, pkg) {
  const out = [];
  const say = (text, evidence) => out.push({ text, evidence });
  if (pkg && pkg.type === "module") say("ES modules, not CommonJS", 'package.json "type": "module"');
  if (existsSync(join(root, ".prettierrc")) || existsSync(join(root, ".prettierrc.json"))) {
    say("Formatting is Prettier's; do not hand-format", ".prettierrc");
  }
  if (existsSync(join(root, ".editorconfig"))) say("Indentation follows .editorconfig", ".editorconfig");
  const tsconfig = readJson(join(root, "tsconfig.json"));
  if (tsconfig && tsconfig.compilerOptions) {
    const co = tsconfig.compilerOptions;
    if (co.strict) say("TypeScript runs in strict mode", "tsconfig.json strict");
    if (co.paths) {
      const alias = Object.keys(co.paths)[0];
      say(`Path aliases are configured (e.g. ${alias})`, "tsconfig.json paths");
    }
  }
  const testDirs = ["test", "tests", "__tests__", "spec"].filter((d) => existsSync(join(root, d)));
  if (testDirs.length) say(`Tests live in ${testDirs.join(", ")}/`, "directory present");
  else if (files.some((f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f))) {
    say("Tests sit beside the code they cover (*.test.*)", "file naming");
  }
  if (existsSync(join(root, ".github/workflows"))) say("CI runs on GitHub Actions", ".github/workflows");
  return out;
}

export function git(root) {
  const run = (args) => {
    try {
      return execFileSync("git", ["-C", root, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  };
  if (!run(["rev-parse", "--git-dir"])) return null;
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
  const remote = run(["remote", "get-url", "origin"]);
  const subjects = run(["log", "-30", "--pretty=format:%s"]).split("\n").filter(Boolean);
  // Does this project use conventional commits? Worth knowing before writing one.
  const conventional = subjects.filter((s) => /^(feat|fix|chore|docs|refactor|test|perf|build|ci)(\(.+\))?!?:/.test(s));
  return {
    branch,
    remote: remote.replace(/^https:\/\/[^@]*@/, "https://"),
    commits: subjects.length,
    conventional: subjects.length ? Math.round((conventional.length / subjects.length) * 100) : 0,
    recent: subjects.slice(0, 5),
  };
}

export function envVars(root) {
  for (const f of [".env.example", ".env.sample", ".env.template"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    try {
      const names = readFileSync(p, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split("=")[0].trim())
        .filter(Boolean);
      // Names only. The values in a template are placeholders, but reading them
      // into a generated file is still not this tool's business.
      return { file: f, names: [...new Set(names)] };
    } catch {
      return null;
    }
  }
  return null;
}

export function docs(root, files) {
  const out = [];
  for (const f of files) {
    if (!/\.mdx?$/i.test(f)) continue;
    if (/^(node_modules|dist)\//.test(f)) continue;
    const name = basename(f).toLowerCase();
    if (name === "readme.md" || f.startsWith("docs/") || /contributing|architecture|deploy/i.test(name)) {
      out.push(f);
    }
  }
  return out.slice(0, 12);
}

export function analyse(root = process.cwd()) {
  const pkg = readJson(join(root, "package.json"));
  const { files, dirs, byExt, truncated } = walk(root);
  const pm = packageManager(root);
  return {
    root,
    name: (pkg && pkg.name) || basename(root),
    description: (pkg && pkg.description) || "",
    fileCount: files.length,
    truncated,
    languages: languages(byExt),
    stack: stack(root, pkg),
    packageManager: pm,
    scripts: scripts(pkg, pm),
    entryPoints: entryPoints(root, pkg, files),
    layout: layout(files),
    conventions: conventions(root, files, pkg),
    git: git(root),
    env: envVars(root),
    docs: docs(root, files),
    hasExisting: existsSync(join(root, "CLAUDE.md")),
  };
}

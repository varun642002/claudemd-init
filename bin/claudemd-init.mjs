#!/usr/bin/env node
// claudemd-init — write a CLAUDE.md from what is actually in the repository.
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyse } from "../lib/analyse.mjs";
import { render, summarise } from "../lib/render.mjs";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = "") => {
  const i = argv.indexOf(f);
  return i === -1 ? d : (argv[i + 1] ?? d);
};

if (has("--help") || has("-h")) {
  console.log(`claudemd-init — write a CLAUDE.md from what is in the repo

usage:
  claudemd-init              print it (nothing is written)
  claudemd-init --write      write CLAUDE.md
  claudemd-init --force      overwrite an existing CLAUDE.md
  claudemd-init --json       the raw analysis
  claudemd-init --evidence   annotate each claim with what proved it
  claudemd-init --dir PATH   analyse another directory

It only states what it observed. Nothing is inferred, so what it writes is a
starting point: add the reasons a tool cannot see.`);
  process.exit(0);
}

const root = val("--dir") || process.cwd();
if (!existsSync(root)) {
  console.error(`claudemd-init: no such directory: ${root}`);
  process.exit(2);
}

const a = analyse(root);

if (has("--json")) {
  console.log(JSON.stringify({ ...a, languages: a.languages, stack: a.stack }, null, 2));
  process.exit(0);
}

const text = render(a, { withEvidence: has("--evidence") });
if (!text.trim()) {
  console.error("claudemd-init: found nothing worth writing about — is this a project directory?");
  process.exit(2);
}

const target = join(root, "CLAUDE.md");

if (!has("--write")) {
  console.log(text);
  console.error(`\n(${summarise(a)}) — nothing written. Pass --write to create CLAUDE.md.`);
  process.exit(0);
}

if (existsSync(target) && !has("--force")) {
  const existing = readFileSync(target, "utf8");
  console.error(
    `claudemd-init: CLAUDE.md already exists (${existing.split("\n").length} lines).\n` +
      `Read it first — it may hold decisions this tool cannot see. Pass --force to replace it.`
  );
  process.exit(1);
}

writeFileSync(target, text, "utf8");
console.log(`wrote ${target}  (${summarise(a)})`);

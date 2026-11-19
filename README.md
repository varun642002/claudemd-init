<div align="center">

# 📝 claudemd-init

### A CLAUDE.md built from what's actually in your repo

*Most CLAUDE.md files are empty, stale, or confidently wrong. This one is only what's on disk.*

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-D97757)](https://claude.com/claude-code)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-26-success.svg)](test/smoke.mjs)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 😑 The problem

`CLAUDE.md` is the highest-leverage file in a repo for working with Claude Code,
and almost everyone's is either missing, three refactors out of date, or full of
plausible-sounding guesses.

The guesses are the worst kind. A wrong line in `CLAUDE.md` doesn't get
ignored — it gets believed.

## ✨ What it does

```bash
npx @varun642002/claudemd-init
```

Reads the tree and prints a draft:

```markdown
# demo-app

## What this is

- **Language:** TypeScript (90%), JavaScript (10%)
- **Stack:** React, Express, Vite, Tailwind CSS, Drizzle, Firebase Admin, Docker
- **Package manager:** npm — use it, not another one
- **Size:** 439 files

## Commands

**Run it**
- `npm run dev` — tsx server.ts

**Lint and types**
- `npm run lint` — tsc --noEmit

## Conventions

- ES modules, not CommonJS
- TypeScript runs in strict mode
- Path aliases are configured (e.g. @/*)
- Tests live in tests/
```

Then write it:

```bash
npx @varun642002/claudemd-init --write
```

🔒 Runs entirely locally.

## 🧠 The rule it follows

> [!IMPORTANT]
> **Every line is observed, never inferred.** It will not claim a project uses
> React unless `react` is in the dependencies. It will not list an entry point
> that doesn't exist on disk. It will not invent a "coding style" section.
> Run `--evidence` and each claim is annotated with what proved it.

What it leaves out is the point: *why* the awkward decisions were made, what's
deliberately not done, what to ask before touching. No tool can see that — so
it ends with a comment telling you to add it, rather than making something up.

## 🚀 Install

As a Claude Code plugin, which adds a `/claudemd` command:

```bash
claude plugin marketplace add varun642002/claudemd-init
```

```bash
claude plugin install claudemd-init@claudemd-init
```

`/claudemd` runs the analysis, then has Claude write the real file — reading any
existing `CLAUDE.md` first and keeping the human-written rules in it.

Or just use the CLI, with no install:

```bash
npx @varun642002/claudemd-init
```

## 🔍 What it detects

| | From |
|---|---|
| 🗣️ **Languages** | File extensions, ranked by share of code files |
| 🧰 **Stack** | Dependencies and marker files — each with its evidence |
| 📦 **Package manager** | The lockfile, so Claude doesn't run `npm` in a pnpm repo |
| ⌨️ **Commands** | `package.json` scripts, grouped: run / build / test / check / database / deploy |
| 🗂️ **Layout** | Top-level directories by file count |
| 🚪 **Entry points** | `main`, `bin`, and conventional files — only if they exist |
| 📏 **Conventions** | ESM vs CJS, `strict`, path aliases, Prettier, `.editorconfig`, test location, CI |
| 🌱 **Environment** | Variable **names** from `.env.example` — never values |
| 🔀 **Git** | Branch, remote, and whether commits are conventional (measured, last 30) |
| 📚 **Docs** | README, `docs/`, CONTRIBUTING, ARCHITECTURE |

Also supports Python, Go, Rust, Ruby, Java, PHP, Swift, C/C++, Vue, Svelte and
Elixir projects — it doesn't need `package.json` to be useful.

## 🎮 Options

| Flag | Effect |
|---|---|
| *(none)* | Print the draft; write nothing |
| `--write` | Create `CLAUDE.md` |
| `--force` | Replace an existing one |
| `--evidence` | Annotate every claim with what proved it |
| `--json` | The raw analysis |
| `--dir PATH` | Analyse another directory |

> [!NOTE]
> **It won't overwrite an existing `CLAUDE.md`** without `--force`, and it says
> how many lines it would have replaced. That file usually holds the one thing a
> tool can't regenerate: a human's reasons.

## ⚠️ Honest limits

- **It describes, it doesn't judge.** It will happily report that a project has
  285 files in `src/` without an opinion on whether that's sensible.
- **Dependencies ≠ usage.** `react` in `package.json` proves it's installed, not
  that it's used well, or at all.
- **Conventional-commit detection is a percentage**, measured over the last 30
  subjects. 58% is reported as "plain prose", which may be unfair to a repo
  mid-migration.
- **Large trees are capped** at 20,000 files and 8 levels; the output says
  `439+` when it stopped early.

## 🧭 Notes for anyone forking this

- **One walk, many questions.** The tree is traversed once into
  `{files, dirs, byExt}`; every later question reads that. Re-walking per
  feature is how these tools get slow on big repos.
- **Env files give up names only.** Values in a template are placeholders, but
  reading them into a generated file still isn't this tool's business.
- **Entry points are existence-checked.** `package.json` `main` routinely points
  at a path that was moved two refactors ago.
- **Empty in, empty out.** A directory with nothing recognisable produces no
  sections at all, not a skeleton of headings with nothing under them.

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). No dependencies, please.
New detection needs evidence attached and a test proving an empty project still
yields nothing.

- [ ] Monorepo awareness: per-workspace sections
- [ ] Read CI workflows for the commands that actually gate merges
- [ ] Notice the test framework, not just that tests exist
- [ ] A `--diff` mode: what changed since the CLAUDE.md was written

## 📄 License

[MIT](LICENSE)

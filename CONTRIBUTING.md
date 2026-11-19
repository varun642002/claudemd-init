# Contributing to claudemd-init

## The one rule

**Observe, never infer.** Every line this tool writes must be traceable to a
file on disk, and `--evidence` must be able to name it. A plausible guess in
CLAUDE.md is worse than a gap, because a gap gets filled by looking while a
guess gets believed.

If you cannot attach evidence to a claim, it does not belong in the output.

## Setup

```bash
git clone https://github.com/varun642002/claudemd-init && cd claudemd-init && node test/smoke.mjs
```

There is no build step. Tests build throwaway projects in a temp directory.

## Adding detection

`lib/analyse.mjs`. Attach evidence, and add two tests: one proving the hit, one
proving an empty project still produces nothing. "Empty in, empty out" is the
property that keeps the output trustworthy.

## Things to know

- **Walk once.** The tree is traversed a single time into `{files, dirs, byExt}`
  and every later question reads that structure. Re-walking per feature is how
  this gets slow on a large repository.
- **Existence-check paths.** `package.json` `main` often points somewhere that
  no longer exists; printing it as an entry point sends a reader nowhere.
- **Env files yield names only.** Never values, not even from a template.
- **Never clobber.** An existing CLAUDE.md holds the one thing this tool cannot
  regenerate — a human's reasons. `--force` is the only way past it.
- **Cleanup is best-effort.** Windows throws `EPERM` on a temp directory a child
  still holds; that must not fail the run.

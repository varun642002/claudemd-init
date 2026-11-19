---
description: Draft or refresh this project's CLAUDE.md from what is on disk
allowed-tools: Bash(node:*), Bash(npx:*), Read
argument-hint: [--force to replace an existing one]
---

Draft a CLAUDE.md for this project.

First look at what the repository actually contains:

!`npx -y @varun642002/claudemd-init --evidence $ARGUMENTS`

That output is observed fact — languages, scripts, entry points, conventions,
git habits — with the evidence for each claim in comments. It is a starting
point, not a finished file.

Now write the real CLAUDE.md:

1. If one already exists, read it first and keep anything it says that the
   analysis could not have known. Never discard a human-written rule.
2. Keep what is useful from the draft, drop sections that only restate what is
   obvious from a glance at the tree.
3. Add what a tool cannot see, asking the user if you are unsure: why awkward
   decisions were made, what is deliberately not done, which areas are
   sensitive, and what to check before changing them.
4. Cut anything you cannot support. A confident wrong line in CLAUDE.md is
   worse than a missing one, because it gets believed.

Then show the user what you changed and why.

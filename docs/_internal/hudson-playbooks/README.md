# Hudson playbooks

Recipes for recurring workflows Hudson (the agent) executes on this codebase. Each playbook is a checklist + path map for a kind of work that touches multiple surfaces — born from doing the work once, distilled so the next pass is faster and less improvised.

## When to write one

Add a playbook here when:
- A workflow touched 4+ surfaces (page route, asset gen, registry edit, doc, font copy, etc.) and the surface list is non-obvious
- The same kind of work is likely to come back (commissions, app registrations, asset exports, etc.)
- The recipe has gotchas worth recording (e.g. "iOS icons must be opaque", "ImageMagick can't render SVG `<text>` — use headless Chrome")

Don't write a playbook for:
- Single-file edits with obvious scope
- One-off scripts
- Things already documented in the code itself (intents, ports — those are derivable with `bun scripts/agent-snapshot.ts`)

## Format

Each playbook lives at `docs/hudson-playbooks/<workflow>.md`. Loose structure:

1. **When to use** — what kind of ask this playbook fits
2. **Surfaces touched** — which files/dirs/services this will modify
3. **Steps** — numbered checklist
4. **Gotchas** — known pitfalls and how to dodge them
5. **Acceptance** — what "done" looks like before reply
6. **Reference work** — links to past commissions that followed this pattern

## Current playbooks

- [`brand-commission.md`](./brand-commission.md) — narrative-studio or product-team brand explorations that need a live URL + format-ladder mark + app icon + wordmark lockup + rationale

## Related references

- `scripts/agent-snapshot.ts` — derive current app registry, ports, intents, and inter-app pipelines from code (the "what apps exist" question)
- `.coordination/commissions.md` — append-only log of commissions executed (the "what did I deliver" question)
- `CLAUDE.md` — durable project-wide rules (the "what conventions" question)

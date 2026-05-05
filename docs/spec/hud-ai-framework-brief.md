# HudAI — framework brief

## What

An AI inference wrapper for Hudson. Talkie and Scout already integrate Claude — they each rebuild SDK setup, streaming, tool use, prompt caching, error handling. HudAI factors that out into one primitive so apps consume a single, opinionated API across web + Apple.

## Where to harvest

These are working in production today. Treat them as the reference implementation, not greenfield design:

- `/Users/arach/dev/talkie` — Claude usage in transcription, dictation, compose, voice memos.
- `/Users/arach/dev/openscout` — Claude usage in agent flows.

Skim both, identify the common patterns, generalize them. The point is to not reinvent what these apps already proved out.

## Hard dependencies

- **HudVault** (Hudson Sprint 1, landing this week). API keys never live in app code; HudAI consumes them via HudVault.
  - iOS: `HudVault(service:).get("openai_key")` → `Data?`
  - Web: `hudVault.get("openai_key")` → `Promise<string | null>`
- **Prompt caching by default**. Long system prompts cache automatically. Project convention — don't make every app rediscover the `cache_control` envelope.

## What you ship

A design spec at `docs/spec/hud-ai-framework.md`. **Not implementation code.**

Cover at minimum:
- Public API surface for Swift (iOS/macOS) and TypeScript (web).
- Streaming model — your call (AsyncSequence, async iterators, callbacks). Justify briefly.
- Tool use envelope — typed, not stringly.
- HudVault integration — how credentials flow.
- Provider abstraction — Claude is primary; design so an OpenAI adapter is mechanical later, not a rewrite.
- Anything you couldn't decide cleanly — flag for human review.

## Out of scope

Voice/realtime, image gen, RAG, fine-tuning, agent loops. Each gets its own primitive if Hudson wants them.

## Constraints

- Web: bun, React 19, Next.js 16, Tailwind v4. No purple in designs (cyan/blue/teal/emerald).
- Apple: SwiftUI. iOS demo is HudLint-strict — no raw color/font/spacing literals; design tokens only.
- Commits: gitmoji, no co-author footers.

## Reply

When the spec is written, scout-reply with the file path and a ~150-word executive summary.

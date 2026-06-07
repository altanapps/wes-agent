# Roadmap

**North star:** an *all-living communication coach* — Wes learns your communication **wherever it happens** and coaches you on the spot. The compounding asset is a **voice model** of you, fed by every channel. Channel priority: **Slack → Email → Calls.** Full architecture: [`docs/all-living-coach.md`](docs/all-living-coach.md). Concrete capture mechanics: [`docs/capture-channels.md`](docs/capture-channels.md).

## Done

- [x] Character format (markdown) + runtime + CLI gateway
- [x] Telegram gateway — live as `@wes_agent_bot` (running locally for now)

## Main goal: learn your communication everywhere (in priority order)

- [ ] **1 — Slack capture.** User-token Slack app: backfill your sent messages + Events API for new ones → first cut of your **voice model** + after-send framework nudges. (Before-send via Accessibility = later.)
- [ ] **2 — Email capture.** Gmail API `SENT` backfill + `users.watch`/Pub/Sub → richest voice data. Ship **"BCC Wes"** for before-send coaching.
- [ ] **3 — Calls (Granola-style).** On-device mic + system-audio capture (no bot) → transcript → post-call coaching of your *spoken* delivery.

See [`docs/capture-channels.md`](docs/capture-channels.md) for the exact APIs, scopes, and the LEARN-vs-COACH split per channel.

## Supporting (enables the above)

- [ ] **Voice model** — one local store (cadence, tics, relationships), fed by every channel, injected into every rewrite. *This is the asset.*
- [ ] On-device **privacy/triage gate** (small local LLM via MLX/Ollama): redacts secrets/PII before anything reaches the cloud; decides what's worth coaching
- [ ] Private personalization profile (`WES_PROFILE_PATH`), polished
- [ ] Allow-list the Telegram bot (`TELEGRAM_ALLOWED_USER_IDS`) so it's just you

## Later layers

- [ ] Before-send interception — Slack desktop (Accessibility API) + Gmail add-on / browser extension
- [ ] Agentic loop — watch drafts, close the loop (did they reply? draft the nudge), auto-grow the swipe file ([`docs/agentic-loop.md`](docs/agentic-loop.md))
- [ ] "Coach this" global hotkey — select text anywhere → Wes critiques it (quick win, any-surface)

## Principles (for the always-on layers)

Local-first capture · opt-in per surface · redaction before egress · trigger-first by default · your data stays on your machine. See [`docs/all-living-coach.md`](docs/all-living-coach.md) § Privacy.

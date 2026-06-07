# Roadmap

**North star:** an *all-living communication coach* — Wes, always on, everywhere you communicate, coaching you on the spot and learning your voice over time. The Telegram bot is surface #1. Full research + architecture: [`docs/all-living-coach.md`](docs/all-living-coach.md).

## Now

- [x] Character format (markdown) + runtime + CLI gateway
- [x] Telegram gateway — live as `@wes_agent_bot` (running locally for now)
- [ ] **Phase 1 — "Coach this" global hotkey (next, recommended).** Mac menubar app: select any text anywhere → hotkey → Wes critiques it in a popover. Ubiquitous, opt-in, zero always-on-capture trust cost. The 80/20 toward on-the-spot coaching.

## Next

- [ ] Private personalization profile (`WES_PROFILE_PATH`), polished — make rewrites sound like *you*
- [ ] Allow-list the Telegram bot (`TELEGRAM_ALLOWED_USER_IDS`) so it's just you
- [ ] Durable memory (Redis/SQLite) + a persisted **voice model** (your cadence, tics, relationships)
- [ ] Email "BCC Wes" gateway (inbound-email webhook)
- [ ] Browser extension — coach in any web field, Grammarly-style (Phase 2)

## Later (the all-living layers)

- [ ] On-device **privacy/triage gate** (small local LLM via MLX/Ollama): decides what's worth coaching, redacts secrets/PII before anything reaches the cloud
- [ ] Ambient capture — Screenpipe / Accessibility API → proactive flagging of drafts that violate a framework (Phase 3)
- [ ] Agentic loop — watch drafts, close the loop (did they reply? draft the nudge), auto-grow the swipe file ([`docs/agentic-loop.md`](docs/agentic-loop.md))
- [ ] Voice coaching — spoken delivery in/after meetings (Phase 4)

## Principles (for the always-on layers)

Local-first capture · opt-in per surface · redaction before egress · trigger-first by default · your data stays on your machine. See [`docs/all-living-coach.md`](docs/all-living-coach.md) § Privacy.

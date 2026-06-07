# The all-living communication coach (research + north star)

The Telegram bot is one surface. The real vision: **Wes is always on, everywhere you communicate, coaching you on the spot** — before the email sends, before the Slack lands, before you say the thing in the meeting. She learns *your recurring weaknesses* and your relationships over time, so the coaching gets sharper and more personal the longer you use it — and she can tell you whether you're actually improving.

This doc is the researched path to get there, the honest tradeoffs, and the recommended first step. Sources at the bottom.

## The hard part isn't the AI — it's capture + trust

The coaching engine already works (that's `src/wes.ts`). Two things stand between "a bot you paste into" and "an all-living coach":

1. **Capture** — getting your outgoing communication *to* Wes without you copy-pasting.
2. **Trust** — an always-on thing that can read everything you write is terrifying unless the privacy model is right. Get this wrong and it's spyware; get it right and it's a coach.

Everything below is organized around those two.

## The four surfaces where you communicate

| Surface | Examples | Capture mechanism | Difficulty |
|---|---|---|---|
| **Web text fields** | Gmail, LinkedIn, Notion, Twitter/X, web Slack | Browser extension (Grammarly's model) | Medium |
| **Native Mac apps** | Mail.app, desktop Slack, Messages, Notes | macOS Accessibility API (TextWarden's model) | Medium-High |
| **Async / on-demand** | "here's a draft, fix it" | Telegram / CLI / email BCC (✅ partly built) | Low |
| **Spoken** | Zoom/Meet calls, rehearsing out loud | System-audio capture + STT | High |

You don't need all four. The highest-leverage two for a founder are **web fields** (where investor emails + posts happen) and **async** (already built). Native + voice come later.

## Architecture: a privacy gate in the middle

The naive version streams everything you type to the cloud. Don't build that. Put a cheap, **on-device triage gate** between capture and the cloud coach:

```
  CAPTURE                 PRIVACY GATE                COACH                 DELIVERY
  (per surface)           (on-device, local)          (cloud, on demand)    (in-context)

  browser ext      ┐                                                       ┌ inline pill
  accessibility    ├──▶  small local LLM       ──▶   Opus 4.8 (the real    ├ "before you
  email BCC        │     (MLX / Ollama):              rewrite, only for     │  send" nudge
  Telegram/CLI ✅  ┘     • is this a real,            messages that         └ Telegram reply
                         outgoing message?            cleared the gate)
                         • redact secrets/PII
                         • cheap first-pass score
                         • DROP everything else
```

- **The local gate is the trust spine.** A small on-device model (Llama/Qwen/Gemma via MLX or Ollama — now fast on Apple Silicon) decides *what's even worth coaching* and **redacts secrets/PII before anything leaves the machine**. Passwords, the 90% of typing that isn't an outgoing message, anything you didn't opt to share — never hits the cloud.
- **The cloud coach (Opus 4.8) only sees what cleared the gate** — and ideally only when you ask ("coach this") or right before send. This keeps cost down *and* keeps the privacy surface small.
- **The coaching profile** is the compounding asset: a running diagnosis of your *recurring weaknesses* (which frameworks you miss most, and whether you're improving) plus your relationships (this investor likes brevity; this cofounder needs the why). Stored locally, used to target coaching and track progress. This is what makes it *your* coach — it learns what you keep getting wrong, **not** how to mimic you. (Built: `src/learn/diagnostics.ts`.)

## Build vs. leverage

Don't build the capture layer from scratch — the category churns (Rewind and Limitless both died in Dec 2025). Leverage what exists:

- **Capture, native:** [Screenpipe](https://screenpi.pe/) is open-source, local-first, captures on-device screen text/audio — a ready substrate to read "what was just written" without rolling your own Accessibility plumbing. Or follow [TextWarden](https://github.com/PhilipSchmid/textwarden)'s direct Accessibility-API approach for text fields specifically.
- **Capture, web:** a Manifest-V3 browser extension (Grammarly's exact mechanism) — content script reads the focused field, shows an inline "Ask Wes" pill, sends only that field to the gate.
- **Capture, async:** Telegram/CLI (✅ built) + email "BCC Wes" (an inbound-email webhook — Postmark/SES).
- **Local model:** Ollama (now with an MLX backend) or MLX directly — small models are interactive on any M-series Mac.
- **The coach + coaching profile:** this repo. The character files and `Wes.respond()` are already the engine.

## Phasing (crawl → walk → run)

**Phase 0 — async, done.** Telegram + CLI. Paste-or-DM a draft, get a rewrite. *(shipped)*

**Phase 1 — "Coach this" hotkey (the cheapest real win).** A tiny Mac menubar app: select any text anywhere → global hotkey → Wes critiques it in a popover. No always-on capture, no privacy questions — *you* trigger it. Uses the Accessibility API only to read the current selection on demand. This is the 80/20: ubiquitous, opt-in, ships in days.

**Phase 2 — in-the-field, web.** Browser extension. Inline "Ask Wes" pill on any text field; optional "warn me before I send an investor email that buries the ask" (MOO/sales-then-logistics check on blur). Add the on-device gate here.

**Phase 3 — ambient + proactive.** Screenpipe/Accessibility stream → local gate → Wes proactively flags drafts that violate a framework, closes the loop (did they reply? draft the nudge), and auto-grows your swipe file. This is the agentic-loop phase (`agentic-loop.md`) wearing the always-on capture layer.

**Phase 4 — voice.** Coach your spoken delivery in/after meetings (she teaches verbal signposting too). Highest effort; do last.

## Privacy & trust stance (non-negotiable for an always-on thing)

- **Local-first capture.** Raw capture and the triage gate run on-device. The cloud sees only what cleared the gate.
- **Opt-in per surface and per app.** You choose which apps/sites Wes watches. Default off.
- **Redaction before egress.** The local gate strips secrets/PII before anything is sent to coach.
- **Trigger-first by default.** Phases 1–2 are *you*-triggered ("coach this"), not silent capture. Ambient (Phase 3) is opt-in on top.
- **Your data, your machine.** Coaching profile + memory stored locally; exportable; deletable. No selling the one thing that makes it valuable.

## Honest risks / tradeoffs

- **Creepiness vs. utility.** Always-on reading-everything is a hard sell even to yourself. Mitigation: lead with trigger-based (Phase 1), make ambient strictly opt-in.
- **Platform fragility.** Accessibility API has per-app quirks; browser extensions face MV3 limits; OS permission prompts add friction. Leverage Screenpipe/TextWarden rather than fight this solo.
- **Latency vs. quality.** Real-time inline coaching wants speed (local model); deep rewrites want Opus. The gate split handles both — local for "is this worth flagging," cloud for the actual rewrite.
- **Cost.** Streaming everything to Opus would be expensive; the local gate is also the cost gate.
- **Category is a graveyard.** Rewind and Limitless both shut down in Dec 2025. Don't bet the product on a capture vendor — keep capture pluggable (it already is: gateways).

## Recommended first step

**Build Phase 1: the "Coach this" global hotkey.** It's the cheapest path to *ubiquitous, opt-in, on-the-spot* coaching — select text anywhere on your Mac, hit a hotkey, Wes critiques it — with zero always-on-capture trust cost, reusing the engine that already works. Everything ambient is an additive layer on top of it.

---

### Sources
- [Screen Assistant AI in 2026 — Screenpipe](https://screenpipe.com/blog/screen-assistant-ai-2026) · [Rewind alternative, local-first](https://screenpi.pe/blog/rewind-ai-alternative-2026) — ambient capture landscape; Rewind/Limitless shutdowns; local-first model.
- [TextWarden (GitHub)](https://github.com/PhilipSchmid/textwarden) — on-device, Accessibility-API grammar/style coaching across all macOS apps. The closest existing analog.
- [Apple Accessibility API](https://developer.apple.com/accessibility/) · [reading text values system-wide](https://macdevelopers.wordpress.com/2014/01/31/accessing-text-value-from-any-system-wide-application-via-accessibility-api/) — the native-capture primitive.
- [Grammarly for Chrome](https://www.grammarly.com/browser/chrome) — the proven MV3 "coach in any web field, in real time" pattern.
- [Local LLMs on Apple Silicon 2026 (MLX guide)](https://codersera.com/blog/apple-silicon-llms-complete-guide-2026/) · [Ollama + MLX](https://www.sitepoint.com/definitive-guide-local-llms-2026-privacy-tools-hardware/) — on-device model feasibility for the privacy gate.

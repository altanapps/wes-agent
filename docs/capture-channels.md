# Capture channels — Slack, then Email, then Calls

The main goal: **Wes learns your communication wherever it happens.** This doc is the concrete "how" for the three priority channels, in order.

## The one distinction that organizes everything

Every channel has two jobs, and they're built differently:

- **LEARN (the data flywheel).** Ingest what you've already written → diagnose your **recurring weaknesses**: which frameworks you violate most, where, and whether you're improving over time. Mostly **read APIs, post-hoc, low-risk.** This is the compounding asset — a coach learns *what you keep getting wrong so it can target the fix*, **not** how to mimic your voice. (One draft can't reveal a pattern; a hundred can.)
- **COACH (the intervention).** Critique a message. *After-send* coaching is easy (you have the data; you flag it for next time, and you point at the recurring pattern). *Before-send* coaching is harder — APIs only see a message once it's posted, so real-time interception needs the desktop field (Accessibility) or a client plugin.

**Start with LEARN on every channel.** It's lower-risk, it's the flywheel, and after-send coaching ("you buried the ask again — that's your #1 recurring miss") is genuinely useful on its own. Layer before-send interception on later.

Everything below feeds one **coaching profile** — a running diagnosis of your recurring weaknesses + trajectory (built by `src/learn/diagnostics.ts`) — and passes through the on-device **privacy gate** from [`all-living-coach.md`](all-living-coach.md) (redact secrets/PII locally before anything reaches the cloud).

> Voice ≠ the asset. Rewrites should still *sound* like you (so you'll actually send them), but that's a small guardrail on output — not the thing worth learning. A coach's job is to move you off your bad habits, not reinforce them.

---

## 1. Slack (priority 1 — most modern comms lives here)

### Learn
A Slack app authorized with a **user token** (`xoxp-`) — it sees what *you* see and acts as you. Scopes: `channels:history`, `groups:history`, `im:history`, `mpim:history` (read message history across public/private channels, DMs, group DMs) + `users:read`.

- **Backfill:** `conversations.list` → `conversations.history`, filter to messages where `user == your_id`. That's your entire Slack writing corpus → coaching profile.
- **Stay current:** the **Events API** (`message` events) streams new messages in near-real-time. Capture your own the instant you send → after-send coaching + continuous diagnosis.

### Coach
- **After-send (ship first):** Events API catches what you just sent; Wes DMs you a tighter version when one violates a framework. You can't unsend, but you learn for next time — and most Slack messages aren't irreversible.
- **Before-send (later):** Slack has **no official compose-injection API**. Real before-send coaching means reading the desktop compose box via the macOS **Accessibility API** (TextWarden's approach), or a Slack **message shortcut** you trigger on a draft. Treat this as Phase 2.

### Caveats
A workspace admin may need to approve the app (your own workspace = you approve it). Enterprise Grid has org-level Audit Logs, but for an individual the **user-token + Events API** path is the one. Reads a lot → local privacy gate + per-channel opt-in are mandatory.

> Refs: [Slack tokens](https://docs.slack.dev/authentication/tokens/) · [scopes](https://docs.slack.dev/reference/scopes/) · [Conversations API](https://docs.slack.dev/apis/web-api/using-the-conversations-api/)

---

## 2. Email (priority 2 — the highest-stakes writing you do)

Your sent email is the richest diagnostic data you have: investor updates, cold outreach, fundraise notes — long-form, deliberate, consequential.

### Learn
**Gmail API**, read the **`SENT`** label:
- **Backfill:** `users.messages.list(labelIds=['SENT'])` → your authored email corpus. Higher signal-per-message than Slack.
- **Stay current:** `users.watch` + **Cloud Pub/Sub** push on new mail (filter to SENT), then `users.history.list` from the pushed `historyId` to fetch the actual message. (Re-call `watch` daily — it expires after 7 days.) Scope: `gmail.readonly` is enough to learn.

### Coach
- **BCC Wes (ship first):** BCC a dedicated address on any draft → Wes replies with the rewrite. Works in any client, on your phone, zero plugin. The cheapest real before-send coaching.
- **Gmail Add-on / browser extension:** compose-time trigger inside Gmail — coach right in the compose window before you hit send. More work, tighter loop.

> Refs: [Gmail push via Pub/Sub](https://developers.google.com/workspace/gmail/api/guides/push) · [users.watch](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch)

---

## 3. Calls (priority 3 — Granola-style, understand comms wherever it happens)

### Mechanism (how Granola does it — copy this)
A **native Mac app captures mic + system audio directly on-device** — it does **not** join the meeting as a bot, so nothing appears in the participant list and no "recording" banner fires. Diarize cheaply by *source*: **your mic = you**, **system audio = them**. Transcribe (on-device Whisper for privacy, or a cloud STT). Store the **transcript, not the audio** (Granola deletes audio after the session).

### Coach
Post-call analysis of **your** speaking, through Wes's lens: did you signpost verbally? bury the ask? ramble (she teaches conciseness as density, out loud too)? filler-word rate? This is a genuinely new coaching surface — Wes teaches *verbal* communication too, not just writing. Real-time in-ear coaching is the far edge; do post-call first.

### Privacy
On-device STT keeps audio local; transcript-only storage; per-call opt-in (and respect consent norms — capturing others' audio has legal/etiquette constraints by jurisdiction).

> Refs: [Granola transcription](https://docs.granola.ai/help-center/taking-notes/transcription) — direct device-audio capture, no bot, transcript-only.

---

## Why this order

Slack and email are where your *written* communication actually happens, and both have clean read-APIs that make the LEARN flywheel cheap and low-risk — so you get a personalized coaching profile fast. Calls add a whole new (spoken) modality and need audio capture + STT + consent handling, so they're the third iteration, not the first.

## Suggested build sequence

1. **Slack LEARN** — user-token app, backfill + Events API → first cut of your coaching profile. After-send framework nudges.
2. **Email LEARN + BCC coach** — Gmail SENT backfill + Pub/Sub; ship "BCC Wes" for before-send.
3. **Coaching profile, unified** — one store of your recurring weaknesses + trajectory, fed by every channel; the thing that makes coaching *yours*.
4. **Before-send interception** — Accessibility (Slack desktop) + Gmail add-on / browser extension.
5. **Calls** — Granola-style on-device capture → post-call verbal coaching.

Each step passes through the on-device privacy gate. The coaching profile is the asset; everything else is plumbing to feed it.

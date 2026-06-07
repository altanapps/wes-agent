# Wes — a communication coach you can talk to

Talk to **Wes**, an executive-communication coach modeled on [Wes Kao](https://newsletter.weskao.com/) (Maven, altMBA), over Telegram or your terminal. Paste a draft — investor update, cold email, hard feedback, Slack message — and Wes diagnoses it against her frameworks and rewrites it **in your voice**. Or ask her to coach you through a conversation you're prepping for.

It's also a **template for turning any podcast persona into a character-agent**: the character is pure markdown, the runtime is thin, the gateways are pluggable.

```
you ▸ here's a draft investor update, make it sharper: "Hey everyone, hope
      you're well! Wanted to send our monthly update. Mixed bag this month..."

Wes ▸ Diagnosis:
      • Sales-then-logistics: you open with "mixed bag," not the headline.
      • Buried punchline: the ask (intros for the raise) is in the last line.
      • Accurate confidence: "mixed bag" undersells a net-positive month.

      Rewrite: ...
```

## What it does

- **Rewrite mode** — paste a draft → diagnosis (framework-tagged) → rewrite in your voice → what-changed-and-why. You learn the lesson, not just get the fix.
- **Advise mode** — "how do I tell my cofounder X without it blowing up?" → coaching grounded in named frameworks (sales-then-logistics, MOO, strategy-not-self-expression, signposting, accurate confidence, managing up).
- **Scoring** — "score this" → 6-dimension rubric out of 30.

## Quickstart

```bash
git clone <your-fork> wes-agent && cd wes-agent
npm install
cp .env.example .env          # add your ANTHROPIC_API_KEY

# Talk in the terminal (no other setup):
npm run dev:cli

# Or run the Telegram bot (add TELEGRAM_BOT_TOKEN from @BotFather first):
npm run dev:telegram
```

### Make rewrites sound like *you* (optional)

Point `WES_PROFILE_PATH` at a gitignored markdown file describing your voice, your context, and who you write to. Wes injects it into her system prompt so rewrites match your cadence instead of a generic "good founder" voice.

```bash
# .env
WES_PROFILE_PATH=./personal/profile.md   # gitignored — your private context
```

## How it's built

Three decoupled layers (full detail in [`docs/architecture.md`](docs/architecture.md)):

- **Character** — [`characters/wes/`](characters/wes/), pure markdown (persona + frameworks + rewrite protocol). Swap the directory to swap the character.
- **Runtime** — [`src/wes.ts`](src/wes.ts), a thin wrapper over the Anthropic Messages API (`claude-opus-4-8`, adaptive thinking) with per-conversation memory.
- **Gateways** — [`src/gateways/`](src/gateways/), pluggable front doors (CLI + Telegram today; email, Slack, browser extension on the roadmap in [`docs/gateways.md`](docs/gateways.md)).

> **Built on the Messages API, by design.** Wes-as-coach is conversational, so the documented `@anthropic-ai/sdk` Messages API is the right substrate. The character layer is kept SDK-agnostic so the [agentic-loop phase](docs/agentic-loop.md) (tools, autonomy, watching your inbox) can adopt the Claude Agent SDK / Managed Agents without rewriting the persona.

## Make your own character

```bash
cp -r characters/wes characters/<name>
# rewrite character.md (persona) + frameworks.md (their knowledge)
CHARACTER=<name> npm run dev:cli
```

## Roadmap

- [x] Character format + CLI + Telegram (reactive coach)
- [ ] Private personalization profile, polished
- [ ] Durable memory (Redis/SQLite) + cross-session voice model
- [ ] More gateways: email "BCC Wes", Slack app, browser extension ([`docs/gateways.md`](docs/gateways.md))
- [ ] Agentic loop: watch drafts, close the loop, run meeting prep ([`docs/agentic-loop.md`](docs/agentic-loop.md))

## Disclaimer

An homage and study tool built from public material (Wes Kao's podcast appearances and newsletter). Not affiliated with, endorsed by, or impersonating Wes Kao. For the real thing, read [her newsletter](https://newsletter.weskao.com/) and take [her course](https://maven.com/wes-kao/executive-communication-influence).

MIT licensed.

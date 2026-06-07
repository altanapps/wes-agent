# Wes — a communication coach you can talk to

Talk to **Wes**, an executive-communication coach modeled on [Wes Kao](https://newsletter.weskao.com/) (Maven, altMBA), over Telegram or your terminal. Paste a draft — investor update, cold email, hard feedback, Slack message — and Wes diagnoses it against her frameworks and rewrites it **in your voice**. Or ask her to coach you through a conversation you're prepping for.

It's also a **template for turning any podcast persona into a character-agent**: the character is pure markdown, the runtime is thin, the gateways are pluggable.

> **The north star** ([`VISION.md`](VISION.md)): not a paste-in bot — a *living coach* that learns your recurring weaknesses from everywhere you communicate (Slack → email → calls) and proves whether you're improving. The bot is surface #1.

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

### Learn your recurring weaknesses (the coaching profile)

A coach's real value isn't mimicking how you write — it's spotting what you *keep getting wrong* and tracking whether you improve. Feed `learn` a corpus of your sent messages (from any channel) and it diagnoses your recurring patterns against Wes's frameworks. The result is auto-loaded so Wes targets your actual habits ("you buried the ask again — your #1 miss").

```bash
npm run learn -- examples/sample-corpus.json   # → writes .coach/profile.md
npm run dev:cli                                 # Wes now coaches your patterns
```

The corpus is a JSON array of `{text, channel, date, audience}` (or blank-line-separated text). Channel feeders — Slack → Email → Calls — produce it ([`docs/capture-channels.md`](docs/capture-channels.md)); the diagnosis is channel-agnostic. One draft can't show a pattern; a hundred can.

### Make rewrites sound like *you* (optional)

Separately, point `WES_PROFILE_PATH` at a gitignored markdown file describing your context and who you write to. This is a small *output* guardrail so rewrites read as a sharper you — not the thing worth learning (that's the coaching profile above).

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

Full roadmap in [`ROADMAP.md`](ROADMAP.md). North star: an **all-living communication coach** — always on, everywhere you communicate, learning your *recurring weaknesses* and coaching them on the spot ([`docs/all-living-coach.md`](docs/all-living-coach.md)).

- [x] Character format + CLI + Telegram (reactive coach)
- [x] Coaching-profile engine — diagnose recurring weaknesses from a corpus of your messages (`npm run learn`)
- [ ] **Next:** channel feeders — Slack → Email → Calls ([`docs/capture-channels.md`](docs/capture-channels.md)) to make the diagnosis continuous
- [ ] More gateways ([`docs/gateways.md`](docs/gateways.md)) · agentic loop ([`docs/agentic-loop.md`](docs/agentic-loop.md))

## Disclaimer

An homage and study tool built from public material (Wes Kao's podcast appearances and newsletter). Not affiliated with, endorsed by, or impersonating Wes Kao. For the real thing, read [her newsletter](https://newsletter.weskao.com/) and take [her course](https://maven.com/wes-kao/executive-communication-influence).

MIT licensed.

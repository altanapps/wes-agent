# Wes — a communication coach you can talk to

Talk to **Wes**, an executive-communication coach modeled on [Wes Kao](https://newsletter.weskao.com/) (Maven, altMBA) — in a **macOS desktop app**, over Telegram, or in your terminal. Paste a draft — investor update, cold email, hard feedback, Slack message — and Wes diagnoses it against her frameworks and rewrites it **in your voice**. Or ask her to coach you through a conversation you're prepping for.

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
npm run learn -- examples/sample-corpus.json   # one-shot: diagnose a file → .coach/profile.md
npm run learn:slack                            # pull your sent Slack messages (SLACK_USER_TOKEN)
npm run learn:granola                          # pull your spoken turns from Granola meetings (GRANOLA_API_KEY)
npm run learn:import -- <file>                 # append any exported corpus (e.g. an email dump)
npm run learn:refresh                          # re-diagnose everything already stored
npm run dev:cli                                # Wes now coaches your patterns
```

The corpus is a JSON array of `{text, channel, date, audience}` (or blank-line-separated text), accumulated in `.coach/corpus.jsonl` with per-source cursors so scheduled runs stay incremental. The diagnosis is channel-agnostic ([`docs/capture-channels.md`](docs/capture-channels.md)) — one draft can't show a pattern; a hundred can.

**The Granola feeder** deserves a note: if [Granola](https://granola.ai) already records your meetings, `learn:granola` imports only *your* spoken turns (Granola's transcripts are diarized by source — microphone = you), so Wes coaches your verbal habits with zero extra recording. Needs a Granola Business-plan API key (Granola → Settings → Connectors → API keys).

### Make rewrites sound like *you* (optional)

Separately, point `WES_PROFILE_PATH` at a gitignored markdown file describing your context and who you write to. This is a small *output* guardrail so rewrites read as a sharper you — not the thing worth learning (that's the coaching profile above).

```bash
# .env
WES_PROFILE_PATH=./personal/profile.md   # gitignored — your private context
```

## The desktop app

The Granola-shaped surface from the vision: a macOS menubar app that records your calls
(mic = you, system audio = them — no meeting bot), transcribes locally with whisper.cpp,
and coaches your *spoken* communication after each call — filler words, pace, talk ratio,
buried asks, signposting — feeding the same coaching profile.

**Working today:**

- Menubar app (Electron 43, sidebar shell: **Coach / Calls / Settings**) with the full Wes
  chat wired to `@wes/core`; data lives in `~/Library/Application Support/Wes/`.
- Settings with **keychain-encrypted keys** (Anthropic + Granola via Electron `safeStorage`)
  and one-click **"Import calls from Granola"**.
- **Two-lane capture self-check** (Calls tab): records mic + system-loopback audio
  (CoreAudio tap, macOS 14.2+) to per-lane WAVs so you can verify diarization-by-source
  on your machine — the go/no-go gate for native call recording.
- **A packaged, branded `Wes.app`** (`npm run package -w @wes/desktop` →
  `apps/desktop/release/mac-arm64/`): bundle id `tech.nuff.wes`, the [brand icon](brand/),
  mic/system-audio usage strings — so macOS permission panes show *Wes*, not Electron.

**In progress** (see the plan in `docs/` and `ROADMAP.md`): whisper.cpp transcription in a
utility process, call sessions with transcripts + deterministic speech metrics, and Wes's
per-call review. Audio stays on-device and is deleted after transcription; only transcripts
go to the Anthropic API.

```bash
npm run dev:desktop                # run in dev (HMR)
npm run package -w @wes/desktop    # build the branded Wes.app
```

## Brand & site

The identity — a waveform resolving into a rising tick (your voice, coached upward), moss
green on paper — lives in [`brand/`](brand/) (SVG mark, macOS `.icns`, renders). The landing
page carrying the same identity is [`site/index.html`](site/index.html), self-contained and
ready for any static host.

## How it's built

An npm-workspaces monorepo, three decoupled layers (full detail in [`docs/architecture.md`](docs/architecture.md)):

- **Character** — [`packages/core/characters/wes/`](packages/core/characters/wes/), pure markdown (persona + frameworks + rewrite protocol). Swap the directory to swap the character.
- **Runtime** — [`packages/core/`](packages/core/) (`@wes/core`), host-agnostic: the coach (a thin wrapper over the Anthropic Messages API, `claude-opus-4-8`, adaptive thinking, per-conversation memory), the LEARN pipeline, and the channel sources. No Electron, no env reads — hosts inject a `CoachConfig`.
- **Hosts / gateways** — [`apps/cli/`](apps/cli/) (terminal + Telegram + LEARN jobs, `.env` + `.coach/`) and [`apps/desktop/`](apps/desktop/) (Electron menubar app, userData + keychain).

> **Built on the Messages API, by design.** Wes-as-coach is conversational, so the documented `@anthropic-ai/sdk` Messages API is the right substrate. The character layer is kept SDK-agnostic so the [agentic-loop phase](docs/agentic-loop.md) (tools, autonomy, watching your inbox) can adopt the Claude Agent SDK / Managed Agents without rewriting the persona.

## Make your own character

```bash
cp -r packages/core/characters/wes packages/core/characters/<name>
# rewrite character.md (persona) + frameworks.md (their knowledge)
CHARACTER=<name> npm run dev:cli
```

## Roadmap

Full roadmap in [`ROADMAP.md`](ROADMAP.md). North star: an **all-living communication coach** — always on, everywhere you communicate, learning your *recurring weaknesses* and coaching them on the spot ([`docs/all-living-coach.md`](docs/all-living-coach.md)).

- [x] Character format + CLI + Telegram (reactive coach)
- [x] Coaching-profile engine — diagnose recurring weaknesses from a corpus of your messages (`npm run learn`)
- [x] Channel feeders: Slack (`learn:slack`), calls via Granola (`learn:granola`), any export (`learn:import`)
- [x] Desktop app shell — monorepo, branded `Wes.app`, keychain settings, capture self-check, brand + landing page
- [ ] **Next:** native call pipeline — whisper.cpp transcription, speech metrics, per-call Wes review
- [ ] Gmail feeder with its own OAuth (today: one-time export via `learn:import`)
- [ ] Camera/on-camera presence (local signals only) · before-send writing coach · agentic loop ([`docs/agentic-loop.md`](docs/agentic-loop.md))

## Disclaimer

An homage and study tool built from public material (Wes Kao's podcast appearances and newsletter). Not affiliated with, endorsed by, or impersonating Wes Kao. For the real thing, read [her newsletter](https://newsletter.weskao.com/) and take [her course](https://maven.com/wes-kao/executive-communication-influence).

MIT licensed.

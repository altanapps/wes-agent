# Slack setup (2 minutes)

The Slack feeder reads **your own sent messages** so the coach can diagnose your real Slack communication. It uses a **user token** (`xoxp-`) — which sees what *you* see — not a bot token. Everything runs locally; messages are stored under `.coach/` (gitignored) and only pass to the model when the diagnosis runs.

## 1. Create a Slack app

1. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**.
2. Name it (e.g. "Wes Coach") and pick your workspace.

## 2. Add user-token read scopes

Left sidebar → **OAuth & Permissions** → scroll to **User Token Scopes** (the lower section — *not* Bot Token Scopes) → **Add an OAuth Scope** for each:

| Scope | Why |
|---|---|
| `channels:history` | read your messages in public channels |
| `groups:history` | …in private channels |
| `im:history` | …in DMs |
| `mpim:history` | …in group DMs |
| `users:read` | resolve your own user id |

> These are all **read** scopes. The app cannot post or change anything.

## 3. Install and grab the token

1. Top of **OAuth & Permissions** → **Install to Workspace** → **Allow**.
2. Copy the **User OAuth Token** — it starts with **`xoxp-`**.
3. Put it in your `.env`:

```bash
SLACK_USER_TOKEN=xoxp-...
```

## 4. Run it

```bash
npm run learn:slack
```

What happens:
- pulls your sent messages from the channels/DMs you're in (incrementally — it remembers where it left off via `.coach/slack.cursor`),
- appends them to your local corpus (`.coach/corpus.jsonl`),
- regenerates your coaching profile (`.coach/profile.md`),
- which the coach auto-loads, so `npm run dev:cli` / the Telegram bot now coach *your* real patterns.

## 5. "Periodically give me updates"

Run `npm run learn:slack` on a schedule — e.g. a daily cron:

```cron
0 9 * * *  cd /path/to/wes-agent && npm run learn:slack >> .coach/slack.log 2>&1
```

Each run ingests what's new and refreshes the diagnosis, so the profile (and its trajectory — "are you improving?") stays current.

## Notes & limits

- **First run** can be slow if you're in many channels (it walks each one). Subsequent runs are incremental and fast.
- **Workspace approval:** on your own workspace you approve the app yourself. On an org-managed workspace an admin may need to allow it.
- **Before-send warning is not here.** Slack has no compose-injection API, so warning you *before* you hit send needs the macOS Accessibility API (a separate native piece) — see [`all-living-coach.md`](all-living-coach.md). This feeder is the LEARN job: capture-after-send + periodic coaching.
- **Privacy:** the token is read-only; the corpus and profile stay in `.coach/` (gitignored); nothing is sent anywhere except the diagnosis call to the model. A local redaction/triage gate is on the roadmap for the always-on layers.

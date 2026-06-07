# The agentic-loop direction (component iii — future, not built yet)

Today Wes is **reactive**: you send a message, she replies. The next evolution is **agentic**: Wes acts on your behalf across time and tools, with a loop that plans, uses tools, and follows up. Captured here so we don't lose the thread — this is a design note, not current behavior.

## What "agentic Wes" would do

1. **Watch your actual comms surface.** With permission, read drafts from Gmail / Slack / Notion before they go out, and proactively flag the ones that violate a framework ("this investor update buries the ask — want a rewrite?").
2. **Close the loop, not just the message.** After you send a rewritten note, follow up: did they reply? If not, draft the nudge. Track which framing got the enthusiastic yes and feed it into your swipe file automatically.
3. **Run multi-step prep.** "I have a board meeting Thursday" → Wes pulls last quarter's update, drafts the narrative (sales-then-logistics), runs a MOO pre-mortem against likely board objections, and rehearses the three hardest questions with you.
4. **Maintain a living model of you.** Persist your voice, your recurring weaknesses, your relationships (this investor likes brevity; this cofounder needs the why), and personalize every rewrite from it.

## How it maps onto Anthropic primitives

The character files stay exactly as they are. Only the runtime changes — the `Wes` class internals get replaced by a tool-using loop. Two viable paths:

- **Claude Agent SDK** (`query()`): runs the agent loop in-process, can load skills/subagents and call tools/MCP. Good when you host the compute and want the persona-as-markdown + tools model.
- **Managed Agents** (server-side sessions): Anthropic runs the loop and a per-session container; you create one persisted Agent (model + system prompt + tools), then open sessions. Good for durable, long-running, multi-tool agents with built-in memory and an event stream. The character's `character.md` becomes the agent's `system`; `frameworks.md` / `rewrite-protocol.md` become **Skills** (progressive disclosure — loaded only when relevant).

### Tools agentic Wes would want

| Tool | Purpose | Gating |
|---|---|---|
| `read_draft` (Gmail/Slack/Notion MCP) | pull a draft to critique | read-only, safe |
| `send_message` | send the rewrite | **always-ask** — hard to reverse |
| `save_to_swipe_file` | log a framing that worked | safe |
| `recall_profile` / memory tool | personalize from your voice + relationships | safe |
| `schedule_followup` | nudge if no reply by date | confirm |

The `send_message` tool is the one that must be gated behind explicit confirmation (irreversible, outward-facing). Everything else can run automatically.

## The loop, sketched

```
trigger (cron, webhook, or you)            // "draft ready" / "meeting Thursday" / "/coach"
  → gather context (read draft, recall your profile + the recipient)
  → diagnose against frameworks
  → act: rewrite / prep / pre-mortem
  → propose (never auto-send outward) → you approve
  → close the loop: did it land? log what worked → update your model
```

## Why it's phase 2, not phase 1

The reactive coach is the thing worth getting right first — the frameworks, the voice, the rewrite quality. Tools and autonomy multiply a *working* coach; they can't rescue a mediocre one. Ship reactive, validate the rewrites feel like you, then add the loop.

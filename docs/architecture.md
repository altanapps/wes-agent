# Architecture

Three layers, deliberately decoupled so each can change without the others.

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  GATEWAYS   │   │   RUNTIME   │   │  CHARACTER  │
│ how you talk│──▶│ the engine  │──▶│  who it is  │
│ to Wes      │   │             │   │             │
│ • CLI       │   │ Wes class   │   │ characters/ │
│ • Telegram  │   │ + memory    │   │   wes/*.md  │
│ • (HTTP…)   │   │ + Anthropic │   │ (portable)  │
└─────────────┘   └─────────────┘   └─────────────┘
                         │
                  (+ optional private
                   personalization file)
```

## 1. Character (`characters/<name>/`)

Pure markdown, no code. `character.md` is the persona; `frameworks.md` and `rewrite-protocol.md` are reference material. `src/character.ts` concatenates them into one system prompt. **This is the asset.** It's SDK-agnostic and model-agnostic — the whole reason a podcast persona can become an agent here.

Swap the directory → swap the character. That's the generalization path: Wes today, any persona tomorrow.

## 2. Runtime (`src/wes.ts`, `src/memory.ts`)

`Wes.respond(conversationId, message)` is the one method every gateway calls. It:
1. loads the character system prompt (once, at construction),
2. appends the message to that conversation's history (`ConversationStore`),
3. calls the Anthropic Messages API (`claude-opus-4-8`, adaptive thinking, `effort` from env),
4. stores and returns the reply.

Memory is in-process and bounded to the last N turns. It resets on restart — fine for the MVP. See *Evolving the runtime* below.

### Why the Messages API (and not the Agent SDK yet)

Wes-as-coach is conversational: it reads a draft and replies. It needs no filesystem, no tool loop, no sandbox — so the documented `@anthropic-ai/sdk` Messages API is the correct, reliable substrate (it's what the Agent SDK wraps). The character layer is kept SDK-agnostic on purpose: when we add tools and autonomy (see `agentic-loop.md`), we swap the `Wes` class internals for the Claude Agent SDK / Managed Agents and the persona files don't change.

## 3. Gateways (`src/gateways/`)

Thin adapters that turn an inbound message into `Wes.respond()` and send the reply back. Adding a gateway never touches the runtime or character. See `gateways.md` for the roadmap.

## Optional: private personalization

`WES_PROFILE_PATH` points at a gitignored markdown file describing *you* — your voice, your context, who you write to. It's appended to the system prompt so rewrites sound like you, not generic. This keeps the public repo free of anyone's private profile while still supporting a personalized coach.

## Evolving the runtime

| Need | Change |
|---|---|
| Memory survives restarts | Swap `ConversationStore` for Redis/SQLite, keyed by conversation id |
| Long threads exceed context | Enable Messages API compaction (`context_management`) |
| Cross-session memory ("remember my voice") | Add the Claude memory tool, or persist a per-user profile the gateway loads |
| Tools / autonomy | Adopt the Claude Agent SDK or Managed Agents — see `agentic-loop.md` |
| Streaming replies | Use `client.messages.stream()` and edit the gateway's message as tokens arrive |

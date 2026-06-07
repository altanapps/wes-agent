# Gateways (component iv — where you talk to Wes)

A gateway turns an inbound message into `Wes.respond()` and sends the reply back. Adding one never touches the runtime or the character. Telegram is the primary front door; here's the full ideation.

## Built

| Gateway | Status | Why it's good |
|---|---|---|
| **CLI** | ✅ shipped | Zero setup, test the character instantly, dogfood while iterating. |
| **Telegram** | ✅ shipped | Always in your pocket, no app to build, group-chat capable, dead-simple bot API. The right default for "talk to Wes anywhere." |

## High-value next

| Gateway | Why it's interesting | Effort |
|---|---|---|
| **Email / "BCC Wes"** | The most natural fit. BCC `wes@yourdomain` on any draft → she replies with the rewrite. Wes lives *where the writing already happens* (investor updates, cold emails). No context switch. | Medium (inbound email webhook — Postmark/SES) |
| **Slack app** | Where work writing happens. `/wes` slash command on any message, or DM her a draft. Team-shareable — one Wes for the whole company. | Medium |
| **Browser extension** | Highlight any text in Gmail/LinkedIn/Notion → "Ask Wes." Catches the draft *in situ*, one click, no copy-paste. Highest "in the flow of work" score. | Medium-High |
| **Superhuman / email-client handoff** | Rewrite → open straight in a compose window, ready to send. Closes the loop from critique to sent. | Low (if a compose-deeplink exists) |
| **Voice (phone / WhatsApp voice note)** | Rehearse a hard conversation out loud; Wes coaches your *spoken* delivery (she teaches verbal signposting too). Send a voice note, get spoken feedback. | High (STT/TTS) |
| **Raw HTTP / webhook** | The universal adapter — lets any tool (Zapier, a form, another app) post a draft and get a rewrite. Turns Wes into infrastructure. | Low |

## Design principle

The best gateway meets the writing **where it already happens** and removes the copy-paste step. Ranked by that test: email BCC and the browser extension win, because the draft never leaves its native surface. Telegram wins on *immediacy and zero-build*, which is why it's first.

## How to add one

1. Create `src/gateways/<name>.ts` exporting `async function run<Name>()`.
2. On each inbound message: derive a stable `conversationId`, call `wes.respond(conversationId, text)`, send the reply (chunk if the surface has a length limit).
3. Register it in `src/index.ts`'s `gateways` map.

That's the whole contract. The runtime and character don't change.

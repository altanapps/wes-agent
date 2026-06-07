import Anthropic from "@anthropic-ai/sdk";
import { config, requireAnthropicKey } from "./config.js";
import { loadCharacter } from "./character.js";
import { ConversationStore } from "./memory.js";

/**
 * The coach. Wraps the Anthropic Messages API with a character system prompt
 * and per-conversation memory. Gateway-agnostic: Telegram, CLI, HTTP all call
 * `respond()`.
 *
 * Built on the documented Messages API (@anthropic-ai/sdk). The character layer
 * is deliberately SDK-agnostic, so the agentic-loop phase (see docs/agentic-loop.md)
 * can swap this class for the Claude Agent SDK / Managed Agents without touching
 * the persona.
 */
export class Wes {
  private readonly client: Anthropic;
  private readonly systemPrompt: string;
  readonly name: string;
  private readonly store = new ConversationStore();

  constructor() {
    requireAnthropicKey();
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    const character = loadCharacter();
    this.name = character.name;
    this.systemPrompt = character.systemPrompt;
  }

  /** Send a user message in a conversation, get Wes's reply. Updates memory. */
  async respond(conversationId: string, userMessage: string): Promise<string> {
    if (userMessage.trim() === "/reset") {
      this.store.reset(conversationId);
      return "Cleared. Fresh start — paste a draft, or tell me the conversation you're prepping for.";
    }

    const messages = this.store.append(conversationId, "user", userMessage);

    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: this.systemPrompt,
      thinking: { type: "adaptive" },
      output_config: { effort: config.effort },
      messages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const reply = text || "(no response — try rephrasing)";
    this.store.append(conversationId, "assistant", reply);
    return reply;
  }
}

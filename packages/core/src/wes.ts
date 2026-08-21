import Anthropic from "@anthropic-ai/sdk";
import {
  type CoachConfig,
  requireAnthropicKey,
  anthropicClientOptions,
  thinkingParams,
} from "./config.js";
import { loadCharacter } from "./character.js";
import { type ConversationStore, InMemoryConversationStore } from "./memory.js";

/**
 * The coach. Wraps the Anthropic Messages API with a character system prompt
 * and per-conversation memory. Gateway-agnostic: Telegram, CLI, desktop all
 * call `respond()`.
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

  constructor(
    private readonly config: CoachConfig,
    private readonly store: ConversationStore = new InMemoryConversationStore(),
  ) {
    requireAnthropicKey(config);
    this.client = new Anthropic(anthropicClientOptions(config));
    const character = loadCharacter(config);
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
      model: this.config.model,
      max_tokens: 4096,
      system: this.systemPrompt,
      ...thinkingParams(this.config),
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

import type Anthropic from "@anthropic-ai/sdk";

type Turn = Anthropic.MessageParam;

/**
 * Per-conversation history, keyed by an opaque id (Telegram chat id, CLI session,
 * etc). In-memory only — resets on restart. For durable memory, see
 * docs/architecture.md (swap this for a KV store or the Claude memory tool).
 */
export class ConversationStore {
  private readonly turns = new Map<string, Turn[]>();
  constructor(private readonly maxTurns = 40) {}

  get(id: string): Turn[] {
    return this.turns.get(id) ?? [];
  }

  append(id: string, role: "user" | "assistant", content: string): Turn[] {
    const history = this.get(id);
    history.push({ role, content });
    // Keep the last N turns so context stays bounded and the prompt stays cheap.
    const trimmed = history.slice(-this.maxTurns);
    this.turns.set(id, trimmed);
    return trimmed;
  }

  reset(id: string): void {
    this.turns.delete(id);
  }
}

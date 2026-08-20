import type Anthropic from "@anthropic-ai/sdk";

export type Turn = Anthropic.MessageParam;

/**
 * Per-conversation history, keyed by an opaque id (Telegram chat id, CLI
 * session, desktop conversation…). An interface so hosts choose durability:
 * CLI uses the in-memory store, the desktop app persists to SQLite.
 */
export interface ConversationStore {
  get(id: string): Turn[];
  append(id: string, role: "user" | "assistant", content: string): Turn[];
  reset(id: string): void;
}

/** In-memory only — resets on restart. */
export class InMemoryConversationStore implements ConversationStore {
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

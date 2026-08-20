import { app } from "electron";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { ConversationStore, ConversationTurn } from "@wes/core";

/**
 * Durable chat memory: same interface as core's in-memory store, but backed
 * by SQLite so desktop conversations survive restarts. Bounded to the last
 * maxTurns like the in-memory version (context stays cheap).
 */
export class SqliteConversationStore implements ConversationStore {
  private readonly db: Database.Database;

  constructor(private readonly maxTurns = 40) {
    this.db = new Database(join(app.getPath("userData"), "wes.db"));
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_id, id);
    `);
  }

  get(id: string): ConversationTurn[] {
    const rows = this.db
      .prepare(
        `SELECT role, content FROM chat_messages WHERE conversation_id = ?
         ORDER BY id DESC LIMIT ?`,
      )
      .all(id, this.maxTurns) as { role: "user" | "assistant"; content: string }[];
    return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
  }

  append(id: string, role: "user" | "assistant", content: string): ConversationTurn[] {
    this.db
      .prepare(
        "INSERT INTO chat_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, role, content, Date.now());
    return this.get(id);
  }

  reset(id: string): void {
    this.db.prepare("DELETE FROM chat_messages WHERE conversation_id = ?").run(id);
  }
}

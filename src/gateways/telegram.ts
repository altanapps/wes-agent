import { Bot, type Context } from "grammy";
import telegramify from "telegramify-markdown";
import { Wes } from "../wes.js";
import { config } from "../config.js";

// Leave headroom: MarkdownV2 escaping adds backslashes, so chunk below 4096.
const CHUNK_LIMIT = 3500;

/** Telegram gateway — the primary "talk to Wes anywhere" front door. */
export async function runTelegram(): Promise<void> {
  if (!config.telegram.token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather and add the token to .env.",
    );
  }

  const wes = new Wes();
  const bot = new Bot(config.telegram.token);
  // Allow-list entries can be numeric user IDs OR @usernames (case-insensitive).
  // Empty set = open to everyone.
  const allow = new Set(config.telegram.allowedUserIds.map((s) => s.toLowerCase()));

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : "";
    const username = ctx.from?.username ? ctx.from.username.toLowerCase() : "";
    // Log who's messaging so you can capture IDs/handles for the allow-list.
    console.log(`[msg] @${username || "?"} (id ${userId}) chat ${ctx.chat.id}`);

    if (allow.size > 0 && !isAllowed(allow, userId, username)) {
      await ctx.reply("This bot is private.");
      return;
    }

    const text = ctx.message.text.trim();
    const chatId = String(ctx.chat.id);

    if (text === "/start") {
      await ctx.reply(
        `I'm ${wes.name} — your communication coach.\n\nPaste a draft (investor update, cold email, hard feedback, Slack) and I'll diagnose + rewrite it in your voice. Or tell me a conversation you're prepping for and I'll coach you.\n\n/reset clears our thread.`,
      );
      return;
    }

    await ctx.replyWithChatAction("typing");
    try {
      const reply = await wes.respond(chatId, text);
      for (const chunk of chunkText(reply, CHUNK_LIMIT)) {
        await sendRich(ctx, chunk);
      }
    } catch (err) {
      await ctx.reply(`Hit an error: ${(err as Error).message}`);
    }
  });

  bot.catch((err) => console.error("[telegram] update error:", err.message));

  console.log(`${wes.name} is live on Telegram. Press Ctrl+C to stop.`);
  await bot.start();
}

/**
 * Send a chunk with Telegram formatting. Wes writes standard Markdown
 * (**bold**, *italic*, > quote); Telegram uses MarkdownV2 with strict escaping.
 * Convert, then send — and if anything fails, fall back to raw text so the
 * message always lands (never an entity-parse error, never literal asterisks).
 */
async function sendRich(ctx: Context, text: string): Promise<void> {
  try {
    const md = telegramify(text, "escape");
    await ctx.reply(md, { parse_mode: "MarkdownV2" });
  } catch {
    await ctx.reply(text);
  }
}

/** Match an inbound user against the allow-list (numeric id or @username). */
function isAllowed(allow: Set<string>, userId: string, username: string): boolean {
  if (userId && allow.has(userId)) return true;
  if (username && (allow.has(`@${username}`) || allow.has(username))) return true;
  return false;
}

/** Split a long reply into Telegram-sized pieces, preferring paragraph breaks. */
function chunkText(text: string, limit = CHUNK_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n\n", limit);
    if (cut < limit * 0.5) cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

import { Bot } from "grammy";
import { Wes } from "../wes.js";
import { config } from "../config.js";

const TELEGRAM_MAX = 4096;

/** Telegram gateway — the primary "talk to Wes anywhere" front door. */
export async function runTelegram(): Promise<void> {
  if (!config.telegram.token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather and add the token to .env.",
    );
  }

  const wes = new Wes();
  const bot = new Bot(config.telegram.token);
  const allow = new Set(config.telegram.allowedUserIds);

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id ? String(ctx.from.id) : "";
    if (allow.size > 0 && !allow.has(userId)) {
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
      for (const chunk of chunkText(reply)) {
        await ctx.reply(chunk);
      }
    } catch (err) {
      await ctx.reply(`Hit an error: ${(err as Error).message}`);
    }
  });

  bot.catch((err) => console.error("[telegram] update error:", err.message));

  console.log(`${wes.name} is live on Telegram. Press Ctrl+C to stop.`);
  await bot.start();
}

/** Split a long reply into Telegram-sized pieces, preferring paragraph breaks. */
function chunkText(text: string, limit = TELEGRAM_MAX): string[] {
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

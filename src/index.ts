import { runCli } from "./gateways/cli.js";
import { runTelegram } from "./gateways/telegram.js";
import { runLearn } from "./learn/run.js";

/**
 * Entrypoint.
 *   npm run dev:cli            → talk in the terminal
 *   npm run dev:telegram       → run the Telegram bot
 *   npm run learn -- <file>    → diagnose your recurring weaknesses from a corpus
 * or: tsx src/index.ts <command>
 */
const name = process.argv[2] || process.env.GATEWAY || "cli";

const commands: Record<string, () => Promise<void>> = {
  cli: runCli,
  telegram: runTelegram,
  learn: () => runLearn(process.argv[3]),
};

const run = commands[name];

if (!run) {
  console.error(`Unknown command "${name}". Available: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

run().catch((err) => {
  console.error(`[fatal] ${(err as Error).message}`);
  process.exit(1);
});

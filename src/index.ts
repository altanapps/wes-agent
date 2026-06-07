import { runCli } from "./gateways/cli.js";
import { runTelegram } from "./gateways/telegram.js";

/**
 * Entrypoint. Pick a gateway:
 *   npm run dev:cli        → talk in the terminal
 *   npm run dev:telegram   → run the Telegram bot
 * or: tsx src/index.ts <gateway>
 */
const gateways: Record<string, () => Promise<void>> = {
  cli: runCli,
  telegram: runTelegram,
};

const name = process.argv[2] || process.env.GATEWAY || "cli";
const run = gateways[name];

if (!run) {
  console.error(`Unknown gateway "${name}". Available: ${Object.keys(gateways).join(", ")}`);
  process.exit(1);
}

run().catch((err) => {
  console.error(`[fatal] ${(err as Error).message}`);
  process.exit(1);
});

import { runGranolaIngest, runImportIngest, runLearn, runRefresh, runSlackIngest } from "@wes/core";
import { configFromEnv } from "./envConfig.js";
import { runCli } from "./gateways/cli.js";
import { runTelegram } from "./gateways/telegram.js";

/**
 * Entrypoint.
 *   npm run dev:cli            → talk in the terminal
 *   npm run dev:telegram       → run the Telegram bot
 *   npm run learn -- <file>    → diagnose weaknesses from a corpus file
 *   npm run learn:slack        → pull your sent Slack messages + refresh the profile
 * or: tsx apps/cli/src/index.ts <command>
 */
const name = process.argv[2] || process.env.GATEWAY || "cli";
const config = configFromEnv();

const commands: Record<string, () => Promise<void>> = {
  cli: () => runCli(config),
  telegram: () => runTelegram(config),
  learn: async () => {
    const file = process.argv[3];
    if (!file) {
      console.error(
        "Usage: npm run learn -- <corpus-file>\n  (JSON array of {text,channel,date,audience} or blank-line-separated text)",
      );
      process.exit(1);
    }
    await runLearn(config, file);
  },
  slack: async () => {
    if (!config.slack.userToken) {
      console.error("SLACK_USER_TOKEN not set. See docs/slack-setup.md.");
      process.exit(1);
    }
    await runSlackIngest(config);
  },
  granola: async () => {
    await runGranolaIngest(config);
  },
  refresh: async () => {
    await runRefresh(config);
  },
  import: async () => {
    const file = process.argv[3];
    if (!file) {
      console.error("Usage: npm run learn:import -- <corpus-file>");
      process.exit(1);
    }
    await runImportIngest(config, file);
  },
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

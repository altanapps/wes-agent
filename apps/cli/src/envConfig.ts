import "dotenv/config";
import { join } from "node:path";
import { createConfig, type CoachConfig, type Effort, DEFAULT_MODEL } from "@wes/core";

/**
 * The CLI host's config: environment variables (.env) + <cwd>/.coach for data.
 * This reconstructs the pre-monorepo behavior exactly — core itself never
 * touches process.env or process.cwd().
 */
export function configFromEnv(): CoachConfig {
  return createConfig({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    character: process.env.CHARACTER || "wes",
    model: process.env.WES_MODEL || DEFAULT_MODEL,
    effort: (process.env.WES_EFFORT || "high") as Effort,
    profilePath: process.env.WES_PROFILE_PATH || "",
    dataDir: process.env.WES_DATA_DIR || join(process.cwd(), ".coach"),
    slack: {
      // A user token (xoxp-) — reads what *you* can see, including your sent messages.
      userToken: process.env.SLACK_USER_TOKEN || "",
    },
    granola: {
      apiKey: process.env.GRANOLA_API_KEY || "",
    },
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN || "",
      allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
  });
}

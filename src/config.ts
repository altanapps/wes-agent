import "dotenv/config";

/** Centralized, validated environment config. */
export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  character: process.env.CHARACTER || "wes",
  model: process.env.WES_MODEL || "claude-opus-4-8",
  effort: (process.env.WES_EFFORT || "high") as "low" | "medium" | "high" | "max",
  profilePath: process.env.WES_PROFILE_PATH || "",
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
} as const;

export function requireAnthropicKey(): void {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.",
    );
  }
}

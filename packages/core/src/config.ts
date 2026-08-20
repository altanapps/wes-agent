/**
 * Coach configuration. Core never reads process.env or process.cwd() — every
 * host (CLI, Telegram runner, Electron main) constructs a CoachConfig and
 * passes it in. This is what lets the same runtime live in a packaged desktop
 * app (userData dir, keychain-backed key) and a repo checkout (.env, .coach/).
 */
export type Effort = "low" | "medium" | "high" | "max";

export interface CoachConfig {
  anthropicApiKey: string;
  /** Which characters/<name>/ directory defines the persona. */
  character: string;
  model: string;
  effort: Effort;
  /** Optional private "about you" markdown, appended to the system prompt. */
  profilePath: string;
  /** Root of the coach's data: corpus.jsonl, profile.md, cursors. */
  dataDir: string;
  /** Override the built-in characters directory (rarely needed). */
  charactersDir?: string;
  slack: {
    /** User token (xoxp-) — reads what *you* can see, including your sent messages. */
    userToken: string;
  };
  granola: {
    /** Granola public-API key (grn_…, Business plan) — imports your spoken turns from meetings. */
    apiKey: string;
  };
  telegram: {
    token: string;
    allowedUserIds: string[];
  };
}

export const DEFAULT_MODEL = "claude-opus-4-8";

/** Build a config from partial overrides; hosts fill in what they know. */
export function createConfig(overrides: Partial<CoachConfig> & { dataDir: string }): CoachConfig {
  return {
    anthropicApiKey: "",
    character: "wes",
    model: DEFAULT_MODEL,
    effort: "high",
    profilePath: "",
    slack: { userToken: "" },
    granola: { apiKey: "" },
    telegram: { token: "", allowedUserIds: [] },
    ...overrides,
    dataDir: overrides.dataDir,
  };
}

export function requireAnthropicKey(config: CoachConfig): void {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.",
    );
  }
}

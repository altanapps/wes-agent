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

/** Client options for either credential kind: a standard API key (x-api-key)
 *  or an OAuth token (sk-ant-oat…, Bearer + oauth beta header — bills the
 *  Claude subscription, Claude Code-style, instead of API credits). */
export function anthropicClientOptions(config: CoachConfig): {
  apiKey?: string | null;
  authToken?: string;
  defaultHeaders?: Record<string, string>;
} {
  if (config.anthropicApiKey.startsWith("sk-ant-oat")) {
    return {
      // apiKey: null stops the SDK from ALSO reading ANTHROPIC_API_KEY from
      // the env and sending it as x-api-key — the server rejects an OAuth
      // string in that header before ever looking at the Bearer token.
      apiKey: null,
      authToken: config.anthropicApiKey,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    };
  }
  return { apiKey: config.anthropicApiKey };
}

/** Adaptive thinking + effort exist on the 4.6+ families; Haiku 4.5 and older
 *  models reject them with a 400. */
export function supportsAdaptiveThinking(model: string): boolean {
  return !/haiku|claude-3|(sonnet|opus)-4-5/.test(model);
}

/** Request params for thinking/effort, matched to what the model accepts. */
export function thinkingParams(config: CoachConfig): {
  thinking?: { type: "adaptive" };
  output_config?: { effort: Effort };
} {
  if (!supportsAdaptiveThinking(config.model)) return {};
  return { thinking: { type: "adaptive" }, output_config: { effort: config.effort } };
}

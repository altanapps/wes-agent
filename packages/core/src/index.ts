/**
 * @wes/core — the host-agnostic coach runtime.
 * No Electron, no dotenv, no ambient process.env/cwd reads: hosts construct a
 * CoachConfig and pass it in. Consumed by apps/cli (terminal + Telegram) and
 * apps/desktop (Electron main).
 */
export { type CoachConfig, type Effort, createConfig, requireAnthropicKey, DEFAULT_MODEL } from "./config.js";
export { type CoachPaths, coachPaths } from "./storage/paths.js";
export { Wes } from "./wes.js";
export { loadCharacter } from "./character.js";
export { type ConversationStore, type Turn, InMemoryConversationStore } from "./memory.js";
export { buildCoachingProfile } from "./learn/diagnostics.js";
export { appendMessages, loadCorpus, readCursor, writeCursor } from "./learn/store.js";
export { runLearn } from "./learn/run.js";
export { runSlackIngest } from "./learn/slackIngest.js";
export { runGranolaIngest } from "./learn/granolaIngest.js";
export { runImportIngest } from "./learn/importIngest.js";
export { runRefresh } from "./learn/refresh.js";
export type { Message, Channel, Source } from "./sources/types.js";
export { slackSource } from "./sources/slack.js";
export { granolaSource, myTurns } from "./sources/granola.js";
export { loadCorpusFile } from "./sources/corpusFile.js";
export { transcriptsSource } from "./sources/transcripts.js";

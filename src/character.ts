import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARACTERS_DIR = join(__dirname, "..", "characters");

/**
 * Assemble a character's system prompt from its directory.
 * `character.md` goes first; every other `.md` follows alphabetically.
 * This is the only thing that defines who the agent is — swap the directory
 * to swap the character. Fully SDK-agnostic.
 */
export function loadCharacter(name = config.character): {
  name: string;
  systemPrompt: string;
} {
  const dir = join(CHARACTERS_DIR, name);
  if (!existsSync(dir)) {
    throw new Error(
      `Character "${name}" not found at ${dir}. Available: ${readdirSync(
        CHARACTERS_DIR,
      ).join(", ")}`,
    );
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  files.sort((a, b) =>
    a === "character.md" ? -1 : b === "character.md" ? 1 : a.localeCompare(b),
  );

  const parts = files
    .filter((f) => f.toLowerCase() !== "readme.md")
    .map((f) => readFileSync(join(dir, f), "utf8").trim());

  const personalization = loadPersonalization();
  if (personalization) parts.push(personalization);

  const coachingProfile = loadCoachingProfile();
  if (coachingProfile) parts.push(coachingProfile);

  parts.push(RUNTIME_NOTE);

  return { name, systemPrompt: parts.join("\n\n---\n\n") };
}

/**
 * Optional private personalization. Points at a gitignored markdown file
 * describing the user (voice, context, who they write to) so rewrites sound
 * like them. Keeps the public repo free of anyone's private profile.
 */
function loadPersonalization(): string | null {
  if (!config.profilePath || !existsSync(config.profilePath)) return null;
  const body = readFileSync(config.profilePath, "utf8").trim();
  if (!body) return null;
  return `# About the person you're coaching\n\nUse this to tailor advice and to make rewrites sound like them, not generic.\n\n${body}`;
}

/**
 * The coaching profile — your recurring weaknesses, learned from your real
 * messages (see src/learn/). Injected so the coach targets the patterns you
 * actually have and can flag when you repeat one. Explicitly NOT a voice clone.
 */
function loadCoachingProfile(): string | null {
  const path = join(process.cwd(), ".coach", "profile.md");
  if (!existsSync(path)) return null;
  const body = readFileSync(path, "utf8").trim();
  if (!body) return null;
  return `# What you've learned about this person's communication

This is a diagnosis of their RECURRING weaknesses, built from messages they actually sent across their channels. Use it to:
- target coaching at the habits they actually have (don't re-teach what they already do well),
- point out when they repeat a known pattern ("you buried the ask again — that's your #1 recurring miss"),
- note progress when a tracked weakness improves.

Do NOT use it to imitate their voice. Your job is to move them off these habits, not reinforce them.

${body}`;
}

const RUNTIME_NOTE = `# Runtime

You're talking over a chat interface (Telegram or terminal). Plain text renders best — use your 🚫/✅ contrasts and short lines, but avoid heavy markdown tables and code fences. Keep replies tight; this is a conversation, not an essay.`;

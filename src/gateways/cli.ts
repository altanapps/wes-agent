import readline from "node:readline";
import { Wes } from "../wes.js";

/** Terminal gateway — talk to the character without any external service. */
export async function runCli(): Promise<void> {
  const wes = new Wes();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    `\n${wes.name} is here. Paste a draft to sharpen, or ask about a conversation you're prepping for.\n(Ctrl+C to quit · /reset to clear the thread)\n`,
  );

  const prompt = () => {
    rl.question("you ▸ ", async (line) => {
      const text = line.trim();
      if (!text) return prompt();
      try {
        process.stdout.write(`\n${wes.name} is thinking…\r`);
        const reply = await wes.respond("cli", text);
        console.log(`\n${wes.name} ▸ ${reply}\n`);
      } catch (err) {
        console.error(`\n[error] ${(err as Error).message}\n`);
      }
      prompt();
    });
  };

  prompt();
}

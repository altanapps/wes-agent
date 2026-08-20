import { join } from "node:path";

/**
 * Every file the coach persists, derived from one dataDir root. CLI points
 * this at <repo>/.coach; the desktop app points it at Electron's userData.
 */
export interface CoachPaths {
  dataDir: string;
  corpusFile: string;
  profileFile: string;
  cursorFile(sourceName: string): string;
}

export function coachPaths(dataDir: string): CoachPaths {
  return {
    dataDir,
    corpusFile: join(dataDir, "corpus.jsonl"),
    profileFile: join(dataDir, "profile.md"),
    cursorFile: (sourceName: string) => join(dataDir, `${sourceName}.cursor`),
  };
}

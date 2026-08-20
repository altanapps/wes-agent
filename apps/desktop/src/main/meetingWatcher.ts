import { app, Notification } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { recordingSession } from "./recordingSession.js";
import { getMeetingNudgeEnabled } from "./settings.js";

const execFileP = promisify(execFile);

/**
 * The Granola-style nudge: watch the macOS calendar (via the bundled EventKit
 * helper, so every account the Mac syncs — Google included — just works) and
 * pop a notification when a meeting with a video link is starting. Clicking it
 * starts a recording titled after the event. Zoom gets a second, calendar-free
 * detector: its in-meeting helper process (CptHost) only exists during calls.
 *
 * Consent stance: the nudge always asks — there is no silent auto-record.
 */
const POLL_MS = 30_000;
/** Nudge fires when an event starts within this window (or started < 5 min ago). */
const UPCOMING_MS = 2 * 60_000;
const STARTED_AGO_MS = 5 * 60_000;

const MEETING_LINK = /meet\.google\.com|zoom\.us\/(j|my)\/|teams\.microsoft\.com|whereby\.com|around\.co/i;

interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  text: string;
}

let timer: NodeJS.Timeout | null = null;
const prompted = new Set<string>();
let zoomPromptedAt = 0;
let calendarDenied = false;

function helperPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "wes-calendar-helper")
    : join(app.getAppPath(), "build", "wes-calendar-helper");
}

async function readCalendar(): Promise<CalendarEvent[]> {
  const bin = helperPath();
  if (calendarDenied || !existsSync(bin)) return [];
  try {
    const { stdout } = await execFileP(bin, [], { timeout: 15_000 });
    const parsed = JSON.parse(stdout.trim()) as CalendarEvent[] | { error: string };
    if (!Array.isArray(parsed)) {
      calendarDenied = true; // user said no — stop asking every poll
      return [];
    }
    return parsed;
  } catch {
    return []; // helper hiccup — try again next poll
  }
}

function nudge(title: string, body: string, recordTitle: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    actions: [{ type: "button", text: "Record" }],
    silent: false,
  });
  const start = () => {
    if (!recordingSession.isActive()) void recordingSession.start(recordTitle);
  };
  n.on("action", start);
  n.on("click", start);
  n.show();
}

async function poll(): Promise<void> {
  if (!getMeetingNudgeEnabled() || recordingSession.isActive()) return;

  // 1) Calendar: a linked meeting starting now.
  const now = Date.now();
  for (const e of await readCalendar()) {
    if (!MEETING_LINK.test(`${e.text} ${e.title}`)) continue;
    const startMs = Date.parse(e.start);
    if (Number.isNaN(startMs)) continue;
    if (startMs - now > UPCOMING_MS || now - startMs > STARTED_AGO_MS) continue;
    const key = `${e.title}|${e.start}`;
    if (prompted.has(key)) continue;
    prompted.add(key);
    nudge(`${e.title} is starting`, "Record it with Wes? Audio stays on this Mac.", e.title);
  }

  // 2) Zoom: the CptHost process exists only during an active meeting.
  try {
    await execFileP("/usr/bin/pgrep", ["-x", "CptHost"]);
    if (now - zoomPromptedAt > 30 * 60_000) {
      zoomPromptedAt = now;
      nudge("You're in a Zoom meeting", "Record it with Wes? Audio stays on this Mac.", "Zoom call");
    }
  } catch {
    // pgrep exits non-zero when no process matches — the normal case.
  }
}

/** Best current calendar match, used to auto-title manual recordings too. */
export async function currentMeetingTitle(): Promise<string | null> {
  const now = Date.now();
  for (const e of await readCalendar()) {
    const startMs = Date.parse(e.start);
    const endMs = Date.parse(e.end);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs - UPCOMING_MS <= now && now <= endMs) {
      return e.title;
    }
  }
  return null;
}

export function startMeetingWatcher(): void {
  if (timer) return;
  timer = setInterval(() => void poll(), POLL_MS);
  void poll();
}

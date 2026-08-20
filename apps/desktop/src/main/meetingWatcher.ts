import { app, Notification } from "electron";
import { execFile } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
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
const POLL_MS = 15_000;
/** Calendar is read every other tick (helper spawn is heavier than pgrep). */
const CALENDAR_EVERY_TICKS = 2;
/** Nudge fires when an event starts within this window (or started < 5 min ago). */
const UPCOMING_MS = 2 * 60_000;
const STARTED_AGO_MS = 5 * 60_000;
/** Mic must be busy for this many consecutive ticks (~30s) — filters Siri/dictation. */
const MIC_CONSECUTIVE = 2;
/** Minimum gap between mic nudges — guards against device flapping, nothing more.
 *  The real rule is one nudge per continuous mic session (reset when it ends). */
const MIC_COOLDOWN_MS = 3 * 60_000;

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
let tick = 0;
let micBusyTicks = 0;
let micPromptedAt = 0;
let micSessionPrompted = false;
let onNudgeCb: (() => void) | null = null;

function helperPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "wes-calendar-helper")
    : join(app.getAppPath(), "build", "wes-calendar-helper");
}

/** Diagnostic trail at <userData>/watcher.log — the packaged app has no
 *  visible stdout, and "why didn't it nudge me?" needs receipts. */
function wlog(msg: string): void {
  try {
    appendFileSync(
      join(app.getPath("userData"), "watcher.log"),
      `${new Date().toISOString()} ${msg}\n`,
    );
  } catch {
    // logging must never break the watcher
  }
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

/** Is the default input device in use by ANY app? This is how browser-based
 *  meetings (Google Meet in Chrome) are caught — no process to watch, but the
 *  mic lights up. */
async function micInUse(): Promise<boolean> {
  const bin = helperPath();
  if (!existsSync(bin)) return false;
  try {
    const { stdout } = await execFileP(bin, ["mic"], { timeout: 5_000 });
    return (JSON.parse(stdout.trim()) as { inUse: boolean }).inUse === true;
  } catch {
    return false;
  }
}

export function nudge(title: string, body: string, recordTitle: string): void {
  wlog(`NUDGE fired: "${title}" (record title: "${recordTitle}") — notification supported: ${Notification.isSupported()}`);
  // Notifications from an ad-hoc-signed app can be silently muted, so the
  // tray also flashes (via onNudgeCb) — two chances to be seen, zero auto-record.
  onNudgeCb?.();
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
  if (!getMeetingNudgeEnabled() || recordingSession.isActive()) {
    micBusyTicks = 0; // our own capture uses the mic — never self-detect
    return;
  }
  tick += 1;
  const now = Date.now();

  // 1) Calendar: a linked meeting starting now.
  if (tick % CALENDAR_EVERY_TICKS === 0) {
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
  }

  // 2) Zoom: the CptHost process exists only during an active meeting.
  try {
    await execFileP("/usr/bin/pgrep", ["-x", "CptHost"]);
    if (now - zoomPromptedAt > 30 * 60_000) {
      zoomPromptedAt = now;
      nudge("You're in a Zoom meeting", "Record it with Wes? Audio stays on this Mac.", "Zoom call");
    }
    return; // Zoom covered; don't double-nudge via the mic path
  } catch {
    // pgrep exits non-zero when no process matches — the normal case.
  }

  // 3) Mic-in-use ("Meeting detected"): catches Google Meet in a browser,
  //    ad-hoc calls, anything without a process or calendar event. Requires
  //    sustained use so Siri/dictation don't trigger it.
  if (await micInUse()) {
    micBusyTicks += 1;
    if (micBusyTicks === 1) wlog("mic in use (tick 1)");
    // One nudge per continuous mic session; >= so a cooldown-blocked tick can
    // still fire later in the same call instead of never.
    if (micBusyTicks >= MIC_CONSECUTIVE && !micSessionPrompted) {
      if (now - micPromptedAt <= MIC_COOLDOWN_MS) {
        wlog("mic sustained but within flap cooldown — will retry next tick");
      } else {
        micSessionPrompted = true;
        micPromptedAt = now;
        const title = (await currentMeetingTitle().catch(() => null)) ?? "Call";
        nudge(
          "Sounds like you're in a meeting",
          "Record it with Wes? Audio stays on this Mac.",
          title,
        );
      }
    }
  } else {
    if (micBusyTicks >= MIC_CONSECUTIVE) wlog("mic idle — session reset");
    micBusyTicks = 0;
    micSessionPrompted = false;
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

export function startMeetingWatcher(onNudge?: () => void): void {
  if (timer) return;
  onNudgeCb = onNudge ?? null;
  wlog(`watcher started (packaged: ${app.isPackaged}, helper: ${existsSync(helperPath())})`);
  timer = setInterval(() => void poll(), POLL_MS);
  void poll();
}

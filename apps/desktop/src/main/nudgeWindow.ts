import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

/**
 * The floating nudge pill: a small frameless always-on-top window, top-right
 * of the display the user is on, visible over fullscreen apps (where meetings
 * live). Auto-dismisses after 45s if untouched; sticks around as a recording
 * indicator once recording starts (the renderer switches state itself).
 */
const WIDTH = 400;
const HEIGHT = 68;
const AUTO_DISMISS_MS = 45_000;

let pill: BrowserWindow | null = null;
let dismissTimer: NodeJS.Timeout | null = null;

export function showNudgePill(heading: string, recordTitle: string): void {
  closeNudgePill();

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width } = display.workArea;

  pill = new BrowserWindow({
    x: x + width - WIDTH - 16,
    y: y + 12,
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false, // the pill draws its own shadow
    alwaysOnTop: true,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  pill.setAlwaysOnTop(true, "screen-saver");
  pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const query = `?heading=${encodeURIComponent(heading)}&title=${encodeURIComponent(recordTitle)}`;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void pill.loadURL(`${devUrl}/nudge.html${query}`);
  } else {
    void pill.loadFile(join(import.meta.dirname, "../renderer/nudge.html"), {
      search: query,
    });
  }
  // Appear without stealing focus from the meeting.
  pill.once("ready-to-show", () => pill?.showInactive());

  pill.on("closed", () => {
    pill = null;
  });

  // Only auto-dismiss an unanswered nudge — never a live recording indicator.
  dismissTimer = setTimeout(() => {
    if (!recordingActive) closeNudgePill();
  }, AUTO_DISMISS_MS);
}

let recordingActive = false;

export function setPillRecordingActive(active: boolean): void {
  recordingActive = active;
}

export function closeNudgePill(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  pill?.destroy();
  pill = null;
}

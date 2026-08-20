import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";
import type { CaptureMode } from "@wes/core";
import { IPC, type CaptureLane, type SettingsPatch, type WhisperModelId } from "../shared/ipc.js";
import { applySettingsPatch, getPublicSettings } from "./settings.js";
import { buildDesktopConfig, getWes, resetWes } from "./coach.js";
import { registerLoopbackHandler } from "./loopback.js";
import { addCaptureChunk, beginCaptureTest, endCaptureTest, isCaptureTestActive } from "./captureTest.js";
import { runGranolaIngest } from "@wes/core";
import { recordingSession } from "./recordingSession.js";
import * as db from "./db.js";
import { downloadModel, modelsState } from "./whisper/models.js";
import { whisperManager } from "./whisper/manager.js";
import { corpusCounts, onProfileEvent, readProfile, regenerateProfile } from "./profileManager.js";
import { currentMeetingTitle, startMeetingWatcher } from "./meetingWatcher.js";

const isDev = !!process.env.ELECTRON_RENDERER_URL;

app.setName("Wes");
// In dev the packaged Info.plist isn't used, so set the dock icon by hand.
if (isDev && process.platform === "darwin") {
  const devIcon = join(import.meta.dirname, "../../build/icon.png");
  try {
    app.dock?.setIcon(devIcon);
  } catch {
    // icon missing in a fresh checkout — cosmetic only
  }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 720,
    minHeight: 480,
    title: "Wes",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // TODO(M1): enable sandbox once the preload is confirmed CJS-compatible.
      sandbox: false,
    },
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!);
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function sendToUI(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function refreshTray(): void {
  if (!tray) return;
  const recording = recordingSession.isActive();
  tray.setTitle(recording ? "● Wes" : "Wes");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      recording
        ? { label: "Stop recording", click: () => void recordingSession.stop() }
        : { label: "Start recording", click: () => void recordingSession.start() },
      { type: "separator" },
      { label: "Open Wes", click: () => createMainWindow() },
      { type: "separator" },
      { label: "Quit Wes", role: "quit" },
    ]),
  );
}

function createTray(): void {
  // Placeholder glyph tray (a proper templateImage icon lands with the real UI).
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Wes — communication coach");
  refreshTray();
}

function registerIpc(): void {
  ipcMain.handle(IPC.chatSend, async (_e, conversationId: string, text: string) => {
    if (typeof conversationId !== "string" || typeof text !== "string") {
      throw new Error("Bad chat payload.");
    }
    return getWes().respond(conversationId, text);
  });

  ipcMain.handle(IPC.settingsGet, () => getPublicSettings());

  ipcMain.handle(IPC.settingsSet, (_e, patch: SettingsPatch) => {
    const result = applySettingsPatch(patch ?? {});
    resetWes();
    return result;
  });

  // Capture chunks arrive from the self-check (test) OR the hidden session window.
  ipcMain.handle(IPC.captureBegin, () => beginCaptureTest());
  ipcMain.on(IPC.captureChunk, (_e, lane: CaptureLane, pcm: ArrayBuffer, startMs: number) => {
    if ((lane !== "mic" && lane !== "system") || !(pcm instanceof ArrayBuffer)) return;
    if (isCaptureTestActive()) addCaptureChunk(lane, pcm);
    else recordingSession.onChunk(lane, pcm, Number(startMs) || 0);
  });
  ipcMain.handle(IPC.captureEnd, () => endCaptureTest());
  ipcMain.on(IPC.captureMode, (_e, mode: CaptureMode | "fatal", message?: string) => {
    recordingSession.reportMode(mode, message);
  });

  ipcMain.handle(IPC.granolaImport, async () => {
    const result = await runGranolaIngest(buildDesktopConfig());
    resetWes(); // pick up the refreshed coaching profile in chat
    return result;
  });

  ipcMain.handle(IPC.recordingStart, async () => {
    // Auto-title a manual start after the calendar meeting happening right now.
    const title = await currentMeetingTitle().catch(() => null);
    return recordingSession.start(title ?? undefined);
  });
  ipcMain.handle(IPC.recordingStop, () => recordingSession.stop());
  ipcMain.handle(IPC.callsList, () => db.listCalls());
  ipcMain.handle(IPC.callGet, (_e, id: string) => db.getCall(String(id)));
  ipcMain.handle(IPC.callDelete, (_e, id: string) => db.deleteCall(String(id)));

  ipcMain.handle(IPC.modelsState, () => modelsState());
  ipcMain.handle(IPC.modelsDownload, (_e, id: WhisperModelId) =>
    downloadModel(id, (pct) => sendToUI(IPC.evModelProgress, { id, pct })),
  );

  ipcMain.handle(IPC.trendsGet, () => ({
    series: db.getTrendSeries(),
    profile: readProfile(),
    corpusCounts: corpusCounts(),
  }));
  ipcMain.handle(IPC.profileRefresh, () => regenerateProfile());
}

void app.whenReady().then(() => {
  registerLoopbackHandler();
  onProfileEvent((status, detail) => sendToUI(IPC.evProfileStatus, { status, detail }));
  recordingSession.wire(
    (status) => {
      sendToUI(IPC.evRecordingStatus, status);
      refreshTray();
    },
    (id) => sendToUI(IPC.evCallUpdated, id),
  );
  registerIpc();
  createTray();
  createMainWindow();
  startMeetingWatcher();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
  whisperManager.shutdown();
});

// Menubar app: closing the window keeps Wes alive in the tray.
app.on("window-all-closed", () => {
  // no-op on macOS; on other platforms quit.
  if (process.platform !== "darwin") app.quit();
});

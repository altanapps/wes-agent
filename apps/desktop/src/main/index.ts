import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";
import { IPC, type CaptureLane, type SettingsPatch } from "../shared/ipc.js";
import { applySettingsPatch, getPublicSettings } from "./settings.js";
import { buildDesktopConfig, getWes, resetWes } from "./coach.js";
import { runGranolaIngest } from "@wes/core";
import { registerLoopbackHandler } from "./loopback.js";
import { addCaptureChunk, beginCaptureTest, endCaptureTest } from "./captureTest.js";

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

function createTray(): void {
  // Placeholder glyph tray (a proper templateImage icon lands with the real UI).
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("Wes");
  tray.setToolTip("Wes — communication coach");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Wes", click: () => createMainWindow() },
      { type: "separator" },
      // M1: Start/Stop recording + elapsed time land here.
      { label: "Quit Wes", role: "quit" },
    ]),
  );
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

  ipcMain.handle(IPC.captureBegin, () => beginCaptureTest());
  ipcMain.on(IPC.captureChunk, (_e, lane: CaptureLane, pcm: ArrayBuffer) => {
    if ((lane === "mic" || lane === "system") && pcm instanceof ArrayBuffer) {
      addCaptureChunk(lane, pcm);
    }
  });
  ipcMain.handle(IPC.captureEnd, () => endCaptureTest());

  ipcMain.handle(IPC.granolaImport, async () => {
    const result = await runGranolaIngest(buildDesktopConfig());
    resetWes(); // pick up the refreshed coaching profile in chat
    return result;
  });
}

void app.whenReady().then(() => {
  registerLoopbackHandler();
  registerIpc();
  createTray();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Menubar app: closing the window keeps Wes alive in the tray.
app.on("window-all-closed", () => {
  // no-op on macOS; on other platforms quit.
  if (process.platform !== "darwin") app.quit();
});

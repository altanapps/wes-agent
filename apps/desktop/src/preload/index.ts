import { contextBridge, ipcRenderer } from "electron";
import { IPC, type CaptureLane, type SettingsPatch, type WesApi } from "../shared/ipc.js";

/**
 * The only bridge between renderer and main. The renderer never sees
 * ipcRenderer directly — just this typed, minimal API.
 */
const api: WesApi = {
  chat: (conversationId: string, text: string) =>
    ipcRenderer.invoke(IPC.chatSend, conversationId, text),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch: SettingsPatch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  captureBegin: () => ipcRenderer.invoke(IPC.captureBegin),
  captureChunk: (lane: CaptureLane, pcm: ArrayBuffer) =>
    ipcRenderer.send(IPC.captureChunk, lane, pcm),
  captureEnd: () => ipcRenderer.invoke(IPC.captureEnd),
  granolaImport: () => ipcRenderer.invoke(IPC.granolaImport),
};

contextBridge.exposeInMainWorld("wes", api);

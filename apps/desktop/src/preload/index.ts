import { contextBridge, ipcRenderer } from "electron";
import {
  IPC,
  type CaptureLane,
  type SettingsPatch,
  type WesApi,
  type WhisperModelId,
} from "../shared/ipc.js";
import type { CaptureMode } from "@wes/core";

/**
 * The only bridge between renderer and main. The renderer never sees
 * ipcRenderer directly — just this typed, minimal API.
 */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: WesApi = {
  chat: (conversationId: string, text: string) =>
    ipcRenderer.invoke(IPC.chatSend, conversationId, text),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch: SettingsPatch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  captureBegin: () => ipcRenderer.invoke(IPC.captureBegin),
  captureChunk: (lane: CaptureLane, pcm: ArrayBuffer, startMs: number) =>
    ipcRenderer.send(IPC.captureChunk, lane, pcm, startMs),
  captureEnd: () => ipcRenderer.invoke(IPC.captureEnd),
  reportCaptureMode: (mode: CaptureMode | "fatal", message?: string) =>
    ipcRenderer.send(IPC.captureMode, mode, message),
  granolaImport: () => ipcRenderer.invoke(IPC.granolaImport),

  recordingStart: (title?: string) => ipcRenderer.invoke(IPC.recordingStart, title),
  recordingStop: () => ipcRenderer.invoke(IPC.recordingStop),
  nudgeDismiss: () => ipcRenderer.invoke(IPC.nudgeDismiss),
  callsList: () => ipcRenderer.invoke(IPC.callsList),
  callGet: (id: string) => ipcRenderer.invoke(IPC.callGet, id),
  callDelete: (id: string) => ipcRenderer.invoke(IPC.callDelete, id),

  modelsState: () => ipcRenderer.invoke(IPC.modelsState),
  modelsDownload: (id: WhisperModelId) => ipcRenderer.invoke(IPC.modelsDownload, id),

  trendsGet: () => ipcRenderer.invoke(IPC.trendsGet),
  profileRefresh: () => ipcRenderer.invoke(IPC.profileRefresh),
  nudgeTest: () => ipcRenderer.invoke(IPC.nudgeTest),

  onRecordingStatus: (cb) => subscribe(IPC.evRecordingStatus, cb),
  onCallUpdated: (cb) => subscribe(IPC.evCallUpdated, cb),
  onModelProgress: (cb) => subscribe(IPC.evModelProgress, cb),
  onProfileStatus: (cb) => subscribe(IPC.evProfileStatus, cb),
};

contextBridge.exposeInMainWorld("wes", api);

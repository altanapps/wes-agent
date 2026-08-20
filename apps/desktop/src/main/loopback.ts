import { desktopCapturer, session } from "electron";

/**
 * Route getDisplayMedia({audio:true}) to macOS system-audio loopback.
 * Electron ≥39 backs `audio: 'loopback'` with Apple's CoreAudio tap API
 * (macOS 14.2+, requires the System Audio Recording permission). The video
 * track is mandatory in the API; the renderer discards it immediately.
 */
export function registerLoopbackHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ["screen"] })
        .then((sources) => {
          if (!sources.length) return callback({});
          callback({ video: sources[0], audio: "loopback" });
        })
        .catch(() => callback({}));
    },
    { useSystemPicker: false },
  );
}

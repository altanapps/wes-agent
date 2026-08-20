import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    // Bundle @wes/core (workspace TS source) into main; keep real deps external.
    plugins: [externalizeDepsPlugin({ exclude: ["@wes/core"] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "src/main/index.ts"),
          // Separate entry for the whisper utilityProcess.
          whisperWorker: resolve(import.meta.dirname, "src/main/whisper/worker.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@wes/core"] })],
  },
  renderer: {
    // No @vitejs/plugin-react: electron-vite 5's rolldown-vite transforms TSX
    // (automatic JSX runtime) natively, and plugin-react v6 conflicts with its
    // builtin react-refresh wrapper. Cost: no fast-refresh, full reload on edit.
    build: {
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "src/renderer/index.html"),
          // Hidden capture window for recording sessions.
          capture: resolve(import.meta.dirname, "src/renderer/capture.html"),
          // Floating nudge pill ("Meeting detected — Record?").
          nudge: resolve(import.meta.dirname, "src/renderer/nudge.html"),
        },
      },
    },
  },
});

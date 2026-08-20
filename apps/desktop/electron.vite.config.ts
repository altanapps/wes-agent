import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    // Bundle @wes/core (workspace TS source) into main; keep real deps external.
    plugins: [externalizeDepsPlugin({ exclude: ["@wes/core"] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    // No @vitejs/plugin-react: electron-vite 5's rolldown-vite transforms TSX
    // (automatic JSX runtime) natively, and plugin-react v6 conflicts with its
    // builtin react-refresh wrapper. Cost: no fast-refresh, full reload on edit.
  },
});

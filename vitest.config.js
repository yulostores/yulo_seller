import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx}"],
    setupFiles: ["./src/test/setup.js"],
    restoreMocks: true,
    // Screen tests type into forms with user-event; on a busy machine running every file at once
    // a long one can pass 5 s while taking ~0.3 s alone. A slow machine is not a failure.
    testTimeout: 15_000,
  },
});

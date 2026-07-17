import { defineConfig } from "vitest/config";

// Vitest prefers this file over vite.config.ts, which configures the MCP Apps
// UI bundle (root: "ui") and would otherwise point test discovery at ui/.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});

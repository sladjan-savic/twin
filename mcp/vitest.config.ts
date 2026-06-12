import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      TWIN_DB_PATH: ":memory:",
      TWIN_MEMORY_DIR: "/tmp/twin-test",
    },
  },
});

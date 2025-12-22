/// <reference types="vitest" />
/// <reference types="vitest/globals" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // global import "describe", "it", "expect"
    globals: true,
    // ("node", "jsdom", "happy-dom")
    // environment: "jsdom",
  },
});


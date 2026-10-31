import { defineConfig } from "vitest/config";

// Private runtimes and verification copies may contain historical source trees.
// Only the repository's current source is part of its regression suite.
export default defineConfig({ test: { include: ["src/**/*.test.ts"], maxWorkers: 4, testTimeout: 20_000, hookTimeout: 20_000 } });

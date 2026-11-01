import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup.ts'],
    // e2e specs talk to the real WordPress in Docker; keep them sequential and patient.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

/** Vitest configuration for unit and integration tests. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      },
      include: ['entrypoints/**/*.ts'],
      // Exclude the EasyMDE browser wrapper; behavior is covered through newtab integration and Playwright.
      exclude: [
        '**/*.d.ts',
        'tests/**/*.ts',
        'entrypoints/newtab/editor.ts'
      ]
    }
  }
});

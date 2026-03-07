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
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      },
      include: ['entrypoints/**/*.ts'],
      exclude: ['**/*.d.ts', 'tests/**/*.ts', 'entrypoints/drive-auth/index.ts']
    }
  }
});


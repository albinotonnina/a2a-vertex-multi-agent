import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/types.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 30000, // 30s for integration tests
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});

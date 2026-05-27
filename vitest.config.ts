import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    coverage: { provider: 'v8', include: ['lib/**'] },
  },
});

import { defineConfig, defaultExclude } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    // .worktrees는 별도 브랜치의 작업 사본 — 본 리포 테스트 대상이 아니다.
    exclude: [...defaultExclude, '**/.worktrees/**'],
    coverage: { provider: 'v8', include: ['lib/**'] },
  },
});

import { defineConfig } from 'vitest/config';

/**
 * Only this checkout's own tests. A git worktree lives under .claude/worktrees and
 * holds a second copy of the repository; left to its defaults vitest collects that
 * copy too, so every run doubles and a stale branch reports alongside this one.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});

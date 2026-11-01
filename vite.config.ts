import { defineConfig } from 'vitest/config';

// GitHub Pages のプロジェクトページ（https://high-valley.github.io/Zodiac-Puzzle-Battle/）に合わせる
export default defineConfig({
  base: '/Zodiac-Puzzle-Battle/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

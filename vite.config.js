import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cards-game-vibe/',
  optimizeDeps: {
    include: ['docx'],
  },
});

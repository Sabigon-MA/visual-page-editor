import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Monaco Editor（プログラマーモードで遅延読み込み）が大きいため
    chunkSizeWarningLimit: 3000,
  },
  test: {
    environment: 'node',
    css: true,
  },
});

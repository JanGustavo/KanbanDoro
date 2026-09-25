import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        content: './src/content.tsx'
      },
      output: {
        entryFileNames: '[name].js',
      }
    }
  }
});

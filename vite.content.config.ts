import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content.ts',
      name: 'KanbanDoroBubble',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});

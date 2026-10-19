import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'web'),
  base: './',
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, 'shared') } },
  build: { outDir: path.resolve(__dirname, 'dist/web'), emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
});

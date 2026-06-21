import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/collect': 'http://localhost:3001',
      '/sg.js': 'http://localhost:3001',
      '/tracker.js': 'http://localhost:3001',
    },
  },
});

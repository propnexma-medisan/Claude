import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: [
        '@capacitor/core',
        '@capacitor/status-bar',
        '@capacitor/splash-screen',
        '@capacitor/push-notifications',
        '@capacitor/network',
        '@capacitor/haptics',
        '@capacitor/app',
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

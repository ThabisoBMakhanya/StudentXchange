import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: {
    name: 'StudentXchange', short_name: 'StudentXchange', theme_color: '#1749d1', background_color: '#ffffff',
    display: 'standalone', start_url: '/', icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/studentxchange-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ]
  } })],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }
});

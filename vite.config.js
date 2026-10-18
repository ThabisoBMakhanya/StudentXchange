import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
export default defineConfig({
    plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: {
                name: 'StudentXchange', short_name: 'SX', theme_color: '#1749d1', background_color: '#ffffff',
                display: 'standalone', start_url: '/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
            } })],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }
});

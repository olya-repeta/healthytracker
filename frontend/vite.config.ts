import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'pwa-192x192.svg',
        'pwa-512x512.svg',
        'apple-touch-icon.svg',
      ],
      manifest: {
        name: 'VitaTrack — Розумна таблетниця',
        short_name: 'VitaTrack',
        description:
          'Персональний трекер прийому ліків та вітамінів із нагадуваннями',
        theme_color: '#46715B',
        background_color: '#F8FAF9',
        display: 'standalone',
        start_url: '/',
        lang: 'uk',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Service Worker НЕ перехоплює запити до /api/* та /auth/*
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: 'esbuild',
    sourcemap: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // El SW nuevo toma control de inmediato, sin quedar atorado en caché viejo.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        // Permite probar el service worker en `npm run dev`
        enabled: true,
      },
      manifest: {
        name: 'Kohtun',
        short_name: 'Kohtun',
        description: 'Smart Appointment Scheduling',
        display: 'standalone',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        start_url: '/',
        icons: [
          {
            src: '/kohtun-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/kohtun-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})

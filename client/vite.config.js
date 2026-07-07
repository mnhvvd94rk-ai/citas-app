import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Permite probar el service worker en `npm run dev`
        enabled: true,
      },
      manifest: {
        name: 'Meetun',
        short_name: 'Meetun',
        description: 'Smart Appointment Scheduling',
        display: 'standalone',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        start_url: '/',
        icons: [
          {
            src: 'meetun-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})

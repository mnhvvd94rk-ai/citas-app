import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Origen del backend según el modo (VITE_API_URL). Se usa para aplicar
  // network-first solo a las llamadas de la API (p.ej. Render en producción,
  // localhost:3001 en desarrollo).
  // OJO: las `urlPattern` de tipo función se serializan con `.toString()` en el
  // SW generado y NO capturan variables de cierre. Por eso el origen de la API
  // se inyecta como un RegExp (se serializa como literal y sí funciona en el SW).
  const env = loadEnv(mode, process.cwd(), '')
  let apiUrlPattern = null
  try {
    const apiOrigin = new URL(env.VITE_API_URL).origin
    const escapado = apiOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    apiUrlPattern = new RegExp(`^${escapado}/`)
  } catch {
    apiUrlPattern = null
  }

  return {
    build: {
      minify: 'esbuild',
      sourcemap: false,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // 'inline' escribe la llamada navigator.serviceWorker.register(...)
        // DIRECTAMENTE en el <head> del HTML (en vez de un <script src="/registerSW.js">
        // externo). Así los analizadores que inspeccionan el HTML servido
        // (como PWABuilder) detectan el registro del service worker.
        injectRegister: 'inline',
        workbox: {
          // El SW nuevo toma control de inmediato, sin quedar atorado en caché viejo.
          skipWaiting: true,
          clientsClaim: true,
          // Inyecta los listeners de Web Push (push / notificationclick) en el SW
          // generado. push-sw.js vive en public/ y se sirve en la raíz del sitio.
          importScripts: ['/push-sw.js'],
          // Precache (cache-first) de todo el build estático: JS, CSS, HTML,
          // iconos, SVG e imágenes emitidas por Vite.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
          runtimeCaching: [
            // API del backend → network-first: siempre intenta la red y, si falla
            // (offline), sirve la última respuesta GET cacheada. Solo se aplica si
            // conocemos el origen de la API. NetworkFirst nunca cachea mutaciones
            // (POST/PATCH/DELETE), solo GET.
            ...(apiUrlPattern
              ? [
                  {
                    urlPattern: apiUrlPattern,
                    handler: 'NetworkFirst',
                    options: {
                      cacheName: 'kohtun-api',
                      networkTimeoutSeconds: 10,
                      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1 día
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                ]
              : []),
            // Imágenes (de cualquier origen) → cache-first, con expiración.
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'kohtun-images',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 días
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Hojas de estilo de Google Fonts → stale-while-revalidate.
            {
              urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-stylesheets' },
            },
            // Archivos de fuente de Google Fonts → cache-first (rara vez cambian).
            {
              urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 año
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          // Permite probar el service worker en `npm run dev`
          enabled: true,
        },
        manifest: {
          // `id` estable de la app: PWABuilder recomienda usar el mismo valor
          // que `start_url` para identificar la instalación de forma única.
          id: '/',
          name: 'Kohtun',
          short_name: 'Kohtun',
          description: 'Smart Appointment Scheduling',
          dir: 'ltr',
          categories: ['business', 'productivity'],
          display: 'standalone',
          // `any`: la app se usa tanto en móvil (clientes) como en desktop/tablet
          // (panel del profesional con sidebar y grids), no se fuerza vertical.
          orientation: 'any',
          theme_color: '#1e3a5f',
          background_color: '#ffffff',
          start_url: '/',
          // Capturas reales de la landing (generadas con Playwright headless).
          screenshots: [
            {
              src: '/screenshots/mobile-landing.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Kohtun en móvil',
            },
            {
              src: '/screenshots/desktop-landing.png',
              sizes: '1920x1080',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Kohtun en escritorio',
            },
          ],
          // Accesos directos del icono instalado.
          shortcuts: [
            {
              name: 'Ver agenda',
              short_name: 'Agenda',
              description: 'Abre tu agenda de citas',
              url: '/gestor/agenda',
              icons: [{ src: '/kohtun-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Nueva cita',
              short_name: 'Nueva cita',
              description: 'Reserva una nueva cita',
              url: '/paciente/nueva-cita',
              icons: [{ src: '/kohtun-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
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
  }
})

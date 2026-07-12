/* Manejo de Web Push para Kohtun.
 *
 * Este archivo se importa (importScripts) dentro del service worker que genera
 * vite-plugin-pwa (workbox, estrategia generateSW), para añadir los listeners de
 * push/notificationclick sin tener que escribir el SW completo a mano.
 *
 * El backend envía un payload JSON: { title, body, url }.
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Kohtun', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Kohtun'
  const options = {
    body: data.body || '',
    icon: '/kohtun-192x192.png',
    badge: '/kohtun-192x192.png',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // Si ya hay una ventana de la app abierta, enfócala y navega a la ruta.
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(targetUrl)
          return
        }
      }
      // Si no hay ninguna abierta, abre una ventana nueva.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})

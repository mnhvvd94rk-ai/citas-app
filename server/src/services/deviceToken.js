import crypto from 'node:crypto'

// Token de dispositivo (refresh token opaco) para el login semi-automático del
// cliente por profesional. Se guarda como cookie httpOnly; en la BD solo vive el
// HASH (SHA-256), nunca el valor en claro.
//
// ⚠️ PENDIENTE (infraestructura, NO código) — Cookie de terceros en Safari/iOS:
//   En producción el frontend vive en kohtun.com y este backend en
//   ikatun-server.onrender.com → son dominios distintos, así que la cookie es
//   THIRD-PARTY y Safari/iOS la BLOQUEA por defecto (ITP). En ese caso el
//   login semi-automático NO persiste en iPhone y cae limpiamente al login
//   manual (no se rompe nada). En Chrome/Android/desktop funciona bien.
//   Solución completa: servir el backend bajo un subdominio propio, p.ej.
//   api.kohtun.com (DNS en Namecheap + dominio custom en Render), para que la
//   cookie sea FIRST-PARTY (Domain=.kohtun.com) y funcione también en Safari.
//   Es un cambio de infraestructura/DNS, no de este código.

export const DEVICE_COOKIE = 'kohtun_disp'
export const DEVICE_TTL_DIAS = 90

/** Genera un token opaco y su hash para almacenar. */
export function generarTokenDispositivo() {
  const token = crypto.randomBytes(32).toString('hex')
  return { token, tokenHash: hashToken(token) }
}

/** SHA-256 hex del token (lo que se guarda/consulta en BD). */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

/** Lee el token de dispositivo desde la cookie de la petición (o null). */
export function leerCookieDispositivo(req) {
  const raw = req.headers.cookie || ''
  for (const parte of raw.split(';')) {
    const idx = parte.indexOf('=')
    if (idx === -1) continue
    const k = parte.slice(0, idx).trim()
    if (k === DEVICE_COOKIE) return decodeURIComponent(parte.slice(idx + 1).trim())
  }
  return null
}

/** Opciones de la cookie. Cross-site en prod (SameSite=None; Secure). */
export function opcionesCookie() {
  const prod = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'none' : 'lax',
    maxAge: DEVICE_TTL_DIAS * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

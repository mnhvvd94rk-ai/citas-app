import { IDIOMAS } from '../i18n/messages.js'

/**
 * Middleware global: resuelve el idioma del solicitante en `req.lang` (ES|EN|FR).
 * Prioridad: cabecera `X-Lang` (idioma activo de la UI que envía el frontend) →
 * `Accept-Language` → ES por defecto. Así los mensajes de error de la API salen en
 * el idioma que el usuario está viendo, sin depender de datos hardcodeados.
 */
export function idiomaRequest(req, _res, next) {
  const crudo = String(req.headers['x-lang'] || req.headers['accept-language'] || '')
    .slice(0, 2)
    .toUpperCase()
  req.lang = IDIOMAS.includes(crudo) ? crudo : 'ES'
  next()
}

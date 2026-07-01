import { verifyToken } from '../services/authService.js'

/**
 * Middleware: exige un JWT válido en el header `Authorization: Bearer <token>`.
 * Si es válido, adjunta `req.user = { id, tipo }` (tipo: "PACIENTE" | "MEDICO").
 * Responde 401 si falta el header o el token es inválido/expirado.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token ausente o mal formado' })
  }

  try {
    const payload = verifyToken(token)
    req.user = { id: payload.id, tipo: payload.tipo }
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

/**
 * Middleware factory: exige que `req.user.tipo` coincida con `tipo`.
 * Debe usarse después de `requireAuth`. Responde 403 si no coincide.
 * @param {"PACIENTE"|"MEDICO"} tipo
 */
export function requireRole(tipo) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' })
    }
    if (req.user.tipo !== tipo) {
      return res.status(403).json({ error: 'No autorizado para este recurso' })
    }
    next()
  }
}

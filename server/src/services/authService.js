import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const SALT_ROUNDS = 12

/**
 * Hashea una contraseña en texto plano con bcrypt.
 * @param {string} plain
 * @returns {Promise<string>} hash listo para almacenar
 */
export function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/**
 * Compara una contraseña en texto plano contra un hash bcrypt.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>} true si coinciden
 */
export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

/**
 * Firma un JWT con el payload dado. Lee secreto y expiración de entorno
 * (JWT_SECRET, JWT_EXPIRES_IN) en tiempo de llamada.
 * @param {object} payload p.ej. { id, tipo }
 * @returns {string} token firmado
 */
export function signToken(payload) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no está definido en el entorno')
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

/**
 * Verifica y decodifica un JWT. Lanza si el token es inválido o expiró.
 * @param {string} token
 * @returns {object} payload decodificado (p.ej. { id, tipo, iat, exp })
 */
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no está definido en el entorno')
  return jwt.verify(token, secret)
}

/**
 * Firma un token de activación de cuenta (cliente importado), válido 24h.
 * Lleva `purpose: 'activacion'` para no ser confundible con un token de sesión.
 * @param {number} usuarioId
 * @returns {string} token firmado
 */
export function signActivationToken(usuarioId) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no está definido en el entorno')
  return jwt.sign({ id: usuarioId, purpose: 'activacion' }, secret, { expiresIn: '24h' })
}

/**
 * Verifica un token de activación. Lanza si es inválido, expiró o no es de
 * activación.
 * @param {string} token
 * @returns {{ id: number, purpose: string, iat: number, exp: number }}
 */
export function verifyActivationToken(token) {
  const payload = verifyToken(token)
  if (payload.purpose !== 'activacion') throw new Error('El token no es de activación')
  return payload
}

# Revisión — Módulo de Autenticación

Contenido literal de los tres archivos del módulo de auth, copiado tal cual está en disco.

## server/src/services/authService.js

```js
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
```

## server/src/middleware/authMiddleware.js

```js
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
```

## server/src/routes/authRoutes.js

```js
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { hashPassword, verifyPassword, signToken } from '../services/authService.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// ── Esquemas de validación (zod) ────────────────────────────────────────────
const registroPacienteSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  documentoIdentidad: z.string().min(1),
  telefono: z.string().min(1),
  correo: z.string().email(),
  password: z.string().min(6),
  fotoIdentidadUrl: z.string().url().optional(),
  firmaUrl: z.string().url().optional(),
})

const registroMedicoSchema = z.object({
  nombre: z.string().min(1),
  especialidad: z.string().min(1),
  correo: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
})

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Valida `body` contra `schema`; si falla, responde 400 y devuelve null. */
function parseOr400(schema, body, res) {
  const result = schema.safeParse(body)
  if (!result.success) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalles: result.error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message,
      })),
    })
    return null
  }
  return result.data
}

/** Quita passwordHash de un registro de Usuario/Medico. */
function sinPassword(row) {
  if (!row) return row
  const { passwordHash, ...rest } = row
  return rest
}

// ── Rutas ──────────────────────────────────────────────────────────────────
// POST /auth/registro-paciente
router.post('/registro-paciente', async (req, res) => {
  const data = parseOr400(registroPacienteSchema, req.body, res)
  if (!data) return

  try {
    const passwordHash = await hashPassword(data.password)
    const usuario = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        documentoIdentidad: data.documentoIdentidad,
        telefono: data.telefono,
        correo: data.correo,
        passwordHash,
        fotoIdentidadUrl: data.fotoIdentidadUrl,
        firmaUrl: data.firmaUrl,
        estado: 'NUEVO',
      },
    })
    const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
    res.status(201).json({ token, usuario: sinPassword(usuario) })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Correo o documento ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno al registrar paciente' })
  }
})

// POST /auth/registro-medico  (abierto en dev; se protegerá más adelante)
router.post('/registro-medico', async (req, res) => {
  const data = parseOr400(registroMedicoSchema, req.body, res)
  if (!data) return

  try {
    const passwordHash = await hashPassword(data.password)
    const medico = await prisma.medico.create({
      data: {
        nombre: data.nombre,
        especialidad: data.especialidad,
        correo: data.correo,
        passwordHash,
      },
    })
    const token = signToken({ id: medico.id, tipo: 'MEDICO' })
    res.status(201).json({ token, medico: sinPassword(medico) })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Correo ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno al registrar médico' })
  }
})

// POST /auth/login-paciente
router.post('/login-paciente', async (req, res) => {
  const data = parseOr400(loginSchema, req.body, res)
  if (!data) return

  const usuario = await prisma.usuario.findUnique({ where: { correo: data.correo } })
  if (!usuario || !(await verifyPassword(data.password, usuario.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  res.json({ token, usuario: sinPassword(usuario) })
})

// POST /auth/login-medico
router.post('/login-medico', async (req, res) => {
  const data = parseOr400(loginSchema, req.body, res)
  if (!data) return

  const medico = await prisma.medico.findUnique({ where: { correo: data.correo } })
  if (!medico || !(await verifyPassword(data.password, medico.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  const token = signToken({ id: medico.id, tipo: 'MEDICO' })
  res.json({ token, medico: sinPassword(medico) })
})

// GET /auth/me  (protegida — verifica el middleware)
router.get('/me', requireAuth, async (req, res) => {
  const { id, tipo } = req.user
  if (tipo === 'PACIENTE') {
    const usuario = await prisma.usuario.findUnique({ where: { id } })
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    return res.json({ tipo, usuario: sinPassword(usuario) })
  }
  if (tipo === 'MEDICO') {
    const medico = await prisma.medico.findUnique({ where: { id } })
    if (!medico) return res.status(404).json({ error: 'Médico no encontrado' })
    return res.json({ tipo, medico: sinPassword(medico) })
  }
  return res.status(400).json({ error: 'Tipo de usuario desconocido' })
})

export default router
```

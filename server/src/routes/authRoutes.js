import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import {
  hashPassword,
  verifyPassword,
  signToken,
  signActivationToken,
  verifyActivationToken,
} from '../services/authService.js'
import { enviarEmailActivacion } from '../services/emailService.js'
import { requireAuth } from '../middleware/authMiddleware.js'

// Base del frontend para construir el enlace de activación.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://citas-app-client.vercel.app'

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
  telefono: z.string().min(1).optional(),
  correo: z.string().email(),
  password: z.string().min(6),
  costoCancelacion: z.number().min(0).optional(),
  diasAnticipacionRequierida: z.number().int().min(0).optional(),
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
        telefono: data.telefono,
        correo: data.correo,
        passwordHash,
        ...(data.costoCancelacion !== undefined && { costoCancelacion: data.costoCancelacion }),
        ...(data.diasAnticipacionRequierida !== undefined && {
          diasAnticipacionRequierida: data.diasAnticipacionRequierida,
        }),
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
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  // Cuenta importada aún sin activar: mensaje claro y código para el frontend.
  if (!usuario.cuentaActivada) {
    return res.status(403).json({
      error: 'Esta cuenta aún no está activada. Revisa tu correo o solicita activarla.',
      code: 'CUENTA_NO_ACTIVADA',
    })
  }
  if (!usuario.passwordHash || !(await verifyPassword(data.password, usuario.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  res.json({ token, usuario: sinPassword(usuario) })
})

// POST /auth/activar-cuenta  — solicita el email con el enlace de activación.
// Respuesta genérica (no revela si el correo existe) salvo el caso de que la
// cuenta ya esté activada, donde conviene un mensaje útil.
const activarSchema = z.object({ correo: z.string().email() })

router.post('/activar-cuenta', async (req, res) => {
  const data = parseOr400(activarSchema, req.body, res)
  if (!data) return

  const correo = data.correo.toLowerCase()
  const usuario = await prisma.usuario.findUnique({ where: { correo } })

  // Solo enviamos si existe y aún no está activada. En cualquier otro caso
  // devolvemos el mismo 200 para no filtrar qué correos están registrados.
  if (usuario && !usuario.cuentaActivada) {
    const token = signActivationToken(usuario.id)
    const link = `${FRONTEND_URL}/activar-cuenta?token=${encodeURIComponent(token)}`
    const r = await enviarEmailActivacion({ correo: usuario.correo, nombre: usuario.nombre, link })
    if (!r.ok) {
      console.error('[activar-cuenta] No se pudo enviar el email:', r.error)
      return res.status(502).json({ error: 'No se pudo enviar el correo de activación. Inténtalo más tarde.' })
    }
  }

  res.json({ ok: true, mensaje: 'Si el correo corresponde a una cuenta pendiente, te hemos enviado un enlace de activación.' })
})

// POST /auth/completar-activacion  — el cliente define su contraseña.
const completarSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

router.post('/completar-activacion', async (req, res) => {
  const data = parseOr400(completarSchema, req.body, res)
  if (!data) return

  let payload
  try {
    payload = verifyActivationToken(data.token)
  } catch {
    return res.status(400).json({ error: 'El enlace de activación no es válido o ha caducado.' })
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } })
  if (!usuario) {
    return res.status(404).json({ error: 'Cuenta no encontrada.' })
  }
  if (usuario.cuentaActivada) {
    return res.status(409).json({ error: 'Esta cuenta ya está activada. Inicia sesión con tu contraseña.' })
  }

  const passwordHash = await hashPassword(data.password)
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash, cuentaActivada: true },
  })

  res.json({ ok: true, mensaje: 'Cuenta activada. Ya puedes iniciar sesión.' })
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

// PATCH /auth/me — el cliente guarda su idioma preferido (para notificaciones).
const patchMeSchema = z.object({ idiomaPreferido: z.enum(['ES', 'EN', 'FR']) })

router.patch('/me', requireAuth, async (req, res) => {
  const { id, tipo } = req.user
  if (tipo !== 'PACIENTE') {
    return res.status(400).json({ error: 'Solo los clientes guardan idioma preferido' })
  }
  const data = parseOr400(patchMeSchema, req.body, res)
  if (!data) return

  const usuario = await prisma.usuario.update({
    where: { id },
    data: { idiomaPreferido: data.idiomaPreferido },
  })
  res.json({ tipo, usuario: sinPassword(usuario) })
})

export default router

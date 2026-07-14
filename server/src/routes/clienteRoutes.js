import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { signToken } from '../services/authService.js'
import {
  DEVICE_COOKIE,
  DEVICE_TTL_DIAS,
  generarTokenDispositivo,
  opcionesCookie,
} from '../services/deviceToken.js'

const router = Router()

function sinPassword(row) {
  if (!row) return row
  const { passwordHash, ...resto } = row
  return resto
}

// Cookie de dispositivo para el login semi-automático (solo si hay profesional).
async function emitirDispositivo(res, clienteId, profesionalId) {
  if (!profesionalId) return
  const { token, tokenHash } = generarTokenDispositivo()
  const expiraEn = new Date(Date.now() + DEVICE_TTL_DIAS * 24 * 60 * 60 * 1000)
  await prisma.dispositivoCliente.create({ data: { tokenHash, clienteId, profesionalId, expiraEn } })
  res.cookie(DEVICE_COOKIE, token, opcionesCookie())
}

// Todas las cuentas de cliente que comparten el MISMO identificador (correo o
// teléfono) que la cuenta autenticada. El correo es único global (solo se coincide
// a sí misma), así que el caso multi-cuenta lo dispara el teléfono compartido.
// Reutiliza la misma idea que la desambiguación del login por credenciales.
async function cuentasHermanas(userId) {
  const yo = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { correo: true, telefono: true },
  })
  if (!yo) return []
  return prisma.usuario.findMany({
    where: {
      cuentaActivada: true,
      OR: [{ correo: yo.correo }, { telefono: yo.telefono }],
    },
    select: { id: true, profesionalId: true, profesional: { select: { nombre: true, slug: true } } },
    orderBy: { id: 'asc' },
  })
}

// GET /clientes/mis-profesionales — lista de profesionales del cliente logueado.
router.get('/mis-profesionales', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const cuentas = await cuentasHermanas(req.user.id)
  res.json({
    profesionales: cuentas
      .filter((c) => c.profesionalId)
      .map((c) => ({
        clienteId: c.id,
        profesionalId: c.profesionalId,
        nombre: c.profesional?.nombre || '—',
        slug: c.profesional?.slug || null,
        actual: c.id === req.user.id,
      })),
  })
})

// POST /clientes/cambiar-profesional — cambia la sesión a otra cuenta del mismo
// identificador, sin pedir contraseña. Valida que la cuenta destino realmente
// pertenece al identificador ya autenticado (no se puede saltar a una ajena).
const cambiarSchema = z.object({ profesionalId: z.number().int() })
router.post('/cambiar-profesional', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const parsed = cambiarSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })

  const cuentas = await cuentasHermanas(req.user.id)
  const destino = cuentas.find((c) => c.profesionalId === parsed.data.profesionalId)
  if (!destino) {
    return res.status(404).json({ error: 'No tienes una cuenta con ese profesional.', code: 'CUENTA_NO_ENCONTRADA' })
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: destino.id } })
  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  await emitirDispositivo(res, usuario.id, usuario.profesionalId)
  res.json({ token, usuario: sinPassword(usuario) })
})

export default router

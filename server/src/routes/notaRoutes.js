import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { tr } from '../i18n/messages.js'

const router = Router()

// Todas las rutas de notas son exclusivas del médico autenticado.
router.use(requireAuth, requireRole('MEDICO'))

/** Valida `body` contra `schema`; si falla, responde 400 y devuelve null. */
function parseOr400(schema, req, res) {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: result.error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message,
      })),
    })
    return null
  }
  return result.data
}

const crearNotaSchema = z.object({
  pacienteId: z.number().int().positive(),
  texto: z.string().min(1, 'El texto es obligatorio'),
})

// ── POST /notas ──────────────────────────────────────────────────────────────
// Crea una nota en el historial de un paciente. medicoId sale del token.
router.post('/', async (req, res) => {
  const data = parseOr400(crearNotaSchema, req, res)
  if (!data) return

  const paciente = await prisma.usuario.findUnique({ where: { id: data.pacienteId } })
  if (!paciente) {
    return res.status(404).json({ error: tr(req.lang, 'error.pacienteNoEncontrado') })
  }
  // Solo el profesional dueño del cliente puede añadirle notas.
  if (paciente.profesionalId !== req.user.id) {
    return res.status(403).json({ error: tr(req.lang, 'error.clienteAjeno') })
  }

  const nota = await prisma.notaPaciente.create({
    data: { pacienteId: data.pacienteId, medicoId: req.user.id, texto: data.texto },
    include: { medico: { select: { id: true, nombre: true } } },
  })
  res.status(201).json(nota)
})

// ── GET /notas/:pacienteId ───────────────────────────────────────────────────
// Historial de notas del paciente (más recientes primero).
router.get('/:pacienteId', async (req, res) => {
  const pacienteId = Number(req.params.pacienteId)
  if (!Number.isInteger(pacienteId)) {
    return res.status(400).json({ error: tr(req.lang, 'error.pacienteIdInvalido') })
  }
  // Solo el profesional dueño del cliente puede leer su historial de notas.
  const paciente = await prisma.usuario.findUnique({
    where: { id: pacienteId },
    select: { profesionalId: true },
  })
  if (!paciente) return res.status(404).json({ error: tr(req.lang, 'error.clienteNoEncontrado') })
  if (paciente.profesionalId !== req.user.id) {
    return res.status(403).json({ error: tr(req.lang, 'error.clienteAjeno') })
  }
  const notas = await prisma.notaPaciente.findMany({
    where: { pacienteId },
    include: { medico: { select: { id: true, nombre: true } } },
    orderBy: { fecha: 'desc' },
  })
  res.json(notas)
})

export default router

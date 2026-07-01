import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'

const router = Router()

// Todas las rutas de pacientes son exclusivas del médico autenticado.
router.use(requireAuth, requireRole('MEDICO'))

// Nunca exponer passwordHash.
const PACIENTE_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  documentoIdentidad: true,
  telefono: true,
  correo: true,
  estado: true,
  fechaRegistro: true,
}

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

const notaSchema = z.object({ texto: z.string().min(1, 'El texto es obligatorio') })

// ── GET /pacientes ───────────────────────────────────────────────────────────
// Lista todos los pacientes (sin passwordHash).
router.get('/', async (req, res) => {
  const pacientes = await prisma.usuario.findMany({
    select: PACIENTE_SELECT,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  res.json(pacientes)
})

// ── GET /pacientes/:id/notas ─────────────────────────────────────────────────
// Historial de notas del paciente (más recientes primero).
router.get('/:id/notas', async (req, res) => {
  const pacienteId = Number(req.params.id)
  if (!Number.isInteger(pacienteId)) {
    return res.status(400).json({ error: 'id inválido' })
  }
  const notas = await prisma.notaPaciente.findMany({
    where: { pacienteId },
    include: { medico: { select: { id: true, nombre: true } } },
    orderBy: { fecha: 'desc' },
  })
  res.json(notas)
})

// ── POST /pacientes/:id/notas ────────────────────────────────────────────────
// Agrega una nota libre al historial del paciente.
router.post('/:id/notas', async (req, res) => {
  const pacienteId = Number(req.params.id)
  if (!Number.isInteger(pacienteId)) {
    return res.status(400).json({ error: 'id inválido' })
  }
  const data = parseOr400(notaSchema, req.body, res)
  if (!data) return

  const paciente = await prisma.usuario.findUnique({ where: { id: pacienteId } })
  if (!paciente) {
    return res.status(404).json({ error: 'Paciente no encontrado' })
  }

  const nota = await prisma.notaPaciente.create({
    data: { pacienteId, medicoId: req.user.id, texto: data.texto },
    include: { medico: { select: { id: true, nombre: true } } },
  })
  res.status(201).json(nota)
})

export default router

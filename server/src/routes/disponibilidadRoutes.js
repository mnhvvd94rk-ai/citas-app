import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { generarSlots, slotsDisponibles } from '../services/slotEngine.js'

const router = Router()

// Todas las rutas de disponibilidad son exclusivas del médico autenticado.
router.use(requireAuth, requireRole('MEDICO'))

// ── Helpers ──────────────────────────────────────────────────────────────────
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** "YYYY-MM-DD" -> Date a medianoche UTC (consistente con el slotEngine). */
function parseFecha(s) {
  return new Date(`${s}T00:00:00.000Z`)
}

/** "HH:mm" -> minutos desde medianoche. */
function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
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

// ── Esquemas ─────────────────────────────────────────────────────────────────
const crearDisponibilidadSchema = z
  .object({
    fecha: z.string().regex(FECHA_RE, 'Formato esperado YYYY-MM-DD'),
    horaInicio: z.string().regex(HORA_RE, 'Formato esperado HH:mm'),
    horaFin: z.string().regex(HORA_RE, 'Formato esperado HH:mm'),
  })
  .refine((d) => aMinutos(d.horaFin) > aMinutos(d.horaInicio), {
    message: 'horaFin debe ser mayor que horaInicio',
    path: ['horaFin'],
  })
  .refine((d) => aMinutos(d.horaFin) - aMinutos(d.horaInicio) >= 45, {
    message: 'El rango debe ser de al menos 45 minutos',
    path: ['horaFin'],
  })

// ── POST /disponibilidad ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const data = parseOr400(crearDisponibilidadSchema, req.body, res)
  if (!data) return

  const disponibilidad = await prisma.disponibilidad.create({
    data: {
      medicoId: req.user.id,
      fecha: parseFecha(data.fecha),
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
    },
  })
  res.status(201).json(disponibilidad)
})

// ── GET /disponibilidad ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { fecha, desde, hasta } = req.query
  const where = { medicoId: req.user.id }

  if (fecha && FECHA_RE.test(fecha)) {
    where.fecha = parseFecha(fecha)
  } else if (desde || hasta) {
    where.fecha = {}
    if (desde && FECHA_RE.test(desde)) where.fecha.gte = parseFecha(desde)
    if (hasta && FECHA_RE.test(hasta)) where.fecha.lte = parseFecha(hasta)
  }

  const disponibilidades = await prisma.disponibilidad.findMany({
    where,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })
  res.json(disponibilidades)
})

// ── DELETE /disponibilidad/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' })
  }

  const disponibilidad = await prisma.disponibilidad.findUnique({ where: { id } })
  if (!disponibilidad) {
    return res.status(404).json({ error: 'Disponibilidad no encontrada' })
  }
  if (disponibilidad.medicoId !== req.user.id) {
    return res.status(403).json({ error: 'Esta disponibilidad no te pertenece' })
  }

  // Citas activas del médico en esa fecha.
  const citas = await prisma.cita.findMany({
    where: { medicoId: req.user.id, fecha: disponibilidad.fecha },
  })

  // Slots del rango y slots que siguen libres tras descontar citas activas.
  const totalSlots = generarSlots(disponibilidad).length
  const libres = slotsDisponibles([disponibilidad], citas, disponibilidad.fecha).length
  const ocupados = totalSlots - libres

  if (ocupados > 0) {
    return res.status(409).json({
      error: `No se puede eliminar: hay ${ocupados} slot(s) con citas activas (PENDIENTE o CONFIRMADA) dentro de este rango.`,
    })
  }

  await prisma.disponibilidad.delete({ where: { id } })
  res.json({ ok: true, eliminada: id })
})

export default router

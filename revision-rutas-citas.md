# Revisión — Rutas de Disponibilidad y Citas

Contenido literal de los dos archivos de rutas que consumen el slotEngine, copiado tal cual está en disco.

## server/src/routes/disponibilidadRoutes.js

```js
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
```

## server/src/routes/citaRoutes.js

```js
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { slotsDisponibles, validarReserva } from '../services/slotEngine.js'

const router = Router()

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

// Selecciones reutilizables (nunca exponen passwordHash).
const MEDICO_BASICO = { id: true, nombre: true, especialidad: true }
const PACIENTE_BASICO = {
  id: true,
  nombre: true,
  apellido: true,
  documentoIdentidad: true,
  estado: true,
}

// ── Esquemas ─────────────────────────────────────────────────────────────────
const slotSchema = z.object({
  horaInicio: z.string().regex(HORA_RE),
  horaFin: z.string().regex(HORA_RE),
})

const reservarSchema = z.object({
  medicoId: z.number().int().positive(),
  fecha: z.string().regex(FECHA_RE, 'Formato esperado YYYY-MM-DD'),
  slotsElegidos: z.array(slotSchema).min(1),
  motivoConsulta: z.string().min(1).optional(),
})

const anularSchema = z.object({
  notaAnulacion: z.string().min(1, 'notaAnulacion es obligatoria'),
})

// ── GET /citas/slots-disponibles ─────────────────────────────────────────────
// Cualquier usuario autenticado (paciente o médico).
router.get('/slots-disponibles', requireAuth, async (req, res) => {
  const medicoId = Number(req.query.medicoId)
  const fecha = req.query.fecha

  if (!Number.isInteger(medicoId) || medicoId <= 0) {
    return res.status(400).json({ error: 'medicoId es obligatorio y debe ser un entero' })
  }
  if (!fecha || !FECHA_RE.test(fecha)) {
    return res.status(400).json({ error: 'fecha es obligatoria (YYYY-MM-DD)' })
  }

  const fechaDate = parseFecha(fecha)
  const [disponibilidades, citas] = await Promise.all([
    prisma.disponibilidad.findMany({ where: { medicoId, fecha: fechaDate } }),
    prisma.cita.findMany({ where: { medicoId, fecha: fechaDate } }),
  ])

  const libres = slotsDisponibles(disponibilidades, citas, fechaDate)
  res.json({ medicoId, fecha, slots: libres })
})

// ── POST /citas/reservar ─────────────────────────────────────────────────────
router.post('/reservar', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const data = parseOr400(reservarSchema, req.body, res)
  if (!data) return

  // a) Estado del paciente: se lee de la BD, no del body.
  const paciente = await prisma.usuario.findUnique({ where: { id: req.user.id } })
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' })

  // b) Paciente NUEVO requiere motivo de consulta.
  if (paciente.estado === 'NUEVO' && !data.motivoConsulta) {
    return res
      .status(400)
      .json({ error: 'Un paciente nuevo debe indicar el motivo de consulta' })
  }

  // c) Disponibilidades y citas del médico para esa fecha.
  const fechaDate = parseFecha(data.fecha)
  const [disponibilidades, citas] = await Promise.all([
    prisma.disponibilidad.findMany({ where: { medicoId: data.medicoId, fecha: fechaDate } }),
    prisma.cita.findMany({ where: { medicoId: data.medicoId, fecha: fechaDate } }),
  ])

  // d) Slots libres + e) validación de reglas de negocio.
  const libres = slotsDisponibles(disponibilidades, citas, fechaDate)
  const validacion = validarReserva({
    tipoPaciente: paciente.estado,
    slotsElegidos: data.slotsElegidos,
    slotsDisponibles: libres,
  })

  // f) Rechazo con el mensaje del slotEngine.
  if (!validacion.valido) {
    return res.status(400).json({ error: validacion.error })
  }

  // g) Calcula horaInicio/horaFin/numeroSlots a partir de los slots elegidos.
  const ordenados = [...data.slotsElegidos].sort(
    (a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio),
  )
  const horaInicio = ordenados[0].horaInicio
  const horaFin = ordenados[ordenados.length - 1].horaFin
  const numeroSlots = ordenados.length

  // h) Estado inicial según tipo de paciente.
  const estado = paciente.estado === 'NUEVO' ? 'PENDIENTE' : 'CONFIRMADA'

  // i) Crea la cita.
  const cita = await prisma.cita.create({
    data: {
      pacienteId: paciente.id,
      medicoId: data.medicoId,
      fecha: fechaDate,
      horaInicio,
      horaFin,
      numeroSlots,
      estado,
      motivoConsulta: paciente.estado === 'NUEVO' ? data.motivoConsulta : null,
    },
  })
  res.status(201).json(cita)
})

// ── GET /citas/mis-citas ─────────────────────────────────────────────────────
router.get('/mis-citas', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const citas = await prisma.cita.findMany({
    where: { pacienteId: req.user.id },
    include: { medico: { select: MEDICO_BASICO } },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })
  res.json(citas)
})

// ── GET /citas/agenda ────────────────────────────────────────────────────────
router.get('/agenda', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const where = { medicoId: req.user.id }
  if (req.query.fecha && FECHA_RE.test(req.query.fecha)) {
    where.fecha = parseFecha(req.query.fecha)
  }
  if (req.query.estado) {
    where.estado = req.query.estado
  }

  const citas = await prisma.cita.findMany({
    where,
    include: { paciente: { select: PACIENTE_BASICO } },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })
  res.json(citas)
})

// ── Helper de transición de estado (médico dueño de la cita) ──────────────────
/**
 * Carga una cita y verifica que pertenezca al médico. Responde y devuelve null
 * si no existe (404) o no le pertenece (403).
 */
async function cargarCitaPropia(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id inválido' })
    return null
  }
  const cita = await prisma.cita.findUnique({ where: { id } })
  if (!cita) {
    res.status(404).json({ error: 'Cita no encontrada' })
    return null
  }
  if (cita.medicoId !== req.user.id) {
    res.status(403).json({ error: 'Esta cita no te pertenece' })
    return null
  }
  return cita
}

// ── PATCH /citas/:id/aprobar ─────────────────────────────────────────────────
router.patch('/:id/aprobar', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const cita = await cargarCitaPropia(req, res)
  if (!cita) return

  if (cita.estado !== 'PENDIENTE') {
    return res
      .status(409)
      .json({ error: `Solo se pueden aprobar citas PENDIENTE (estado actual: ${cita.estado})` })
  }

  const actualizada = await prisma.cita.update({
    where: { id: cita.id },
    data: { estado: 'CONFIRMADA' },
  })
  res.json(actualizada)
})

// ── PATCH /citas/:id/anular ──────────────────────────────────────────────────
router.patch('/:id/anular', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const data = parseOr400(anularSchema, req.body, res)
  if (!data) return

  const cita = await cargarCitaPropia(req, res)
  if (!cita) return

  if (!['PENDIENTE', 'CONFIRMADA'].includes(cita.estado)) {
    return res.status(409).json({
      error: `Solo se pueden anular citas PENDIENTE o CONFIRMADA (estado actual: ${cita.estado})`,
    })
  }

  const actualizada = await prisma.cita.update({
    where: { id: cita.id },
    data: { estado: 'ANULADA', notaAnulacion: data.notaAnulacion },
  })
  // TODO: disparar notificación al paciente (se implementará después).
  res.json(actualizada)
})

// ── PATCH /citas/:id/completar ───────────────────────────────────────────────
router.patch('/:id/completar', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const cita = await cargarCitaPropia(req, res)
  if (!cita) return

  if (cita.estado !== 'CONFIRMADA') {
    return res.status(409).json({
      error: `Solo se pueden completar citas CONFIRMADA (estado actual: ${cita.estado})`,
    })
  }

  // Completa la cita y, si el paciente era NUEVO, lo promueve a CONTINUIDAD
  // (transición automática, CONTEXT.md §5.4). Atómico.
  const [actualizada] = await prisma.$transaction([
    prisma.cita.update({ where: { id: cita.id }, data: { estado: 'COMPLETADA' } }),
    prisma.usuario.updateMany({
      where: { id: cita.pacienteId, estado: 'NUEVO' },
      data: { estado: 'CONTINUIDAD' },
    }),
  ])
  res.json(actualizada)
})

export default router
```

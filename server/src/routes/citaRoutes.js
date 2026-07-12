import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { slotsDisponibles, validarReserva } from '../services/slotEngine.js'
import notificationService from '../services/notificationService.js'

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

/** minutos desde medianoche -> "HH:mm". */
function aHora(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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
  tipoCita: z.enum(['PRESENCIAL', 'VIDEOCONFERENCIA']).optional(),
})

/** Enlace único de Jitsi Meet para una cita de videoconferencia. */
function generarEnlaceVideo(citaId) {
  const random = Math.random().toString(36).slice(2, 8) // 6 caracteres alfanuméricos
  return `https://meet.jit.si/kohtun-${citaId}-${random}`
}

const anularSchema = z.object({
  notaAnulacion: z.string().min(1, 'notaAnulacion es obligatoria'),
})

// ── GET /citas/slots-disponibles ─────────────────────────────────────────────
// El profesional se determina SIEMPRE en el servidor a partir del usuario
// autenticado (nunca del query), para que un cliente solo pueda ver la
// disponibilidad de su propio profesional:
//   - PACIENTE → su profesionalId.
//   - MEDICO   → su propio id.
// El `medicoId` del query se ignora (defensa: no permite espiar a otro profesional).
router.get('/slots-disponibles', requireAuth, async (req, res) => {
  const fecha = req.query.fecha

  let medicoId
  if (req.user.tipo === 'PACIENTE') {
    const cliente = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { profesionalId: true },
    })
    if (!cliente?.profesionalId) {
      return res.status(404).json({
        error: 'Tu cuenta no está vinculada a ningún profesional.',
        code: 'SIN_PROFESIONAL',
      })
    }
    medicoId = cliente.profesionalId
  } else {
    medicoId = req.user.id
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

  // a.2) El profesional se determina por el vínculo del cliente, NO por el body.
  //      Así un cliente solo puede reservar con su propio profesional aunque
  //      manipule el medicoId enviado.
  if (!paciente.profesionalId) {
    return res.status(400).json({
      error: 'Tu cuenta no está vinculada a ningún profesional.',
      code: 'SIN_PROFESIONAL',
    })
  }
  if (data.medicoId !== paciente.profesionalId) {
    return res.status(403).json({ error: 'No puedes reservar con este profesional.' })
  }
  const medicoId = paciente.profesionalId

  // b) Paciente NUEVO requiere motivo de consulta.
  if (paciente.estado === 'NUEVO' && !data.motivoConsulta) {
    return res
      .status(400)
      .json({ error: 'Un paciente nuevo debe indicar el motivo de consulta' })
  }

  // c) Disponibilidades y citas del médico para esa fecha.
  const fechaDate = parseFecha(data.fecha)
  const [disponibilidades, citas] = await Promise.all([
    prisma.disponibilidad.findMany({ where: { medicoId, fecha: fechaDate } }),
    prisma.cita.findMany({ where: { medicoId, fecha: fechaDate } }),
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

  // h.2) Penalización por cancelación: se copia de la configuración del médico.
  //      Si la cita es doble (2 slots), la anticipación requerida se dobla.
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { costoCancelacion: true, diasAnticipacionRequierida: true },
  })
  const esDoble = numeroSlots === 2
  const costoCancelacion = medico?.costoCancelacion ?? 0
  const diasAnticipacionRequierida = (medico?.diasAnticipacionRequierida ?? 7) * (esDoble ? 2 : 1)

  // i) Crea la cita.
  const tipoCita = data.tipoCita === 'VIDEOCONFERENCIA' ? 'VIDEOCONFERENCIA' : 'PRESENCIAL'
  let cita = await prisma.cita.create({
    data: {
      pacienteId: paciente.id,
      medicoId,
      fecha: fechaDate,
      horaInicio,
      horaFin,
      numeroSlots,
      estado,
      motivoConsulta: paciente.estado === 'NUEVO' ? data.motivoConsulta : null,
      costoCancelacion,
      diasAnticipacionRequierida,
      esDoble,
      tipoCita,
    },
  })

  // j) Si es videoconferencia, genera el enlace único (usa el id ya creado).
  if (tipoCita === 'VIDEOCONFERENCIA') {
    cita = await prisma.cita.update({
      where: { id: cita.id },
      data: { enlaceVideoconferencia: generarEnlaceVideo(cita.id) },
    })
  }

  res.status(201).json(cita)
})

// ── POST /citas/crear-manual ─────────────────────────────────────────────────
// El profesional agenda una cita para uno de SUS clientes, sin que el cliente
// la reserve. Nace CONFIRMADA (no necesita aprobación). Los recordatorios
// automáticos (48/24/3h) la toman igual que a cualquier cita CONFIRMADA.
const crearManualSchema = z.object({
  clienteId: z.number().int().positive(),
  fecha: z.string().regex(FECHA_RE, 'Formato esperado YYYY-MM-DD'),
  horaInicio: z.string().regex(HORA_RE, 'Formato esperado HH:mm'),
  tipoCita: z.enum(['PRESENCIAL', 'VIDEOCONFERENCIA']).optional(),
  // Duración del bloque de esta cita puntual (default 45, el bloque base).
  duracionMinutos: z
    .number()
    .int()
    .min(15, 'La duración mínima es 15 minutos')
    .max(180, 'La duración máxima es 180 minutos')
    .optional()
    .default(45),
})

router.post('/crear-manual', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const data = parseOr400(crearManualSchema, req.body, res)
  if (!data) return

  const medicoId = req.user.id

  // a) El cliente debe pertenecer a este profesional (aislamiento).
  const cliente = await prisma.usuario.findUnique({
    where: { id: data.clienteId },
    select: { id: true, profesionalId: true },
  })
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
  if (cliente.profesionalId !== medicoId) {
    return res.status(403).json({ error: 'Este cliente no te pertenece' })
  }

  // b) Calcula el fin del bloque con la duración elegida. Rechaza si se pasa
  //    de medianoche.
  const inicioMin = aMinutos(data.horaInicio)
  const finMin = inicioMin + data.duracionMinutos
  if (finMin > 24 * 60) {
    return res.status(400).json({ error: 'La hora es demasiado tarde para esa duración.' })
  }
  const horaFin = aHora(finMin)

  // c) No debe solaparse con otra cita activa del profesional ese día.
  const fechaDate = parseFecha(data.fecha)
  const citasDia = await prisma.cita.findMany({
    where: { medicoId, fecha: fechaDate, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
    select: { horaInicio: true, horaFin: true },
  })
  const solapa = citasDia.some(
    (c) => inicioMin < aMinutos(c.horaFin) && aMinutos(c.horaInicio) < finMin,
  )
  if (solapa) {
    return res.status(409).json({
      error: 'Ese horario se solapa con otra cita existente.',
      code: 'HORARIO_OCUPADO',
    })
  }

  // d) Penalización por cancelación copiada del profesional (igual que reservar).
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { costoCancelacion: true, diasAnticipacionRequierida: true },
  })

  // e) Crea la cita CONFIRMADA.
  const tipoCita = data.tipoCita === 'VIDEOCONFERENCIA' ? 'VIDEOCONFERENCIA' : 'PRESENCIAL'
  let cita = await prisma.cita.create({
    data: {
      pacienteId: cliente.id,
      medicoId,
      fecha: fechaDate,
      horaInicio: data.horaInicio,
      horaFin,
      numeroSlots: 1,
      estado: 'CONFIRMADA',
      costoCancelacion: medico?.costoCancelacion ?? 0,
      diasAnticipacionRequierida: medico?.diasAnticipacionRequierida ?? 7,
      esDoble: false,
      tipoCita,
    },
  })

  // f) Videoconferencia: enlace único de Jitsi (mismo flujo que reservar).
  if (tipoCita === 'VIDEOCONFERENCIA') {
    cita = await prisma.cita.update({
      where: { id: cita.id },
      data: { enlaceVideoconferencia: generarEnlaceVideo(cita.id) },
    })
  }

  res.status(201).json(cita)
})

// ── Helper: carga una cita y verifica que sea del paciente autenticado ───────
async function cargarCitaDelPaciente(req, res) {
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
  if (cita.pacienteId !== req.user.id) {
    res.status(403).json({ error: 'Esta cita no te pertenece' })
    return null
  }
  return cita
}

// ── PATCH /citas/:id/cancelar ─── el paciente cancela su propia cita ──────────
router.patch('/:id/cancelar', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const cita = await cargarCitaDelPaciente(req, res)
  if (!cita) return
  if (!['PENDIENTE', 'CONFIRMADA'].includes(cita.estado)) {
    return res.status(409).json({
      error: `Solo puedes cancelar citas PENDIENTE o CONFIRMADA (estado actual: ${cita.estado})`,
    })
  }

  // Penalización: 0 si cancela con la anticipación requerida; si no, el costo.
  // (diasAnticipacionRequierida ya viene doblado si la cita es doble.)
  const hoyUTC = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime()
  const fechaCitaUTC = new Date(cita.fecha.toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime()
  const diasHasta = Math.floor((fechaCitaUTC - hoyUTC) / (24 * 60 * 60 * 1000))

  const conTiempo = diasHasta >= cita.diasAnticipacionRequierida
  const costo = conTiempo ? 0 : cita.costoCancelacion
  const motivo = conTiempo
    ? `Cancelada sin penalización (${cita.diasAnticipacionRequierida} o más días antes)`
    : `Cancelada con penalización de $${cita.costoCancelacion}`

  await prisma.cita.update({
    where: { id: cita.id },
    data: { estado: 'ANULADA', notaAnulacion: motivo },
  })

  res.json({ cancelada: true, costo, motivo })
})

// ── POST /citas/:id/recordar ─── el paciente le recuerda la cita al profesional ─
router.post('/:id/recordar', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const cita = await cargarCitaDelPaciente(req, res)
  if (!cita) return
  // Encola una notificación para el profesional (entrega pendiente de integrar).
  await prisma.notificacion.create({
    data: {
      destinatarioId: cita.medicoId,
      tipoDestinatario: 'MEDICO',
      tipo: 'RECORDATORIO',
      canal: 'PUSH',
      estadoEnvio: 'PENDIENTE',
    },
  })
  res.json({ ok: true })
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
  const { fecha, desde, hasta, estado } = req.query
  if (fecha && FECHA_RE.test(fecha)) {
    where.fecha = parseFecha(fecha)
  } else if (desde || hasta) {
    // Rango de fechas (para la vista de calendario del mes).
    where.fecha = {}
    if (desde && FECHA_RE.test(desde)) where.fecha.gte = parseFecha(desde)
    if (hasta && FECHA_RE.test(hasta)) where.fecha.lte = parseFecha(hasta)
  }
  if (estado) {
    where.estado = estado
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

// ── GET /citas/:id/notas ─────────────────────────────────────────────────────
// Notas vinculadas a una cita concreta (medico dueño de la cita).
router.get('/:id/notas', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const cita = await cargarCitaPropia(req, res)
  if (!cita) return
  const notas = await prisma.notaPaciente.findMany({
    where: { citaId: cita.id },
    include: { medico: { select: { id: true, nombre: true } } },
    orderBy: { fecha: 'desc' },
  })
  res.json(notas)
})

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

  // Notificación best-effort al paciente (no bloquea la anulación).
  const paciente = await prisma.usuario.findUnique({
    where: { id: actualizada.pacienteId },
    select: { id: true, correo: true, telefono: true },
  })
  const noti = await notificationService.send({
    tipo: 'ANULACION',
    canal: 'EMAIL',
    destinatario: {
      id: paciente.id,
      tipoDestinatario: 'PACIENTE',
      correo: paciente.correo,
      telefono: paciente.telefono,
    },
    payload: {
      citaId: actualizada.id,
      fecha: actualizada.fecha.toISOString().slice(0, 10),
      horaInicio: actualizada.horaInicio,
      horaFin: actualizada.horaFin,
      notaAnulacion: actualizada.notaAnulacion,
    },
  })

  res.json({ ...actualizada, notificacion: { enviada: noti.ok } })
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

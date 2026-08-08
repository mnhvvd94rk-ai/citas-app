import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import {
  slotsDisponibles,
  validarReserva,
  slotsCombinados,
  asignarEmpleado,
} from '../services/slotEngine.js'
import notificationService from '../services/notificationService.js'
import { ZONA_HORARIA_DEFAULT } from '../services/timezone.js'
import { tr } from '../i18n/messages.js'

/**
 * Zona horaria con la que se ANCLA una cita: la de la franja de disponibilidad que
 * cubre el slot elegido (donde el profesional definió esa hora de pared). Si no se
 * encuentra franja cubridora, cae a `fallback` (la zona actual del médico/default).
 * Así la cita hereda la zona en que se DEFINIÓ el horario, no la del momento de
 * reservar (que podría diferir si el profesional viajó tras publicar su agenda).
 */
function zonaDeCobertura(disps, horaInicio, horaFin, fallback) {
  const ini = Number(horaInicio.slice(0, 2)) * 60 + Number(horaInicio.slice(3, 5))
  const fin = Number(horaFin.slice(0, 2)) * 60 + Number(horaFin.slice(3, 5))
  const cubridora = (disps || []).find((d) => {
    const dIni = Number(d.horaInicio.slice(0, 2)) * 60 + Number(d.horaInicio.slice(3, 5))
    const dFin = Number(d.horaFin.slice(0, 2)) * 60 + Number(d.horaFin.slice(3, 5))
    return dIni <= ini && fin <= dFin
  })
  return cubridora?.zonaHorariaCreacion || fallback
}

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
  // Solo cuentas Pro: "repetir con X". Si viene, se reserva forzando ESE empleado
  // (sin asignación automática). Se ignora en cuentas normales.
  empleadoId: z.number().int().positive().optional(),
})

/** Enlace único de Jitsi Meet para una cita de videoconferencia. */
function generarEnlaceVideo(citaId) {
  const random = Math.random().toString(36).slice(2, 8) // 6 caracteres alfanuméricos
  return `https://meet.jit.si/kohtun-${citaId}-${random}`
}

const anularSchema = z.object({
  notaAnulacion: z.string().min(1, 'notaAnulacion es obligatoria'),
})

// Determina el profesional cuyo horario puede consultar el usuario autenticado.
// PACIENTE → su profesionalId; MEDICO → su id. Nunca se confía en el query, para
// que un cliente solo vea la disponibilidad de SU profesional (aislamiento).
// Si el cliente no está vinculado, responde 404 y devuelve null.
async function resolverMedicoId(req, res) {
  if (req.user.tipo === 'PACIENTE') {
    const cliente = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { profesionalId: true },
    })
    if (!cliente?.profesionalId) {
      res.status(404).json({
        error: tr(req.lang, 'error.sinProfesional'),
        code: 'SIN_PROFESIONAL',
      })
      return null
    }
    return cliente.profesionalId
  }
  return req.user.id
}

// Datos de perfil del empleado que ve el cliente (nunca datos internos).
const EMPLEADO_BASICO = { id: true, nombre: true, fotoUrl: true, bio: true }

// ── Helpers modo NEGOCIO PRO ─────────────────────────────────────────────────
/**
 * Arma los datos por empleado ACTIVO de un negocio para un día, en la forma que
 * espera el motor (`slotsCombinados` / `asignarEmpleado`). Cada cita bloquea solo
 * al empleado al que está asignada (empleadoId). Si `soloEmpleadoId` se pasa, se
 * restringe a ese empleado (modo "repetir con X").
 * @returns {Array<{ empleadoId:number, disponibilidades:Array, citas:Array }>}
 */
async function cargarEmpleadosDiaData(medicoId, fechaDate, soloEmpleadoId = null) {
  const whereEmpleado = { medicoId, activo: true }
  if (soloEmpleadoId != null) whereEmpleado.id = soloEmpleadoId
  const empleados = await prisma.empleado.findMany({ where: whereEmpleado, select: { id: true } })
  const ids = empleados.map((e) => e.id)
  if (ids.length === 0) return []

  const [disponibilidades, citas] = await Promise.all([
    prisma.disponibilidad.findMany({ where: { medicoId, fecha: fechaDate, empleadoId: { in: ids } } }),
    prisma.cita.findMany({ where: { medicoId, fecha: fechaDate, empleadoId: { in: ids } } }),
  ])

  return ids.map((empleadoId) => ({
    empleadoId,
    disponibilidades: disponibilidades.filter((d) => d.empleadoId === empleadoId),
    citas: citas.filter((c) => c.empleadoId === empleadoId),
  }))
}

/**
 * Valida que `empleadoId` sea un empleado ACTIVO del negocio. Devuelve el empleado
 * (o null) sin responder; el llamador decide el error/código apropiado.
 */
async function empleadoActivoDelNegocio(medicoId, empleadoId) {
  if (empleadoId == null) return null
  const empleado = await prisma.empleado.findFirst({
    where: { id: empleadoId, medicoId, activo: true },
    select: EMPLEADO_BASICO,
  })
  return empleado
}

// ── GET /citas/slots-disponibles ─────────────────────────────────────────────
// Horarios libres de un día concreto (el `medicoId` del query se ignora).
router.get('/slots-disponibles', requireAuth, async (req, res) => {
  const fecha = req.query.fecha
  const medicoId = await resolverMedicoId(req, res)
  if (medicoId === null) return

  if (!fecha || !FECHA_RE.test(fecha)) {
    return res.status(400).json({ error: tr(req.lang, 'error.fechaObligatoria') })
  }

  const fechaDate = parseFecha(fecha)
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { esNegocioPro: true },
  })

  // ── Cuenta NEGOCIO PRO: disponibilidad combinada del equipo (o de un empleado
  //    concreto si se pide con ?empleadoId, para "repetir con X"). ──────────────
  if (medico?.esNegocioPro) {
    const empleadoId = req.query.empleadoId ? Number(req.query.empleadoId) : null
    const empleadosData = await cargarEmpleadosDiaData(medicoId, fechaDate, empleadoId || null)
    const combinados = slotsCombinados(empleadosData, fechaDate)
    const libres = combinados.map((s) => ({ horaInicio: s.horaInicio, horaFin: s.horaFin }))
    return res.json({ medicoId, fecha, slots: libres, empleadoId: empleadoId || null })
  }

  // ── Cuenta normal: comportamiento sin cambios ────────────────────────────────
  const [disponibilidades, citas] = await Promise.all([
    prisma.disponibilidad.findMany({ where: { medicoId, fecha: fechaDate } }),
    prisma.cita.findMany({ where: { medicoId, fecha: fechaDate } }),
  ])

  const libres = slotsDisponibles(disponibilidades, citas, fechaDate)
  res.json({ medicoId, fecha, slots: libres })
})

// ── GET /citas/dias-disponibles?mes=YYYY-MM ──────────────────────────────────
// Resumen ligero para pintar el calendario: qué días del mes tienen al menos un
// slot libre (lista de fechas), no todos los horarios. Mismo aislamiento por
// profesional que slots-disponibles. Excluye días ya pasados.
const MES_RE = /^\d{4}-\d{2}$/

router.get('/dias-disponibles', requireAuth, async (req, res) => {
  const mes = req.query.mes
  if (!mes || !MES_RE.test(mes)) {
    return res.status(400).json({ error: tr(req.lang, 'error.mesObligatorio') })
  }
  const medicoId = await resolverMedicoId(req, res)
  if (medicoId === null) return

  const [anio, m] = mes.split('-').map(Number)
  const primero = parseFecha(`${mes}-01`)
  const ultimoDiaNum = new Date(Date.UTC(anio, m, 0)).getUTCDate() // último día del mes
  const ultimo = parseFecha(`${mes}-${String(ultimoDiaNum).padStart(2, '0')}`)
  const hoy = new Date().toISOString().slice(0, 10)

  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { esNegocioPro: true },
  })

  // ── Cuenta NEGOCIO PRO: días con disponibilidad combinada del equipo (o de un
  //    empleado concreto con ?empleadoId, para "repetir con X"). ────────────────
  if (medico?.esNegocioPro) {
    const empleadoId = req.query.empleadoId ? Number(req.query.empleadoId) : null
    const whereEmpleado = { medicoId, activo: true }
    if (empleadoId) whereEmpleado.id = empleadoId
    const empleados = await prisma.empleado.findMany({ where: whereEmpleado, select: { id: true } })
    const ids = empleados.map((e) => e.id)
    const dias = []
    if (ids.length > 0) {
      const [disponibilidades, citas] = await Promise.all([
        prisma.disponibilidad.findMany({
          where: { medicoId, empleadoId: { in: ids }, fecha: { gte: primero, lte: ultimo } },
        }),
        prisma.cita.findMany({
          where: { medicoId, empleadoId: { in: ids }, fecha: { gte: primero, lte: ultimo } },
        }),
      ])
      // Agrupa por día y, dentro de cada día, por empleado.
      const dispPorDia = {}
      for (const d of disponibilidades) {
        const k = d.fecha.toISOString().slice(0, 10)
        ;(dispPorDia[k] ||= []).push(d)
      }
      const citasPorDia = {}
      for (const c of citas) {
        const k = c.fecha.toISOString().slice(0, 10)
        ;(citasPorDia[k] ||= []).push(c)
      }
      for (const k of Object.keys(dispPorDia)) {
        if (k < hoy) continue
        const empleadosData = ids.map((id) => ({
          empleadoId: id,
          disponibilidades: dispPorDia[k].filter((d) => d.empleadoId === id),
          citas: (citasPorDia[k] || []).filter((c) => c.empleadoId === id),
        }))
        if (slotsCombinados(empleadosData, parseFecha(k)).length > 0) dias.push(k)
      }
    }
    dias.sort()
    return res.json({ mes, dias, empleadoId: empleadoId || null })
  }

  // ── Cuenta normal: comportamiento sin cambios ────────────────────────────────
  const [disponibilidades, citas] = await Promise.all([
    prisma.disponibilidad.findMany({ where: { medicoId, fecha: { gte: primero, lte: ultimo } } }),
    prisma.cita.findMany({ where: { medicoId, fecha: { gte: primero, lte: ultimo } } }),
  ])

  // Agrupa por día (YYYY-MM-DD).
  const dispPorDia = {}
  for (const d of disponibilidades) {
    const k = d.fecha.toISOString().slice(0, 10)
    ;(dispPorDia[k] ||= []).push(d)
  }
  const citasPorDia = {}
  for (const c of citas) {
    const k = c.fecha.toISOString().slice(0, 10)
    ;(citasPorDia[k] ||= []).push(c)
  }

  const dias = []
  for (const k of Object.keys(dispPorDia)) {
    if (k < hoy) continue // los días pasados no se ofrecen
    const libres = slotsDisponibles(dispPorDia[k], citasPorDia[k] || [], parseFecha(k))
    if (libres.length > 0) dias.push(k)
  }
  dias.sort()
  res.json({ mes, dias })
})

// ── POST /citas/reservar ─────────────────────────────────────────────────────
router.post('/reservar', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const data = parseOr400(reservarSchema, req, res)
  if (!data) return

  // a) Estado del paciente: se lee de la BD, no del body.
  const paciente = await prisma.usuario.findUnique({ where: { id: req.user.id } })
  if (!paciente) return res.status(404).json({ error: tr(req.lang, 'error.pacienteNoEncontrado') })

  // a.2) El profesional se determina por el vínculo del cliente, NO por el body.
  //      Así un cliente solo puede reservar con su propio profesional aunque
  //      manipule el medicoId enviado.
  if (!paciente.profesionalId) {
    return res.status(400).json({
      error: tr(req.lang, 'error.sinProfesional'),
      code: 'SIN_PROFESIONAL',
    })
  }
  if (data.medicoId !== paciente.profesionalId) {
    return res.status(403).json({ error: tr(req.lang, 'error.noReservarProfesional') })
  }
  const medicoId = paciente.profesionalId

  // b) Paciente NUEVO requiere motivo de consulta.
  if (paciente.estado === 'NUEVO' && !data.motivoConsulta) {
    return res
      .status(400)
      .json({ error: tr(req.lang, 'error.motivoRequerido') })
  }

  const fechaDate = parseFecha(data.fecha)
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { costoCancelacion: true, diasAnticipacionRequierida: true, esNegocioPro: true, zonaHoraria: true },
  })

  // c/d) Slots libres para esa fecha. Cuenta normal → disponibilidad del médico.
  //      Cuenta Pro → disponibilidad combinada del equipo, o de UN empleado si el
  //      cliente eligió "repetir con X" (data.empleadoId).
  let libres
  let empleadosData = null // solo se rellena en cuenta Pro (para asignación)
  let dispsMedico = null // franjas del médico (cuenta normal), para anclar la zona
  if (medico?.esNegocioPro) {
    // Modo "repetir con X": valida que el empleado sea del negocio y esté activo.
    if (data.empleadoId != null) {
      const empleado = await empleadoActivoDelNegocio(medicoId, data.empleadoId)
      if (!empleado) {
        return res.status(404).json({ error: tr(req.lang, 'error.empleadoNoEncontrado') })
      }
    }
    empleadosData = await cargarEmpleadosDiaData(medicoId, fechaDate, data.empleadoId ?? null)
    libres = slotsCombinados(empleadosData, fechaDate).map((s) => ({
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
    }))
  } else {
    const [disponibilidades, citas] = await Promise.all([
      prisma.disponibilidad.findMany({ where: { medicoId, fecha: fechaDate } }),
      prisma.cita.findMany({ where: { medicoId, fecha: fechaDate } }),
    ])
    dispsMedico = disponibilidades
    libres = slotsDisponibles(disponibilidades, citas, fechaDate)
  }

  // e) Validación de reglas de negocio contra los slots libres correspondientes.
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

  // g.2) Cuenta Pro: determina qué EMPLEADO atiende la cita.
  //      - "Repetir con X" → ese empleado (validarReserva ya garantizó que los
  //        slots elegidos están en SU disponibilidad, incl. ambos si es doble).
  //      - Combinada → asignación automática: primero libre para TODOS los slots,
  //        desempate por menos citas ese día. Si ninguno cubre (p.ej. un doble
  //        que ningún empleado cubre entero) → 409.
  let empleadoId = null
  if (medico?.esNegocioPro) {
    if (data.empleadoId != null) {
      empleadoId = data.empleadoId
    } else {
      empleadoId = asignarEmpleado(empleadosData, data.slotsElegidos, fechaDate)
      if (empleadoId == null) {
        return res.status(409).json({
          error: tr(req.lang, 'error.sinEmpleadoDisponible'),
          code: 'SIN_EMPLEADO_DISPONIBLE',
        })
      }
    }
  }

  // h) Estado inicial según tipo de paciente.
  const estado = paciente.estado === 'NUEVO' ? 'PENDIENTE' : 'CONFIRMADA'

  // h.2) Penalización por cancelación: se copia de la configuración del médico.
  //      Si la cita es doble (2 slots), la anticipación requerida se dobla.
  const esDoble = numeroSlots === 2
  const costoCancelacion = medico?.costoCancelacion ?? 0
  const diasAnticipacionRequierida = (medico?.diasAnticipacionRequierida ?? 7) * (esDoble ? 2 : 1)

  // h.3) Zona horaria con la que se ANCLA la cita (modelo Google Calendar): la de
  //      la franja que definió ese horario (Pro → franja del empleado asignado;
  //      normal → franja del médico). Fallback: zona actual del médico o default.
  //      El recordatorio usará SIEMPRE esta zona, nunca la del profesional al
  //      momento de notificar → la cita no se mueve aunque él viaje.
  const zonaFallback = medico?.zonaHoraria || ZONA_HORARIA_DEFAULT
  const dispsZona = medico?.esNegocioPro
    ? empleadosData?.find((e) => e.empleadoId === empleadoId)?.disponibilidades
    : dispsMedico
  const zonaHorariaCreacion = zonaDeCobertura(dispsZona, horaInicio, horaFin, zonaFallback)

  // i) Crea la cita.
  const tipoCita = data.tipoCita === 'VIDEOCONFERENCIA' ? 'VIDEOCONFERENCIA' : 'PRESENCIAL'
  let cita = await prisma.cita.create({
    data: {
      pacienteId: paciente.id,
      medicoId,
      empleadoId,
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
      zonaHorariaCreacion,
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
  const data = parseOr400(crearManualSchema, req, res)
  if (!data) return

  const medicoId = req.user.id

  // a) El cliente debe pertenecer a este profesional (aislamiento).
  const cliente = await prisma.usuario.findUnique({
    where: { id: data.clienteId },
    select: { id: true, profesionalId: true },
  })
  if (!cliente) return res.status(404).json({ error: tr(req.lang, 'error.clienteNoEncontrado') })
  if (cliente.profesionalId !== medicoId) {
    return res.status(403).json({ error: tr(req.lang, 'error.clienteAjeno') })
  }

  // b) Calcula el fin del bloque con la duración elegida. Rechaza si se pasa
  //    de medianoche.
  const inicioMin = aMinutos(data.horaInicio)
  const finMin = inicioMin + data.duracionMinutos
  if (finMin > 24 * 60) {
    return res.status(400).json({ error: tr(req.lang, 'error.horaTardia') })
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
      error: tr(req.lang, 'error.horarioSolapado'),
      code: 'HORARIO_OCUPADO',
    })
  }

  // d) Penalización por cancelación copiada del profesional (igual que reservar).
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { costoCancelacion: true, diasAnticipacionRequierida: true, zonaHoraria: true },
  })

  // e) Crea la cita CONFIRMADA. El profesional la agenda directamente: se ancla a
  //    SU zona horaria activa en este momento (modelo Google Calendar).
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
      zonaHorariaCreacion: medico?.zonaHoraria || ZONA_HORARIA_DEFAULT,
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
    res.status(400).json({ error: tr(req.lang, 'error.idInvalido') })
    return null
  }
  const cita = await prisma.cita.findUnique({ where: { id } })
  if (!cita) {
    res.status(404).json({ error: tr(req.lang, 'error.citaNoEncontrada') })
    return null
  }
  if (cita.pacienteId !== req.user.id) {
    res.status(403).json({ error: tr(req.lang, 'error.citaAjena') })
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
      error: tr(req.lang, 'error.soloCancelar', { estado: cita.estado }),
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
    // `empleado` solo viene en citas de cuentas Pro (en las normales es null); el
    // dashboard muestra "Tu cita es con [nombre]" cuando existe.
    include: {
      medico: { select: MEDICO_BASICO },
      empleado: { select: EMPLEADO_BASICO },
    },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })
  res.json(citas)
})

// ── GET /citas/mi-ultimo-empleado ────────────────────────────────────────────
// Para "repetir con X": devuelve el empleado de la ÚLTIMA cita del cliente con SU
// profesional (si tiene alguna cita histórica con empleado asignado en este
// negocio). Devuelve { empleado: null } si no hay historial o el profesional no es
// Pro. Nunca expone nada de otros profesionales (aislamiento por profesionalId).
router.get('/mi-ultimo-empleado', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const paciente = await prisma.usuario.findUnique({
    where: { id: req.user.id },
    select: { profesionalId: true },
  })
  if (!paciente?.profesionalId) return res.json({ empleado: null })

  const medico = await prisma.medico.findUnique({
    where: { id: paciente.profesionalId },
    select: { esNegocioPro: true },
  })
  if (!medico?.esNegocioPro) return res.json({ empleado: null })

  // Última cita (por fecha/hora) de este cliente con este profesional que tenga
  // empleado asignado y activo.
  const ultima = await prisma.cita.findFirst({
    where: {
      pacienteId: req.user.id,
      medicoId: paciente.profesionalId,
      empleadoId: { not: null },
      empleado: { is: { activo: true } },
    },
    include: { empleado: { select: EMPLEADO_BASICO } },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })

  res.json({ empleado: ultima?.empleado ?? null })
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
    res.status(400).json({ error: tr(req.lang, 'error.idInvalido') })
    return null
  }
  const cita = await prisma.cita.findUnique({ where: { id } })
  if (!cita) {
    res.status(404).json({ error: tr(req.lang, 'error.citaNoEncontrada') })
    return null
  }
  if (cita.medicoId !== req.user.id) {
    res.status(403).json({ error: tr(req.lang, 'error.citaAjena') })
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
      .json({ error: tr(req.lang, 'error.soloAprobar', { estado: cita.estado }) })
  }

  const actualizada = await prisma.cita.update({
    where: { id: cita.id },
    data: { estado: 'CONFIRMADA' },
  })
  res.json(actualizada)
})

// ── PATCH /citas/:id/anular ──────────────────────────────────────────────────
router.patch('/:id/anular', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const data = parseOr400(anularSchema, req, res)
  if (!data) return

  const cita = await cargarCitaPropia(req, res)
  if (!cita) return

  if (!['PENDIENTE', 'CONFIRMADA'].includes(cita.estado)) {
    return res.status(409).json({
      error: tr(req.lang, 'error.soloAnular', { estado: cita.estado }),
    })
  }

  const actualizada = await prisma.cita.update({
    where: { id: cita.id },
    data: { estado: 'ANULADA', notaAnulacion: data.notaAnulacion },
  })

  // Notificación best-effort al paciente (no bloquea la anulación). Se envía en el
  // idioma preferido del CLIENTE (es quien la recibe), no en el del profesional.
  const paciente = await prisma.usuario.findUnique({
    where: { id: actualizada.pacienteId },
    select: { id: true, correo: true, telefono: true, idiomaPreferido: true },
  })
  const noti = await notificationService.send({
    tipo: 'ANULACION',
    canal: 'EMAIL',
    idioma: paciente.idiomaPreferido || 'ES',
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
      error: tr(req.lang, 'error.soloCompletar', { estado: cita.estado }),
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

// Motor de slots de 45 minutos (CONTEXT.md §5, reglas 1, 2 y 3).
// Funciones puras: reciben datos ya cargados (sin Express ni Prisma).

const DURACION_SLOT_MIN = 45
const ESTADOS_BLOQUEANTES = ['PENDIENTE', 'CONFIRMADA'] // ANULADA no bloquea

// ── Helpers de tiempo ────────────────────────────────────────────────────────
/** "HH:mm" -> minutos desde medianoche. */
function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** minutos desde medianoche -> "HH:mm" (con cero a la izquierda). */
function aHHMM(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Normaliza una fecha (Date o string) a "YYYY-MM-DD" para comparar. */
function claveFecha(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return String(fecha).slice(0, 10)
}

/** Clave única de un slot para comparaciones por igualdad. */
function claveSlot(slot) {
  return `${slot.horaInicio}-${slot.horaFin}`
}

/** ¿Se solapan los rangos [aIni,aFin) y [bIni,bFin)? (en minutos). */
function solapan(aIni, aFin, bIni, bFin) {
  return aIni < bFin && bIni < aFin
}

// ── 1) generarSlots ──────────────────────────────────────────────────────────
/**
 * Trocea un rango de disponibilidad en slots consecutivos sin huecos.
 * Descarta el sobrante si el rango no es múltiplo exacto de la duración.
 * La duración se toma, en este orden: el parámetro explícito `duracionMin`,
 * el campo `disponibilidad.duracionMinutos` de la franja, o 45 por defecto.
 * @param {{ fecha?: any, horaInicio: string, horaFin: string, duracionMinutos?: number }} disponibilidad
 * @param {number} [duracionMin] duración del bloque en minutos (opcional)
 * @returns {Array<{ horaInicio: string, horaFin: string }>}
 */
export function generarSlots(disponibilidad, duracionMin) {
  const inicio = aMinutos(disponibilidad.horaInicio)
  const fin = aMinutos(disponibilidad.horaFin)
  const elegida = duracionMin ?? disponibilidad.duracionMinutos ?? DURACION_SLOT_MIN
  const paso = elegida > 0 ? elegida : DURACION_SLOT_MIN

  const slots = []
  for (let cur = inicio; cur + paso <= fin; cur += paso) {
    slots.push({
      horaInicio: aHHMM(cur),
      horaFin: aHHMM(cur + paso),
    })
  }
  return slots
}

// ── 2) slotsDisponibles ──────────────────────────────────────────────────────
/**
 * Genera todos los slots de las disponibilidades de un médico para una fecha y
 * excluye los ocupados por citas en estado PENDIENTE o CONFIRMADA.
 * @param {Array<{ fecha:any, horaInicio:string, horaFin:string }>} disponibilidades
 * @param {Array<{ fecha:any, horaInicio:string, horaFin:string, estado:string }>} citasExistentes
 * @param {any} fecha fecha objetivo (Date o "YYYY-MM-DD")
 * @returns {Array<{ horaInicio:string, horaFin:string }>} slots libres ordenados
 */
export function slotsDisponibles(disponibilidades, citasExistentes, fecha) {
  const claveObjetivo = claveFecha(fecha)

  // Slots de todas las disponibilidades de esa fecha (deduplicados).
  const porClave = new Map()
  for (const disp of disponibilidades) {
    if (claveFecha(disp.fecha) !== claveObjetivo) continue
    for (const slot of generarSlots(disp)) {
      porClave.set(claveSlot(slot), slot)
    }
  }

  // Citas activas (bloqueantes) de esa fecha.
  const citasActivas = citasExistentes.filter(
    (c) => claveFecha(c.fecha) === claveObjetivo && ESTADOS_BLOQUEANTES.includes(c.estado),
  )

  const libres = [...porClave.values()].filter((slot) => {
    const sIni = aMinutos(slot.horaInicio)
    const sFin = aMinutos(slot.horaFin)
    const ocupado = citasActivas.some((c) =>
      solapan(sIni, sFin, aMinutos(c.horaInicio), aMinutos(c.horaFin)),
    )
    return !ocupado
  })

  // Orden cronológico.
  libres.sort((a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio))
  return libres
}

// ── 3) validarReserva ────────────────────────────────────────────────────────
/**
 * Valida las reglas de negocio antes de crear una cita.
 * @param {{
 *   tipoPaciente: "NUEVO"|"CONTINUIDAD",
 *   slotsElegidos: Array<{horaInicio:string,horaFin:string}>,
 *   slotsDisponibles: Array<{horaInicio:string,horaFin:string}>
 * }} args
 * @returns {{ valido: true } | { valido: false, error: string }}
 */
export function validarReserva({ tipoPaciente, slotsElegidos, slotsDisponibles }) {
  const elegidos = slotsElegidos || []

  if (elegidos.length === 0) {
    return { valido: false, error: 'Debe elegir al menos un slot.' }
  }

  // Reglas de cantidad por tipo de paciente.
  if (tipoPaciente === 'NUEVO') {
    if (elegidos.length !== 1) {
      return { valido: false, error: 'Un paciente nuevo solo puede reservar 1 slot.' }
    }
  } else if (tipoPaciente === 'CONTINUIDAD') {
    if (elegidos.length > 2) {
      return {
        valido: false,
        error: 'Un paciente de continuidad puede reservar máximo 2 slots consecutivos.',
      }
    }
  } else {
    return { valido: false, error: `Tipo de paciente desconocido: ${tipoPaciente}.` }
  }

  // Todos los slots elegidos deben estar dentro de los disponibles.
  const clavesDisponibles = new Set((slotsDisponibles || []).map(claveSlot))
  for (const slot of elegidos) {
    if (!clavesDisponibles.has(claveSlot(slot))) {
      return {
        valido: false,
        error: `El slot ${slot.horaInicio}-${slot.horaFin} no está disponible.`,
      }
    }
  }

  // Si son 2 slots, deben ser consecutivos.
  if (elegidos.length === 2) {
    const ordenados = [...elegidos].sort(
      (a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio),
    )
    if (ordenados[0].horaFin !== ordenados[1].horaInicio) {
      return { valido: false, error: 'Los 2 slots deben ser consecutivos.' }
    }
  }

  return { valido: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO "NEGOCIO PRO" (cuentas con varios empleados). Todo lo de abajo es ADITIVO:
// las funciones anteriores NO cambian, y estas solo las usan las ramas del motor
// que se activan cuando el profesional tiene esNegocioPro=true. Un profesional
// normal (sin empleados) nunca pasa por aquí.
// ─────────────────────────────────────────────────────────────────────────────

/** Cuenta las citas activas (bloqueantes) de un empleado en una fecha dada. */
function contarCitasActivas(citas, claveObjetivo) {
  return citas.filter(
    (c) => claveFecha(c.fecha) === claveObjetivo && ESTADOS_BLOQUEANTES.includes(c.estado),
  ).length
}

// ── 4) slotsCombinados ───────────────────────────────────────────────────────
/**
 * Disponibilidad COMBINADA de todo un equipo para una fecha. Para cada empleado
 * calcula sus slots libres con `slotsDisponibles` (reutilizado, misma lógica que
 * un profesional normal) y los UNE por franja horaria: un slot aparece una sola
 * vez aunque varios empleados lo ofrezcan (sin duplicar), y aparece si AL MENOS
 * un empleado está libre en él (sin perder slots). Cada slot resultante lleva la
 * lista `empleadosLibres` con los ids de los empleados libres en esa franja.
 * @param {Array<{ empleadoId:number, disponibilidades:Array, citas:Array }>} empleadosData
 * @param {any} fecha fecha objetivo (Date o "YYYY-MM-DD")
 * @returns {Array<{ horaInicio:string, horaFin:string, empleadosLibres:number[] }>}
 */
export function slotsCombinados(empleadosData, fecha) {
  const porSlot = new Map() // claveSlot -> { horaInicio, horaFin, empleadosLibres:[] }

  for (const emp of empleadosData) {
    const libres = slotsDisponibles(emp.disponibilidades, emp.citas, fecha)
    for (const slot of libres) {
      const clave = claveSlot(slot)
      let entrada = porSlot.get(clave)
      if (!entrada) {
        entrada = { horaInicio: slot.horaInicio, horaFin: slot.horaFin, empleadosLibres: [] }
        porSlot.set(clave, entrada)
      }
      entrada.empleadosLibres.push(emp.empleadoId)
    }
  }

  const combinados = [...porSlot.values()]
  combinados.sort((a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio))
  return combinados
}

// ── 5) asignarEmpleado ───────────────────────────────────────────────────────
/**
 * Elige qué empleado atiende una reserva en una cuenta Pro (asignación
 * automática). Candidatos = empleados libres para TODOS los slots elegidos
 * (importante para citas dobles: un mismo empleado debe cubrir ambos bloques).
 * Desempate: el que tenga MENOS citas activas ese día; si persiste, el de menor
 * id (determinista). Devuelve el `empleadoId` o `null` si ninguno cubre.
 * @param {Array<{ empleadoId:number, disponibilidades:Array, citas:Array }>} empleadosData
 * @param {Array<{horaInicio:string,horaFin:string}>} slotsElegidos
 * @param {any} fecha
 * @returns {number|null}
 */
export function asignarEmpleado(empleadosData, slotsElegidos, fecha) {
  const clavesElegidas = (slotsElegidos || []).map(claveSlot)
  if (clavesElegidas.length === 0) return null

  const candidatos = empleadosData.filter((emp) => {
    const libres = new Set(
      slotsDisponibles(emp.disponibilidades, emp.citas, fecha).map(claveSlot),
    )
    return clavesElegidas.every((k) => libres.has(k))
  })
  if (candidatos.length === 0) return null

  const claveObjetivo = claveFecha(fecha)
  candidatos.sort((a, b) => {
    const carga = contarCitasActivas(a.citas, claveObjetivo) - contarCitasActivas(b.citas, claveObjetivo)
    if (carga !== 0) return carga
    return a.empleadoId - b.empleadoId
  })
  return candidatos[0].empleadoId
}

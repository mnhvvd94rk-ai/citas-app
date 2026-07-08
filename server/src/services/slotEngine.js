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
 * @param {{ fecha?: any, horaInicio: string, horaFin: string }} disponibilidad
 * @param {number} [duracionMin=45] duración del bloque en minutos
 * @returns {Array<{ horaInicio: string, horaFin: string }>}
 */
export function generarSlots(disponibilidad, duracionMin = DURACION_SLOT_MIN) {
  const inicio = aMinutos(disponibilidad.horaInicio)
  const fin = aMinutos(disponibilidad.horaFin)
  const paso = duracionMin > 0 ? duracionMin : DURACION_SLOT_MIN

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

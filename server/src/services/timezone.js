// Utilidades de zona horaria para el motor de notificaciones.
//
// El problema que resuelven: en la app la hora de una cita se guarda como hora
// "de pared" sin zona (`fecha` = medianoche UTC del día + `horaInicio` "HH:mm").
// Para calcular CUÁNTO falta realmente para la cita hay que convertir esa hora de
// pared a un instante UTC absoluto usando la zona horaria del negocio (con su
// horario de verano correcto). Antes se interpretaba como UTC crudo, lo que
// desfasaba los recordatorios (p. ej. +2h en Bélgica en verano).
//
// Sin dependencias externas: se apoya en Intl (ICU completo en Node ≥ 20).

export const ZONA_HORARIA_DEFAULT = 'Europe/Brussels'

/**
 * ¿Es `tz` una zona horaria IANA válida para este runtime?
 * @param {string} tz
 * @returns {boolean}
 */
export function esZonaHorariaValida(tz) {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Offset de la zona `timeZone` en minutos (localTime - UTC) para el instante
 * `date`. Positivo al este de UTC (ej. Europe/Brussels en verano = +120).
 * @param {string} timeZone
 * @param {Date} date
 * @returns {number}
 */
function offsetMinutos(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )
  return (asUTC - date.getTime()) / 60000
}

/**
 * Convierte una hora de pared (fecha "YYYY-MM-DD" + hora "HH:mm") interpretada en
 * la zona `timeZone` al instante UTC real (Date). Doble pasada para resolver el
 * offset correcto incluso cerca de los saltos de horario de verano.
 * @param {string} ymd   "YYYY-MM-DD"
 * @param {string} hhmm  "HH:mm"
 * @param {string} [timeZone]
 * @returns {Date} instante UTC
 */
export function wallTimeToInstant(ymd, hhmm, timeZone = ZONA_HORARIA_DEFAULT) {
  const tz = esZonaHorariaValida(timeZone) ? timeZone : ZONA_HORARIA_DEFAULT
  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0)

  // 1ª aproximación con el offset del instante "adivinado".
  const off1 = offsetMinutos(tz, new Date(utcGuess))
  const inst1 = new Date(utcGuess - off1 * 60000)
  // 2ª pasada: recalcula el offset EN ese instante (corrige bordes de DST).
  const off2 = offsetMinutos(tz, inst1)
  if (off2 === off1) return inst1
  return new Date(utcGuess - off2 * 60000)
}

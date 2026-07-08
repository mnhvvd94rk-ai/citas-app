// Utilidades de fecha. Las fechas de cita se guardan como medianoche UTC, por
// eso se formatea a partir de la parte "YYYY-MM-DD" para evitar desfases de zona.

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Fecha de hoy en formato "YYYY-MM-DD" (hora local). */
export function hoyISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/** Extrae "YYYY-MM-DD" de cualquier ISO o Date. */
export function soloFecha(iso) {
  if (!iso) return ''
  return String(iso).slice(0, 10)
}

/** "2026-07-01" -> "miércoles 1 de julio de 2026". */
export function formatFechaLarga(iso) {
  const ymd = soloFecha(iso)
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  return `${DIAS[fecha.getUTCDay()]} ${d} de ${MESES[m - 1]} de ${y}`
}

/** "2026-07-01" -> "1 jul 2026". */
export function formatFechaCorta(iso) {
  const ymd = soloFecha(iso)
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return `${d} ${MESES[m - 1].slice(0, 3)} ${y}`
}

/**
 * Instante (Date, hora local) de una cita a partir de su fecha ISO y hora
 * "HH:MM". La hora se interpreta como hora de pared local (lo que el
 * profesional/cliente ve), para calcular "faltan X minutos".
 */
export function instanteCita(fechaISO, horaHHMM) {
  const ymd = soloFecha(fechaISO)
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  const [hh, mm] = String(horaHHMM || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0)
}

/** Minutos (número, puede ser negativo) desde ahora hasta el inicio de la cita. */
export function minutosHastaCita(fechaISO, horaHHMM, ahora = new Date()) {
  const inst = instanteCita(fechaISO, horaHHMM)
  if (!inst) return Infinity
  return (inst.getTime() - ahora.getTime()) / 60000
}

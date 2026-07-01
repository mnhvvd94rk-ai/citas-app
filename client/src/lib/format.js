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

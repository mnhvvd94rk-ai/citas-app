// Utilidades de fecha. Las fechas de cita se guardan como medianoche UTC, por
// eso se formatea a partir de la parte "YYYY-MM-DD" para evitar desfases de zona.

// Nombres de meses/días por idioma. Las fechas se formatean en el MISMO idioma
// que el resto de la UI (ver setFormatLang, sincronizado desde LanguageContext),
// para no mezclar, p.ej., un día en español dentro de un texto en francés.
const MESES = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
}
const MESES_CORTO = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
}
const DIAS = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
}

// Idioma activo del formateo de fechas. LanguageContext lo mantiene en sync con
// el idioma de la UI, así estas funciones (usadas en muchos sitios) no necesitan
// recibir el idioma por parámetro.
let _lang = 'es'
export function setFormatLang(lang) {
  _lang = MESES[lang] ? lang : 'es'
}

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

/** "2026-07-01" -> "miércoles 1 de julio de 2026" (o el equivalente en el idioma activo). */
export function formatFechaLarga(iso) {
  const ymd = soloFecha(iso)
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const dia = DIAS[_lang][dow]
  const mes = MESES[_lang][m - 1]
  if (_lang === 'fr') return `${dia} ${d} ${mes} ${y}`
  if (_lang === 'en') return `${dia}, ${mes} ${d}, ${y}`
  return `${dia} ${d} de ${mes} de ${y}` // es
}

/** "2026-07-01" -> "1 jul 2026" (mes en el idioma activo). */
export function formatFechaCorta(iso) {
  const ymd = soloFecha(iso)
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return `${d} ${MESES_CORTO[_lang][m - 1]} ${y}`
}

/**
 * Timestamp COMPLETO (fecha + hora) en hora LOCAL, formato 12h: p.ej.
 * "12 jul 2026, 3:45pm". A diferencia de formatFechaCorta/Larga (que tratan la
 * fecha como día puro en UTC para las citas), aquí `iso` es un instante real
 * (p.ej. la marca de una nota) y se muestra en la hora local del navegador.
 */
export function formatFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.getDate()
  const mes = MESES_CORTO[_lang][d.getMonth()]
  const anio = d.getFullYear()
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'pm' : 'am'
  const h12 = d.getHours() % 12 || 12
  return `${dia} ${mes} ${anio}, ${h12}:${min}${ampm}`
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

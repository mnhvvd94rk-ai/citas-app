// Recuperación (Regla A): envía UN recordatorio tardío a las citas cuya ventana
// de aviso (48/24/3h) ya pasó por el bug de timing y NUNCA notificaron, siempre
// que la cita todavía no haya ocurrido. Usa texto de recordatorio "plano" (con
// fecha y hora reales), no el de "faltan X horas".
//
// SEGURIDAD: por defecto corre en dry-run (no envía nada, solo devuelve la lista).
// Ejecutar el envío real requiere pasar { dryRun: false } explícitamente.

import { prisma } from '../services/db.js'
import notificationService from '../services/notificationService.js'

const MESES_CORTO = {
  ES: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  EN: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  FR: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
}

/** Fecha "YYYY-MM-DD" -> "13 jul 2026" en el idioma dado. */
function fechaLegible(fechaDate, idioma) {
  const iso = fechaDate.toISOString().slice(0, 10)
  const [y, m, d] = iso.split('-').map(Number)
  const meses = MESES_CORTO[idioma] || MESES_CORTO.ES
  return `${d} ${meses[m - 1]} ${y}`
}

/** Instante real de la cita (fecha a medianoche UTC + horaInicio como UTC). */
function instanteCita(cita) {
  const ymd = cita.fecha.toISOString().slice(0, 10)
  return new Date(`${ymd}T${cita.horaInicio}:00.000Z`)
}

/**
 * Citas elegibles para recuperación:
 *  - estado CONFIRMADA o PENDIENTE
 *  - la cita aún no ocurrió (inicio > ahora)
 *  - su inicio está dentro de las próximas 48h (al menos la marca de 48h ya pasó)
 *  - todavía no se les envió un recordatorio de recuperación ('recordatorio')
 */
export async function listarElegibles(ahora = new Date()) {
  const limite48h = new Date(ahora.getTime() + 48 * 60 * 60 * 1000)
  const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000) // margen zona horaria

  const citas = await prisma.cita.findMany({
    where: { estado: { in: ['CONFIRMADA', 'PENDIENTE'] }, fecha: { gte: desde, lte: limite48h } },
    include: {
      paciente: { select: { id: true, nombre: true, apellido: true, correo: true, telefono: true, idiomaPreferido: true } },
      medico: { select: { id: true, nombre: true } },
    },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })

  const elegibles = []
  for (const cita of citas) {
    const inst = instanteCita(cita)
    if (inst <= ahora) continue // ya ocurrió
    if (inst > limite48h) continue // aún falta >48h (lo cubre el job normal)

    const ya = await prisma.notificacionEnviada.findUnique({
      where: { citaId_tipo: { citaId: cita.id, tipo: 'recordatorio' } },
    })
    if (ya) continue

    elegibles.push({ cita, instante: inst })
  }
  return elegibles
}

/**
 * Ejecuta la recuperación. dryRun=true (default) NO envía; solo informa.
 * @returns {Promise<{ total:number, enviados:number, detalle:Array }>}
 */
export async function recuperar({ dryRun = true } = {}) {
  const ahora = new Date()
  const elegibles = await listarElegibles(ahora)
  let enviados = 0
  const detalle = []

  for (const { cita, instante } of elegibles) {
    const p = cita.paciente
    const idioma = p?.idiomaPreferido || 'ES'
    const horasRestantes = Math.round(((instante - ahora) / 3600000) * 10) / 10
    const fila = {
      citaId: cita.id,
      estado: cita.estado,
      cliente: `${p?.nombre || ''} ${p?.apellido || ''}`.trim(),
      profesional: cita.medico?.nombre || '',
      profesionalId: cita.medico?.id,
      fecha: cita.fecha.toISOString().slice(0, 10),
      hora: cita.horaInicio,
      horasRestantes,
      idioma,
      canales: [p?.correo && 'email', p?.telefono && 'whatsapp'].filter(Boolean),
      entregado: false,
    }

    if (!dryRun) {
      const destinatario = {
        id: p.id,
        tipoDestinatario: 'PACIENTE',
        correo: p.correo,
        telefono: p.telefono,
      }
      const payload = {
        marca: 'recordatorio',
        fecha: fechaLegible(cita.fecha, idioma),
        hora: cita.horaInicio,
        profesional: cita.medico?.nombre || '',
        citaId: cita.id,
        enlaceVideoconferencia:
          cita.tipoCita === 'VIDEOCONFERENCIA' ? cita.enlaceVideoconferencia : null,
      }
      let algunEntregado = false
      if (p?.correo) {
        const r = await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'EMAIL', idioma, destinatario, payload })
        if (r.delivered) algunEntregado = true
      }
      if (p?.telefono) {
        const r = await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'WHATSAPP', idioma, destinatario, payload })
        if (r.delivered) algunEntregado = true
      }
      const subs = await prisma.pushSubscription.findMany({ where: { clienteId: p.id } })
      for (const sub of subs) {
        const r = await notificationService.send({
          tipo: 'RECORDATORIO_CITA', canal: 'PUSH', idioma,
          destinatario: { id: p.id, tipoDestinatario: 'PACIENTE', pushSubscription: { endpoint: sub.endpoint, keys: sub.keys }, pushUrl: '/paciente/citas' },
          payload,
        })
        if (r.delivered) algunEntregado = true
      }
      if (algunEntregado) {
        await prisma.notificacionEnviada.create({ data: { citaId: cita.id, tipo: 'recordatorio' } })
        enviados++
        fila.entregado = true
      }
    }

    detalle.push(fila)
  }

  return { total: elegibles.length, enviados, detalle }
}

// Recuperación DIRIGIDA solo a estas 3 clientas confirmadas (idioma FR revisado
// con la profesional): Sephora Birle (86), Héloïse Crabbe (91), Natacha Gallo (92).
// El resto de clientas con citas elegibles NO se incluyen a propósito (su idioma
// no está confirmado; el profesional las revisa aparte).
const CLIENTES_OBJETIVO = [86, 91, 92]

/**
 * Recuperación dirigida para el endpoint admin de un solo uso: envía el aviso
 * tardío al CLIENTE y a su PROFESIONAL por email + WhatsApp, cada uno en su
 * idioma, y devuelve el resultado REAL de entrega por canal y destinatario.
 * Marca cada cita como recuperada (idempotencia por cita).
 */
export async function recuperarAdmin() {
  const ahora = new Date()
  const elegibles = (await listarElegibles(ahora)).filter(({ cita }) =>
    CLIENTES_OBJETIVO.includes(cita.pacienteId),
  )
  const detalle = []

  const fmt = (r) =>
    r.skipped ? 'sin-canal' : r.delivered ? 'ENTREGADO' : `FALLIDO: ${r.error || 'sin entrega confirmada'}`

  for (const { cita } of elegibles) {
    const p = cita.paciente
    const idiomaCli = p?.idiomaPreferido || 'ES'
    const medico = await prisma.medico.findUnique({
      where: { id: cita.medicoId },
      select: { id: true, nombre: true, correo: true, telefono: true, idiomaPreferido: true },
    })
    const idiomaPro = medico?.idiomaPreferido || 'ES'
    const nombreCli = `${p?.nombre || ''} ${p?.apellido || ''}`.trim()
    const enlaceVideo = cita.tipoCita === 'VIDEOCONFERENCIA' ? cita.enlaceVideoconferencia : null

    // CLIENTE: "…su cita es el {fecha} a las {hora} con {profesional=medico}".
    const destCli = { id: p.id, tipoDestinatario: 'PACIENTE', correo: p.correo, telefono: p.telefono }
    const payCli = { marca: 'recordatorio', fecha: fechaLegible(cita.fecha, idiomaCli), hora: cita.horaInicio, profesional: medico?.nombre || '', citaId: cita.id, enlaceVideoconferencia: enlaceVideo }
    const cliEmail = p?.correo
      ? await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'EMAIL', idioma: idiomaCli, destinatario: destCli, payload: payCli })
      : { skipped: true }
    const cliWa = p?.telefono
      ? await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'WHATSAPP', idioma: idiomaCli, destinatario: destCli, payload: payCli })
      : { skipped: true }

    // PROFESIONAL: mismo estilo, pero "con {profesional=cliente}" (la otra parte).
    const destPro = { id: medico?.id, tipoDestinatario: 'MEDICO', correo: medico?.correo, telefono: medico?.telefono }
    const payPro = { marca: 'recordatorio', fecha: fechaLegible(cita.fecha, idiomaPro), hora: cita.horaInicio, profesional: nombreCli, citaId: cita.id, enlaceVideoconferencia: enlaceVideo }
    const proEmail = medico?.correo
      ? await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'EMAIL', idioma: idiomaPro, destinatario: destPro, payload: payPro })
      : { skipped: true }
    const proWa = medico?.telefono
      ? await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'WHATSAPP', idioma: idiomaPro, destinatario: destPro, payload: payPro })
      : { skipped: true }

    // Idempotencia por cita (evita re-envío en una segunda pasada).
    await prisma.notificacionEnviada.create({ data: { citaId: cita.id, tipo: 'recordatorio' } }).catch(() => {})

    detalle.push({
      citaId: cita.id,
      fecha: cita.fecha.toISOString().slice(0, 10),
      hora: cita.horaInicio,
      cliente: { nombre: nombreCli, correo: p?.correo || null, telefono: p?.telefono || null, idioma: idiomaCli, email: fmt(cliEmail), whatsapp: fmt(cliWa) },
      profesional: { nombre: medico?.nombre, correo: medico?.correo || null, telefono: medico?.telefono || null, idioma: idiomaPro, email: fmt(proEmail), whatsapp: fmt(proWa) },
    })
  }

  return { total: elegibles.length, detalle }
}

export default { listarElegibles, recuperar, recuperarAdmin }

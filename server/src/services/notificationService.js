import nodemailer from 'nodemailer'
import webpush from 'web-push'
import { prisma } from './db.js'

// Capa adapter de notificaciones (CONTEXT.md §9).
// Interfaz fija: notificationService.send({ tipo, canal, destinatario, payload })
//
// El envío es best-effort: nunca lanza al llamador. Devuelve
//   { ok: true, notificacionId } | { ok: false, error }

// Plantillas de recordatorio de cita en 3 idiomas (payload: { marca, hora, profesional }).
const REMINDER_MESSAGES = {
  ES: {
    '48h': () => ({ asunto: 'Recordatorio: tu cita en 48 horas', texto: '📅 Recordatorio: Tu cita en 48 horas. Cancélala antes de esta fecha si necesitas.' }),
    '24h': (p) => ({ asunto: 'Recordatorio: tu cita mañana', texto: `📅 ¡Mañana es tu cita! A las ${p.hora} con ${p.profesional}.` }),
    '3h': () => ({ asunto: 'Tu cita comienza en 3 horas', texto: '⏰ Tu cita comienza en 3 horas. Llega 10 minutos antes.' }),
  },
  EN: {
    '48h': () => ({ asunto: 'Reminder: your appointment in 48 hours', texto: '📅 Reminder: Your appointment in 48 hours. Cancel before this date if needed.' }),
    '24h': (p) => ({ asunto: 'Reminder: your appointment tomorrow', texto: `📅 Your appointment is tomorrow! At ${p.hora} with ${p.profesional}.` }),
    '3h': () => ({ asunto: 'Your appointment starts in 3 hours', texto: '⏰ Your appointment starts in 3 hours. Arrive 10 minutes early.' }),
  },
  FR: {
    '48h': () => ({ asunto: 'Rappel : votre rendez-vous dans 48 heures', texto: '📅 Rappel: Votre rendez-vous dans 48 heures. Annulez avant cette date si nécessaire.' }),
    '24h': (p) => ({ asunto: 'Rappel : votre rendez-vous demain', texto: `📅 Votre rendez-vous est demain! À ${p.hora} avec ${p.profesional}.` }),
    '3h': () => ({ asunto: 'Votre rendez-vous commence dans 3 heures', texto: '⏰ Votre rendez-vous commence dans 3 heures. Arrivez 10 minutes plus tôt.' }),
  },
}

// ── Construcción del mensaje según el tipo (y el idioma para recordatorios) ───
function construirMensaje(tipo, payload = {}, idioma = 'ES') {
  if (tipo === 'ANULACION') {
    const lineas = [
      'Hola,',
      '',
      `Tu cita del ${payload.fecha} a las ${payload.horaInicio} ha sido anulada.`,
    ]
    if (payload.notaAnulacion) lineas.push(`Motivo: ${payload.notaAnulacion}`)
    lineas.push('', 'Puedes volver a reservar cuando lo necesites.')
    const texto = lineas.join('\n')
    return {
      asunto: 'Tu cita ha sido anulada',
      texto,
      html: `<p>${texto.replace(/\n/g, '<br>')}</p>`,
    }
  }

  if (tipo === 'RESUMEN_DIARIO') {
    const citas = payload.citas || []
    const items = citas
      .map((c) => `• ${c.horaInicio} - ${c.horaFin}`)
      .join('\n')
    const texto = `Tienes ${citas.length} cita(s) confirmada(s) hoy:\n${items}`
    return {
      asunto: 'Resumen de citas del día',
      texto,
      html: `<p>${texto.replace(/\n/g, '<br>')}</p>`,
    }
  }

  // Recordatorio automático de cita: se construye en el idioma del cliente.
  if (tipo === 'RECORDATORIO_CITA') {
    const lang = REMINDER_MESSAGES[idioma] ? idioma : 'ES'
    const fn = REMINDER_MESSAGES[lang][payload.marca]
    const { asunto, texto } = fn
      ? fn(payload)
      : { asunto: 'Recordatorio de cita', texto: payload.texto || '' }
    return { asunto, texto, html: `<p>${texto.replace(/\n/g, '<br>')}</p>` }
  }

  // Genérico (fallback).
  const texto = JSON.stringify(payload)
  return { asunto: `Notificación: ${tipo}`, texto, html: `<pre>${texto}</pre>` }
}

// ── Transporte de email (cacheado) ───────────────────────────────────────────
let transportCache = null

async function getEmailTransport() {
  if (transportCache) return transportCache

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transportCache = {
      isEthereal: false,
      transporter: nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      }),
    }
    return transportCache
  }

  // Sin SMTP configurado → cuenta de prueba Ethereal (solo dev).
  const testAccount = await nodemailer.createTestAccount()
  transportCache = {
    isEthereal: true,
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    }),
  }
  console.log('[notificationService] SMTP no configurado; usando Ethereal:', testAccount.user)
  return transportCache
}

// ── Implementaciones por canal ───────────────────────────────────────────────
async function enviarEmail({ destinatario, asunto, texto, html }) {
  if (!destinatario?.correo) return { ok: false, error: 'Destinatario sin correo' }

  const { transporter, isEthereal } = await getEmailTransport()
  const info = await transporter.sendMail({
    from: '"Citas App" <no-reply@citas.app>',
    to: destinatario.correo,
    subject: asunto,
    text: texto,
    html,
  })

  const result = { ok: true }
  if (isEthereal) {
    result.previewUrl = nodemailer.getTestMessageUrl(info)
    console.log('[notificationService] Vista previa (Ethereal):', result.previewUrl)
  }
  return result
}

function enviarSMS({ destinatario, texto }) {
  // Mock: listo para Twilio más adelante (CONTEXT.md §9), sin implementar aún.
  console.log(
    `[notificationService][SMS mock] -> ${destinatario?.telefono || '(sin teléfono)'}: ${texto}`,
  )
  return { ok: true }
}

function enviarWhatsApp({ destinatario, texto }) {
  if (!destinatario?.telefono) return { ok: false, error: 'Destinatario sin teléfono' }
  // Mock: loguea el envío. Listo para conectar la API de WhatsApp de Twilio
  // (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER) después.
  console.log(`[notificationService][WhatsApp mock] WhatsApp enviado a ${destinatario.telefono}: ${texto}`)
  return { ok: true }
}

let pushConfigurado = null

function configurarPush() {
  if (pushConfigurado !== null) return pushConfigurado

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    pushConfigurado = false
    return false
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    pushConfigurado = true
  } catch (e) {
    console.warn('[notificationService] VAPID inválidas:', e.message)
    pushConfigurado = false
  }
  return pushConfigurado
}

async function enviarPush({ destinatario, asunto, texto }) {
  if (!configurarPush()) {
    console.warn('[notificationService] Push sin VAPID keys; se marca FALLIDO.')
    return { ok: false, error: 'VAPID keys no configuradas' }
  }
  if (!destinatario?.pushSubscription) {
    return { ok: false, error: 'Destinatario sin pushSubscription' }
  }
  try {
    await webpush.sendNotification(
      destinatario.pushSubscription,
      JSON.stringify({ title: asunto, body: texto }),
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ── API pública ──────────────────────────────────────────────────────────────
/**
 * Envía una notificación por el canal indicado, registrándola en la tabla
 * Notificacion. Best-effort: nunca lanza.
 * @param {{
 *   tipo: "ANULACION"|"RESUMEN_DIARIO"|"RECORDATORIO_CITA",
 *   canal: "EMAIL"|"SMS"|"WHATSAPP"|"PUSH",
 *   destinatario: { id:number, tipoDestinatario:"PACIENTE"|"MEDICO", correo?:string, telefono?:string, pushSubscription?:object },
 *   payload: object
 * }} args
 * @returns {Promise<{ok:true,notificacionId:number,previewUrl?:string}|{ok:false,error:string,notificacionId?:number}>}
 */
async function send({ tipo, canal, idioma = 'ES', destinatario, payload }) {
  let notificacion
  try {
    // a) Registro PENDIENTE antes de intentar el envío.
    notificacion = await prisma.notificacion.create({
      data: {
        destinatarioId: destinatario.id,
        tipoDestinatario: destinatario.tipoDestinatario,
        tipo,
        canal,
        estadoEnvio: 'PENDIENTE',
      },
    })

    const { asunto, texto, html } = construirMensaje(tipo, payload, idioma)

    // b) Delegación por canal.
    let resultado
    if (canal === 'EMAIL') {
      resultado = await enviarEmail({ destinatario, asunto, texto, html })
    } else if (canal === 'SMS') {
      resultado = enviarSMS({ destinatario, texto })
    } else if (canal === 'WHATSAPP') {
      resultado = enviarWhatsApp({ destinatario, texto })
    } else if (canal === 'PUSH') {
      resultado = await enviarPush({ destinatario, asunto, texto })
    } else {
      resultado = { ok: false, error: `Canal desconocido: ${canal}` }
    }

    // f) Actualiza estado del registro.
    await prisma.notificacion.update({
      where: { id: notificacion.id },
      data: {
        estadoEnvio: resultado.ok ? 'ENVIADO' : 'FALLIDO',
        fechaEnvio: resultado.ok ? new Date() : null,
      },
    })

    // g) Sin excepciones al llamador.
    if (!resultado.ok) {
      console.error(
        `[notificationService] Notificación ${notificacion.id} FALLIDA: ${resultado.error}`,
      )
      return { ok: false, error: resultado.error, notificacionId: notificacion.id }
    }
    return { ok: true, notificacionId: notificacion.id, previewUrl: resultado.previewUrl }
  } catch (err) {
    // Cualquier error inesperado (incl. fallo al crear/actualizar el registro).
    console.error('[notificationService] Error inesperado:', err)
    if (notificacion) {
      try {
        await prisma.notificacion.update({
          where: { id: notificacion.id },
          data: { estadoEnvio: 'FALLIDO', fechaEnvio: null },
        })
      } catch {
        /* ignora fallo secundario al actualizar */
      }
    }
    return { ok: false, error: err.message, notificacionId: notificacion?.id }
  }
}

const notificationService = { send }
export default notificationService
export { send }

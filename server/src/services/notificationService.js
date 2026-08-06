import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'
import webpush from 'web-push'
import { prisma } from './db.js'

// Capa adapter de notificaciones (CONTEXT.md §9).
// Interfaz fija: notificationService.send({ tipo, canal, destinatario, payload })
//
// El envío es best-effort: nunca lanza al llamador. Devuelve
//   { ok: true, notificacionId } | { ok: false, error }

// Recordatorio de cita: el texto se construye DINÁMICAMENTE a partir del tiempo
// REAL que falta (payload.minutosRestantes, ya calculado con la zona horaria del
// profesional) + la hora exacta local. Nunca es un texto fijo por marca 48/24/3h:
// así, aunque el job dispare en el borde de la ventana de tolerancia, el mensaje
// es siempre preciso. Siempre se incluye la fecha+hora exacta como referencia
// inequívoca, además de la cuenta atrás aproximada.
const REMINDER_L = {
  ES: {
    asuntoBase: 'Recordatorio de tu cita',
    asuntoCon: (cuando) => `Recordatorio: tu cita ${cuando}`,
    cuando: (min) => {
      const horas = Math.round(min / 60)
      if (min < 30) return 'muy pronto'
      if (min < 90) return 'en aproximadamente 1 hora'
      if (horas < 21) return `en aproximadamente ${horas} horas`
      if (horas <= 30) return 'mañana'
      const dias = Math.round(horas / 24)
      return `en aproximadamente ${dias} ${dias === 1 ? 'día' : 'días'}`
    },
    cuerpo: ({ profesional, fechaLocal, hora, cuando, cerca }) => {
      const con = profesional ? ` con ${profesional}` : ''
      const cabeza = cuando ? `📅 Recordatorio: tu cita${con} es ${cuando}` : `📅 Recordatorio de tu cita${con}`
      const cola = cerca ? 'Llega 10 minutos antes.' : 'Si lo necesitas, puedes cancelar con antelación.'
      return `${cabeza} — el ${fechaLocal} a las ${hora}. ${cola}`
    },
  },
  EN: {
    asuntoBase: 'Appointment reminder',
    asuntoCon: (cuando) => `Reminder: your appointment ${cuando}`,
    cuando: (min) => {
      const horas = Math.round(min / 60)
      if (min < 30) return 'very soon'
      if (min < 90) return 'in about 1 hour'
      if (horas < 21) return `in about ${horas} hours`
      if (horas <= 30) return 'tomorrow'
      const dias = Math.round(horas / 24)
      return `in about ${dias} ${dias === 1 ? 'day' : 'days'}`
    },
    cuerpo: ({ profesional, fechaLocal, hora, cuando, cerca }) => {
      const con = profesional ? ` with ${profesional}` : ''
      const cabeza = cuando ? `📅 Reminder: your appointment${con} is ${cuando}` : `📅 Reminder of your appointment${con}`
      const cola = cerca ? 'Arrive 10 minutes early.' : 'You can cancel in advance if needed.'
      return `${cabeza} — on ${fechaLocal} at ${hora}. ${cola}`
    },
  },
  FR: {
    asuntoBase: 'Rappel de votre rendez-vous',
    asuntoCon: (cuando) => `Rappel : votre rendez-vous ${cuando}`,
    cuando: (min) => {
      const horas = Math.round(min / 60)
      if (min < 30) return 'très bientôt'
      if (min < 90) return 'dans environ 1 heure'
      if (horas < 21) return `dans environ ${horas} heures`
      if (horas <= 30) return 'demain'
      const dias = Math.round(horas / 24)
      return `dans environ ${dias} ${dias === 1 ? 'jour' : 'jours'}`
    },
    cuerpo: ({ profesional, fechaLocal, hora, cuando, cerca }) => {
      const con = profesional ? ` avec ${profesional}` : ''
      const cabeza = cuando ? `📅 Rappel : votre rendez-vous${con} est ${cuando}` : `📅 Rappel de votre rendez-vous${con}`
      const cola = cerca ? 'Arrivez 10 minutes plus tôt.' : 'Vous pouvez annuler à l’avance si nécessaire.'
      return `${cabeza} — le ${fechaLocal} à ${hora}. ${cola}`
    },
  },
}

/** Construye el recordatorio dinámico (asunto + texto) en el idioma dado. */
function construirRecordatorio(payload, idioma) {
  const L = REMINDER_L[idioma] || REMINDER_L.ES
  const min = Number.isFinite(payload.minutosRestantes) ? payload.minutosRestantes : null
  const cuando = min != null ? L.cuando(min) : null
  const cerca = min != null && min <= 4 * 60
  const asunto = cuando ? L.asuntoCon(cuando) : L.asuntoBase
  const texto = L.cuerpo({
    profesional: payload.profesional,
    fechaLocal: payload.fechaLocal || payload.fecha,
    hora: payload.hora,
    cuando,
    cerca,
  })
  return { asunto, texto }
}

// Línea de videoconferencia añadida a los recordatorios (por idioma).
const VIDEO_LINE = {
  ES: (enlace) => `\n\n💻 Tu cita es por videoconferencia. Únete aquí: ${enlace}`,
  EN: (enlace) => `\n\n💻 Your appointment is by video call. Join here: ${enlace}`,
  FR: (enlace) => `\n\n💻 Votre rendez-vous est en visioconférence. Rejoignez ici : ${enlace}`,
}

// Anulación de cita (la ve el CLIENTE) — en su idioma. `hola`/`reservar` son fijas;
// `cuerpo(p)` usa fecha ISO (neutral) y hora, y `motivo(nota)` la razón opcional.
const ANULACION_MESSAGES = {
  ES: {
    asunto: 'Tu cita ha sido anulada',
    hola: 'Hola,',
    cuerpo: (p) => `Tu cita del ${p.fecha} a las ${p.horaInicio} ha sido anulada.`,
    motivo: (nota) => `Motivo: ${nota}`,
    reservar: 'Puedes volver a reservar cuando lo necesites.',
  },
  EN: {
    asunto: 'Your appointment has been cancelled',
    hola: 'Hello,',
    cuerpo: (p) => `Your appointment on ${p.fecha} at ${p.horaInicio} has been cancelled.`,
    motivo: (nota) => `Reason: ${nota}`,
    reservar: 'You can book again whenever you need to.',
  },
  FR: {
    asunto: 'Votre rendez-vous a été annulé',
    hola: 'Bonjour,',
    cuerpo: (p) => `Votre rendez-vous du ${p.fecha} à ${p.horaInicio} a été annulé.`,
    motivo: (nota) => `Motif : ${nota}`,
    reservar: 'Vous pouvez reprendre rendez-vous quand vous le souhaitez.',
  },
}

// Resumen diario de citas (lo ve el PROFESIONAL) — en su idioma.
const RESUMEN_MESSAGES = {
  ES: { asunto: 'Resumen de citas del día', encabezado: (n) => `Tienes ${n} cita(s) confirmada(s) hoy:` },
  EN: { asunto: 'Daily appointment summary', encabezado: (n) => `You have ${n} confirmed appointment(s) today:` },
  FR: { asunto: 'Résumé des rendez-vous du jour', encabezado: (n) => `Vous avez ${n} rendez-vous confirmé(s) aujourd’hui :` },
}

// ── Construcción del mensaje según el tipo (y el idioma) ──────────────────────
// Exportada para pruebas de las plantillas por idioma (sin enviar nada real).
export function construirMensaje(tipo, payload = {}, idioma = 'ES') {
  if (tipo === 'ANULACION') {
    const m = ANULACION_MESSAGES[idioma] || ANULACION_MESSAGES.ES
    const lineas = [m.hola, '', m.cuerpo(payload)]
    if (payload.notaAnulacion) lineas.push(m.motivo(payload.notaAnulacion))
    lineas.push('', m.reservar)
    const texto = lineas.join('\n')
    return {
      asunto: m.asunto,
      texto,
      html: `<p>${texto.replace(/\n/g, '<br>')}</p>`,
    }
  }

  if (tipo === 'RESUMEN_DIARIO') {
    const m = RESUMEN_MESSAGES[idioma] || RESUMEN_MESSAGES.ES
    const citas = payload.citas || []
    const items = citas.map((c) => `• ${c.horaInicio} - ${c.horaFin}`).join('\n')
    const texto = `${m.encabezado(citas.length)}\n${items}`
    return {
      asunto: m.asunto,
      texto,
      html: `<p>${texto.replace(/\n/g, '<br>')}</p>`,
    }
  }

  // Recordatorio automático de cita: se construye en el idioma del cliente, con
  // texto DINÁMICO según el tiempo real restante (nunca fijo por marca 48/24/3h).
  if (tipo === 'RECORDATORIO_CITA') {
    const lang = REMINDER_L[idioma] ? idioma : 'ES'
    const { asunto } = construirRecordatorio(payload, lang)
    let texto = construirRecordatorio(payload, lang).texto
    // Si la cita es por videoconferencia, adjunta el enlace para unirse.
    if (payload.enlaceVideoconferencia) {
      texto += (VIDEO_LINE[lang] || VIDEO_LINE.ES)(payload.enlaceVideoconferencia)
    }
    return { asunto, texto, html: `<p>${texto.replace(/\n/g, '<br>')}</p>` }
  }

  // Genérico (fallback).
  const texto = JSON.stringify(payload)
  return { asunto: `Notificación: ${tipo}`, texto, html: `<pre>${texto}</pre>` }
}

// ── Email por SendGrid ────────────────────────────────────────────────────────
// IMPORTANTE: los canales devuelven `delivered` = hubo ENTREGA REAL confirmada.
// Solo `delivered: true` cuenta como enviado en la auditoría (notificacionEnviada)
// y como estado ENVIADO. Ethereal (solo dev) procesa pero NUNCA es delivered, para
// no marcar como enviado un correo que en realidad no llegó a nadie real.
let sendgridListo = null

function configurarSendgrid() {
  if (sendgridListo !== null) return sendgridListo
  const { SENDGRID_API_KEY } = process.env
  if (!SENDGRID_API_KEY) {
    sendgridListo = false
    return false
  }
  sgMail.setApiKey(SENDGRID_API_KEY)
  sendgridListo = true
  return true
}

// Transporte Ethereal SOLO para previsualizar en desarrollo local (nunca en prod).
let etherealCache = null
async function getEtherealTransport() {
  if (etherealCache) return etherealCache
  const testAccount = await nodemailer.createTestAccount()
  etherealCache = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  })
  console.log('[notificationService] (dev) Ethereal para previsualizar:', testAccount.user)
  return etherealCache
}

// ── Implementaciones por canal ───────────────────────────────────────────────
async function enviarEmail({ destinatario, asunto, texto, html }) {
  if (!destinatario?.correo) return { ok: false, delivered: false, error: 'Destinatario sin correo' }

  const from = process.env.SENDGRID_FROM_EMAIL
  // Ruta real: SendGrid (el mismo que usa contacto/activación en producción).
  if (configurarSendgrid() && from) {
    try {
      await sgMail.send({ to: destinatario.correo, from, subject: asunto, text: texto, html })
      return { ok: true, delivered: true }
    } catch (err) {
      const detalle = err?.response?.body?.errors?.[0]?.message || err.message
      return { ok: false, delivered: false, error: `SendGrid: ${detalle}` }
    }
  }

  // Sin SendGrid configurado:
  // - En producción NO se envía nada (evita falsos positivos y colas ciegas).
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, delivered: false, error: 'Email no configurado (falta SendGrid)' }
  }
  // - En desarrollo, Ethereal solo para previsualizar; delivered:false a propósito.
  try {
    const transporter = await getEtherealTransport()
    const info = await transporter.sendMail({
      from: from || '"Kohtun" <no-reply@kohtun.com>',
      to: destinatario.correo,
      subject: asunto,
      text: texto,
      html,
    })
    const previewUrl = nodemailer.getTestMessageUrl(info)
    console.log('[notificationService] (dev) Vista previa Ethereal:', previewUrl)
    return { ok: true, delivered: false, previewUrl }
  } catch (e) {
    return { ok: false, delivered: false, error: e.message }
  }
}

function enviarSMS({ destinatario, texto }) {
  // Mock: listo para Twilio más adelante (CONTEXT.md §9), sin implementar aún.
  console.log(
    `[notificationService][SMS mock] -> ${destinatario?.telefono || '(sin teléfono)'}: ${texto}`,
  )
  return { ok: true, delivered: false } // mock: nunca es entrega real
}

// ── WhatsApp vía Meta Cloud API ──────────────────────────────────────────────
// Envío real por la WhatsApp Cloud API de Meta. Variables de entorno:
//   WHATSAPP_PHONE_NUMBER_ID   (id del número emisor)
//   WHATSAPP_ACCESS_TOKEN      (Bearer token de la app de Meta)
//   WHATSAPP_BUSINESS_ACCOUNT_ID (WABA id; para administración, no lo usa el envío)
//
// ⚠️ MODO PRUEBA (número de prueba de Meta): la Cloud API SOLO entrega mensajes a
// números añadidos previamente como "destinatarios de prueba" (recipients) en el
// panel de Meta (WhatsApp → API Setup). A cualquier otro número la API responde
// con error. Al migrar a un número propio verificado esta restricción desaparece.
//
// Best-effort: nunca lanza; devuelve { ok:false, error } si algo falla, de modo
// que un fallo de WhatsApp NO impide el envío del email (son send() separados).
async function enviarWhatsApp({ destinatario, texto }) {
  if (!destinatario?.telefono) return { ok: false, delivered: false, error: 'Destinatario sin teléfono' }

  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } = process.env
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('[notificationService][WhatsApp] Sin credenciales configuradas; se omite el envío.')
    return { ok: false, delivered: false, error: 'WhatsApp no configurado (faltan credenciales)' }
  }

  // Meta exige el número en formato internacional SIN "+", espacios ni guiones.
  const to = String(destinatario.telefono).replace(/\D/g, '')
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: texto },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      // Error de la API de Meta (ej. número no está en la lista de prueba, token
      // expirado, etc.). Se loguea y se devuelve fallo SIN lanzar.
      const apiError = data?.error?.message || `HTTP ${res.status}`
      console.error(`[notificationService][WhatsApp] ❌ Fallo a ${to}: ${apiError}`)
      return { ok: false, delivered: false, error: `WhatsApp API: ${apiError}` }
    }

    const msgId = data?.messages?.[0]?.id || '(sin id)'
    console.log(`[notificationService][WhatsApp] ✅ Enviado a ${to} (message id: ${msgId})`)
    return { ok: true, delivered: true }
  } catch (err) {
    // Fallo de red / DNS / timeout: nunca interrumpe el resto de notificaciones.
    console.error(`[notificationService][WhatsApp] ❌ Error de red a ${to}: ${err.message}`)
    return { ok: false, delivered: false, error: `WhatsApp red: ${err.message}` }
  }
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

async function enviarPush({ destinatario, asunto, texto, url }) {
  if (!configurarPush()) {
    console.warn('[notificationService] Push sin VAPID keys; se marca FALLIDO.')
    return { ok: false, delivered: false, error: 'VAPID keys no configuradas' }
  }
  if (!destinatario?.pushSubscription) {
    return { ok: false, delivered: false, error: 'Destinatario sin pushSubscription' }
  }
  try {
    await webpush.sendNotification(
      destinatario.pushSubscription,
      JSON.stringify({ title: asunto, body: texto, url: url || '/' }),
    )
    return { ok: true, delivered: true }
  } catch (e) {
    // statusCode 404/410 = suscripción expirada o dada de baja: el llamador
    // puede usarlo para limpiarla de la base de datos.
    return { ok: false, delivered: false, error: e.message, statusCode: e.statusCode }
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
      resultado = await enviarWhatsApp({ destinatario, texto })
    } else if (canal === 'PUSH') {
      resultado = await enviarPush({ destinatario, asunto, texto, url: destinatario.pushUrl })
    } else {
      resultado = { ok: false, error: `Canal desconocido: ${canal}` }
    }

    // f) Actualiza estado del registro. SOLO se marca ENVIADO si hubo ENTREGA
    //    REAL confirmada (delivered); una respuesta ok pero no entregada (p.ej.
    //    Ethereal en dev) queda FALLIDO para no ocultar que no llegó.
    const entregado = resultado.delivered === true
    await prisma.notificacion.update({
      where: { id: notificacion.id },
      data: {
        estadoEnvio: entregado ? 'ENVIADO' : 'FALLIDO',
        fechaEnvio: entregado ? new Date() : null,
      },
    })

    // g) Sin excepciones al llamador.
    if (!entregado) {
      console.error(
        `[notificationService] Notificación ${notificacion.id} NO entregada (${canal}): ${resultado.error || 'sin entrega confirmada'}`,
      )
      return {
        ok: resultado.ok === true,
        delivered: false,
        error: resultado.error,
        statusCode: resultado.statusCode,
        previewUrl: resultado.previewUrl,
        notificacionId: notificacion.id,
      }
    }
    return { ok: true, delivered: true, notificacionId: notificacion.id, previewUrl: resultado.previewUrl }
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

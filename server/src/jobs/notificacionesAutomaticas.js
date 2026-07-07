// Recordatorios automáticos de cita (48h / 24h / 3h antes).
// Corre cada hora (node-cron "0 * * * *"). Best-effort: si un email falla, se
// loguea pero no interrumpe el resto.

import cron from 'node-cron'
import { prisma } from '../services/db.js'
import notificationService from '../services/notificationService.js'

const TOLERANCIA_MIN = 5 // ventana ±5 min alrededor de la marca exacta
const MARCAS = [
  { tipo: '48h', minutos: 48 * 60 },
  { tipo: '24h', minutos: 24 * 60 },
  { tipo: '3h', minutos: 3 * 60 },
]

// El idioma del cliente no se persiste en el servidor (vive en el navegador),
// así que los recordatorios usan el idioma por defecto de la app.
const LANG_DEFECTO = 'es'

// ── Plantillas por idioma (ES / EN / FR) para EMAIL y WhatsApp ───────────────
// ctx = { fecha: "YYYY-MM-DD", hora: "HH:mm", profesional: string }
// email: (ctx) => { asunto, texto } ; whatsapp: (ctx) => texto
const MENSAJES = {
  es: {
    '48h': {
      email: (c) => ({
        asunto: 'Recordatorio: tu cita en 48 horas',
        texto: `Recordatorio: tu cita es el ${c.fecha} a las ${c.hora} (en 48 horas). La cancelación tiene costo si es después de esta fecha.`,
      }),
      whatsapp: () => '📅 Recordatorio: Tu cita en 48 horas. Cancélala antes de esta fecha si necesitas. Costo si cancelas después.',
    },
    '24h': {
      email: (c) => ({
        asunto: 'Recordatorio: tu cita mañana',
        texto: `Recordatorio: tu cita es mañana a las ${c.hora}.`,
      }),
      whatsapp: (c) => `📅 ¡Mañana es tu cita! A las ${c.hora} con ${c.profesional}. ¿Confirmas tu asistencia?`,
    },
    '3h': {
      email: (c) => ({
        asunto: 'Tu cita comienza en 3 horas',
        texto: `Tu cita comienza en 3 horas (a las ${c.hora}). Llega 10 minutos antes.`,
      }),
      whatsapp: () => '⏰ Tu cita comienza en 3 horas. Llega 10 minutos antes por favor.',
    },
  },
  en: {
    '48h': {
      email: (c) => ({
        asunto: 'Reminder: your appointment in 48 hours',
        texto: `Reminder: your appointment is on ${c.fecha} at ${c.hora} (in 48 hours). Cancellation has a fee if made after this date.`,
      }),
      whatsapp: () => '📅 Reminder: Your appointment is in 48 hours. Cancel before this date if you need to. There is a fee if you cancel afterwards.',
    },
    '24h': {
      email: (c) => ({
        asunto: 'Reminder: your appointment tomorrow',
        texto: `Reminder: your appointment is tomorrow at ${c.hora}.`,
      }),
      whatsapp: (c) => `📅 Your appointment is tomorrow! At ${c.hora} with ${c.profesional}. Can you confirm your attendance?`,
    },
    '3h': {
      email: (c) => ({
        asunto: 'Your appointment starts in 3 hours',
        texto: `Your appointment starts in 3 hours (at ${c.hora}). Please arrive 10 minutes early.`,
      }),
      whatsapp: () => '⏰ Your appointment starts in 3 hours. Please arrive 10 minutes early.',
    },
  },
  fr: {
    '48h': {
      email: (c) => ({
        asunto: 'Rappel : votre rendez-vous dans 48 heures',
        texto: `Rappel : votre rendez-vous est le ${c.fecha} à ${c.hora} (dans 48 heures). L'annulation est payante si elle est faite après cette date.`,
      }),
      whatsapp: () => '📅 Rappel : votre rendez-vous est dans 48 heures. Annulez avant cette date si besoin. Des frais s\'appliquent si vous annulez après.',
    },
    '24h': {
      email: (c) => ({
        asunto: 'Rappel : votre rendez-vous demain',
        texto: `Rappel : votre rendez-vous est demain à ${c.hora}.`,
      }),
      whatsapp: (c) => `📅 C'est demain votre rendez-vous ! À ${c.hora} avec ${c.profesional}. Confirmez-vous votre présence ?`,
    },
    '3h': {
      email: (c) => ({
        asunto: 'Votre rendez-vous commence dans 3 heures',
        texto: `Votre rendez-vous commence dans 3 heures (à ${c.hora}). Merci d'arriver 10 minutes en avance.`,
      }),
      whatsapp: () => '⏰ Votre rendez-vous commence dans 3 heures. Merci d\'arriver 10 minutes en avance.',
    },
  },
}

/** Instante (Date) de una cita a partir de su fecha (medianoche UTC) y horaInicio. */
function instanteCita(cita) {
  const ymd = cita.fecha.toISOString().slice(0, 10)
  return new Date(`${ymd}T${cita.horaInicio}:00.000Z`)
}

/**
 * Ejecuta una pasada: busca citas CONFIRMADAS en los próximos 3 días y envía
 * los recordatorios cuya marca (48/24/3h) cae dentro de la tolerancia.
 * @returns {Promise<{revisadas:number, enviados:number, fallidos:number}>}
 */
export async function ejecutar(ahora = new Date()) {
  const en3dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000)
  const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000) // margen por zona horaria

  const citas = await prisma.cita.findMany({
    where: { estado: 'CONFIRMADA', fecha: { gte: desde, lte: en3dias } },
    include: {
      paciente: { select: { id: true, correo: true, telefono: true } },
      medico: { select: { nombre: true } },
    },
  })

  let enviados = 0
  let fallidos = 0

  for (const cita of citas) {
    const diffMin = (instanteCita(cita) - ahora) / 60000
    for (const marca of MARCAS) {
      if (Math.abs(diffMin - marca.minutos) > TOLERANCIA_MIN) continue

      try {
        // ¿Ya se envió este tipo para esta cita? (auditoría)
        const yaEnviado = await prisma.notificacionEnviada.findUnique({
          where: { citaId_tipo: { citaId: cita.id, tipo: marca.tipo } },
        })
        if (yaEnviado) continue

        const plantilla = MENSAJES[LANG_DEFECTO][marca.tipo]
        const ctx = {
          fecha: cita.fecha.toISOString().slice(0, 10),
          hora: cita.horaInicio,
          profesional: cita.medico?.nombre || '',
        }
        const destinatario = {
          id: cita.paciente.id,
          tipoDestinatario: 'PACIENTE',
          correo: cita.paciente.correo,
          telefono: cita.paciente.telefono,
        }

        let algunOk = false

        // 1) EMAIL
        if (cita.paciente?.correo) {
          const { asunto, texto } = plantilla.email(ctx)
          const r = await notificationService.send({
            tipo: 'RECORDATORIO_CITA',
            canal: 'EMAIL',
            destinatario,
            payload: { asunto, texto, citaId: cita.id, marca: marca.tipo },
          })
          if (r.ok) { algunOk = true; enviados++ } else { fallidos++; console.error(`[notificacionesAutomaticas] cita ${cita.id} ${marca.tipo} EMAIL falló: ${r.error}`) }
        }

        // 2) WHATSAPP
        if (cita.paciente?.telefono) {
          const texto = plantilla.whatsapp(ctx)
          const r = await notificationService.send({
            tipo: 'RECORDATORIO_CITA',
            canal: 'WHATSAPP',
            destinatario,
            payload: { texto, citaId: cita.id, marca: marca.tipo },
          })
          if (r.ok) { algunOk = true; enviados++ } else { fallidos++; console.error(`[notificacionesAutomaticas] cita ${cita.id} ${marca.tipo} WHATSAPP falló: ${r.error}`) }
        }

        // Registra la auditoría si al menos un canal se envió (evita reenvíos).
        if (algunOk) {
          await prisma.notificacionEnviada.create({
            data: { citaId: cita.id, tipo: marca.tipo },
          })
        }
      } catch (err) {
        // Un fallo con una cita nunca interrumpe el resto.
        fallidos++
        console.error(`[notificacionesAutomaticas] error en cita ${cita.id} ${marca.tipo}:`, err.message)
      }
    }
  }

  return { revisadas: citas.length, enviados, fallidos }
}

/** Programa el job cada hora. */
export function iniciar() {
  cron.schedule('0 * * * *', async () => {
    try {
      const r = await ejecutar()
      console.log(`[notificacionesAutomaticas] pasada: revisadas=${r.revisadas} enviados=${r.enviados} fallidos=${r.fallidos}`)
    } catch (err) {
      console.error('[notificacionesAutomaticas] la pasada falló:', err)
    }
  })
  console.log('[notificacionesAutomaticas] job programado (cada hora, "0 * * * *")')
}

export default { iniciar, ejecutar }

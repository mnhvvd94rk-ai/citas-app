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

// ── Traducciones del texto del email (ES / EN / FR) ──────────────────────────
// ctx = { fecha: "YYYY-MM-DD", hora: "HH:mm" }
const MENSAJES = {
  es: {
    '48h': (c) => ({
      asunto: 'Recordatorio: tu cita en 48 horas',
      texto: `Recordatorio: tu cita es el ${c.fecha} a las ${c.hora} (en 48 horas). La cancelación tiene costo si es después de esta fecha.`,
    }),
    '24h': (c) => ({
      asunto: 'Recordatorio: tu cita mañana',
      texto: `Recordatorio: tu cita es mañana a las ${c.hora}.`,
    }),
    '3h': (c) => ({
      asunto: 'Tu cita comienza en 3 horas',
      texto: `Tu cita comienza en 3 horas (a las ${c.hora}). Llega 10 minutos antes.`,
    }),
  },
  en: {
    '48h': (c) => ({
      asunto: 'Reminder: your appointment in 48 hours',
      texto: `Reminder: your appointment is on ${c.fecha} at ${c.hora} (in 48 hours). Cancellation has a fee if made after this date.`,
    }),
    '24h': (c) => ({
      asunto: 'Reminder: your appointment tomorrow',
      texto: `Reminder: your appointment is tomorrow at ${c.hora}.`,
    }),
    '3h': (c) => ({
      asunto: 'Your appointment starts in 3 hours',
      texto: `Your appointment starts in 3 hours (at ${c.hora}). Please arrive 10 minutes early.`,
    }),
  },
  fr: {
    '48h': (c) => ({
      asunto: 'Rappel : votre rendez-vous dans 48 heures',
      texto: `Rappel : votre rendez-vous est le ${c.fecha} à ${c.hora} (dans 48 heures). L'annulation est payante si elle est faite après cette date.`,
    }),
    '24h': (c) => ({
      asunto: 'Rappel : votre rendez-vous demain',
      texto: `Rappel : votre rendez-vous est demain à ${c.hora}.`,
    }),
    '3h': (c) => ({
      asunto: 'Votre rendez-vous commence dans 3 heures',
      texto: `Votre rendez-vous commence dans 3 heures (à ${c.hora}). Merci d'arriver 10 minutes en avance.`,
    }),
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
    include: { paciente: { select: { id: true, correo: true, telefono: true } } },
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

        if (!cita.paciente?.correo) {
          console.warn(`[notificacionesAutomaticas] cita ${cita.id} sin correo del cliente; se omite`)
          continue
        }

        const ctx = { fecha: cita.fecha.toISOString().slice(0, 10), hora: cita.horaInicio }
        const { asunto, texto } = MENSAJES[LANG_DEFECTO][marca.tipo](ctx)

        const res = await notificationService.send({
          tipo: 'RECORDATORIO_CITA',
          canal: 'EMAIL',
          destinatario: {
            id: cita.paciente.id,
            tipoDestinatario: 'PACIENTE',
            correo: cita.paciente.correo,
          },
          payload: { asunto, texto, citaId: cita.id, marca: marca.tipo },
        })

        if (res.ok) {
          // Registra la auditoría solo si el envío fue correcto.
          await prisma.notificacionEnviada.create({
            data: { citaId: cita.id, tipo: marca.tipo },
          })
          enviados++
        } else {
          fallidos++
          console.error(`[notificacionesAutomaticas] cita ${cita.id} ${marca.tipo} falló: ${res.error}`)
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

// Recordatorios automáticos de cita (48h / 24h / 3h antes).
// Corre cada hora (node-cron "0 * * * *"). Best-effort: si un envío falla, se
// loguea pero no interrumpe el resto. El texto se construye en el idioma
// preferido del cliente dentro de notificationService.

import cron from 'node-cron'
import { prisma } from '../services/db.js'
import notificationService from '../services/notificationService.js'

const TOLERANCIA_MIN = 5 // ventana ±5 min alrededor de la marca exacta
const MARCAS = [
  { tipo: '48h', minutos: 48 * 60 },
  { tipo: '24h', minutos: 24 * 60 },
  { tipo: '3h', minutos: 3 * 60 },
]

/** Instante (Date) de una cita a partir de su fecha (medianoche UTC) y horaInicio. */
function instanteCita(cita) {
  const ymd = cita.fecha.toISOString().slice(0, 10)
  return new Date(`${ymd}T${cita.horaInicio}:00.000Z`)
}

/**
 * Ejecuta una pasada: busca citas CONFIRMADAS en los próximos 3 días y envía
 * los recordatorios (EMAIL + WhatsApp) cuya marca (48/24/3h) cae en la tolerancia.
 * @returns {Promise<{revisadas:number, enviados:number, fallidos:number}>}
 */
export async function ejecutar(ahora = new Date()) {
  const en3dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000)
  const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000) // margen por zona horaria

  const citas = await prisma.cita.findMany({
    where: { estado: 'CONFIRMADA', fecha: { gte: desde, lte: en3dias } },
    include: {
      paciente: { select: { id: true, correo: true, telefono: true, idiomaPreferido: true } },
      medico: { select: { nombre: true, idiomaPreferido: true } },
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

        // Idioma del cliente (para su email/WhatsApp/push) y del profesional
        // (para su propio push) — cada uno en su idiomaPreferido.
        const idioma = cita.paciente?.idiomaPreferido || 'ES'
        const idiomaMedico = cita.medico?.idiomaPreferido || 'ES'
        const destinatario = {
          id: cita.paciente.id,
          tipoDestinatario: 'PACIENTE',
          correo: cita.paciente.correo,
          telefono: cita.paciente.telefono,
        }
        const payload = {
          marca: marca.tipo,
          hora: cita.horaInicio,
          profesional: cita.medico?.nombre || '',
          citaId: cita.id,
          enlaceVideoconferencia:
            cita.tipoCita === 'VIDEOCONFERENCIA' ? cita.enlaceVideoconferencia : null,
        }

        // Solo una ENTREGA REAL confirmada (delivered) marca la cita como
        // notificada; así un canal fallido se reintenta en la próxima corrida.
        let algunEntregado = false

        // 1) EMAIL
        if (cita.paciente?.correo) {
          const r = await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'EMAIL', idioma, destinatario, payload })
          if (r.delivered) { algunEntregado = true; enviados++ } else { fallidos++; console.error(`[notificacionesAutomaticas] cita ${cita.id} ${marca.tipo} EMAIL no entregado: ${r.error}`) }
        }

        // 2) WHATSAPP
        if (cita.paciente?.telefono) {
          const r = await notificationService.send({ tipo: 'RECORDATORIO_CITA', canal: 'WHATSAPP', idioma, destinatario, payload })
          if (r.delivered) { algunEntregado = true; enviados++ } else { fallidos++; console.error(`[notificacionesAutomaticas] cita ${cita.id} ${marca.tipo} WHATSAPP no entregado: ${r.error}`) }
        }

        // 3) PUSH (Web Push) — a las suscripciones del cliente y del profesional.
        // Canal independiente: un fallo aquí (p.ej. suscripción expirada) no afecta
        // a Email/WhatsApp. Las suscripciones caducadas (404/410) se eliminan.
        const pushTargets = [
          { where: { clienteId: cita.paciente.id }, tipoDestinatario: 'PACIENTE', id: cita.paciente.id, pushUrl: '/paciente/citas', idiomaPush: idioma },
          { where: { profesionalId: cita.medicoId }, tipoDestinatario: 'MEDICO', id: cita.medicoId, pushUrl: '/gestor/agenda', idiomaPush: idiomaMedico },
        ]
        for (const target of pushTargets) {
          const subs = await prisma.pushSubscription.findMany({ where: target.where })
          for (const sub of subs) {
            const r = await notificationService.send({
              tipo: 'RECORDATORIO_CITA',
              canal: 'PUSH',
              idioma: target.idiomaPush,
              destinatario: {
                id: target.id,
                tipoDestinatario: target.tipoDestinatario,
                pushSubscription: { endpoint: sub.endpoint, keys: sub.keys },
                pushUrl: target.pushUrl,
              },
              payload,
            })
            if (r.delivered) {
              algunEntregado = true
              enviados++
            } else {
              fallidos++
              console.error(`[notificacionesAutomaticas] cita ${cita.id} ${marca.tipo} PUSH no entregado: ${r.error}`)
              if (r.statusCode === 404 || r.statusCode === 410) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
              }
            }
          }
        }

        // Solo se marca como notificada si HUBO entrega real en algún canal; si
        // no, no se registra y se reintentará en la próxima corrida (cada 5 min)
        // mientras la marca siga dentro de la ventana de tolerancia.
        if (algunEntregado) {
          await prisma.notificacionEnviada.create({ data: { citaId: cita.id, tipo: marca.tipo } })
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

/** Programa el job cada 5 minutos. Correr cada 5 min (no cada hora) garantiza
 *  que la marca 48/24/3h de CUALQUIER cita caiga dentro de alguna corrida
 *  (ventana ±5 min), sin importar en qué minuto de la hora empiece la cita. */
export function iniciar() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const r = await ejecutar()
      console.log(`[notificacionesAutomaticas] pasada: revisadas=${r.revisadas} enviados=${r.enviados} fallidos=${r.fallidos}`)
    } catch (err) {
      console.error('[notificacionesAutomaticas] la pasada falló:', err)
    }
  })
  console.log('[notificacionesAutomaticas] job programado (cada 5 min, "*/5 * * * *")')
}

export default { iniciar, ejecutar }

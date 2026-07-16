import { prisma } from '../services/db.js'
import notificationService from '../services/notificationService.js'

// Job de resumen diario para el gestor/médico (CONTEXT.md §5.6).
// Reutiliza notificationService. Diseñado para correr de forma aislada
// (no depende de que Express esté arriba) — ver runDailySummaryNow.js.

/** Fecha de "hoy" a medianoche UTC (consistente con el resto del sistema). */
function hoyMedianocheUTC() {
  const ahora = new Date()
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
}

/**
 * Recorre todos los médicos y, para los que tengan citas CONFIRMADA hoy,
 * les envía un resumen por email vía notificationService.
 * @returns {Promise<{ medicosProcesados:number, enviados:number, fallidos:number }>}
 */
export async function runDailySummary() {
  const hoy = hoyMedianocheUTC()
  const fechaISO = hoy.toISOString().slice(0, 10)
  console.log(`[dailySummary] Ejecutando resumen para ${fechaISO} (UTC)...`)

  const medicos = await prisma.medico.findMany()
  let enviados = 0
  let fallidos = 0

  for (const medico of medicos) {
    const citas = await prisma.cita.findMany({
      where: { medicoId: medico.id, fecha: hoy, estado: 'CONFIRMADA' },
      include: { paciente: { select: { nombre: true, apellido: true } } },
      orderBy: { horaInicio: 'asc' },
    })

    // c) Sin citas confirmadas hoy → no se notifica (evita ruido).
    if (citas.length === 0) continue

    // d) Payload con la lista de citas del día.
    const payload = {
      fecha: fechaISO,
      citas: citas.map((c) => ({
        horaInicio: c.horaInicio,
        horaFin: c.horaFin,
        paciente: `${c.paciente.nombre} ${c.paciente.apellido}`,
      })),
    }

    const resultado = await notificationService.send({
      tipo: 'RESUMEN_DIARIO',
      canal: 'EMAIL',
      // El resumen lo recibe el PROFESIONAL: se envía en su idioma preferido.
      idioma: medico.idiomaPreferido || 'ES',
      destinatario: {
        id: medico.id,
        tipoDestinatario: 'MEDICO',
        correo: medico.correo,
      },
      payload,
    })

    if (resultado.ok) {
      enviados++
      console.log(
        `[dailySummary] Médico ${medico.id} (${medico.correo}): ${citas.length} cita(s) → ENVIADO (notificación ${resultado.notificacionId}).`,
      )
    } else {
      fallidos++
      console.warn(
        `[dailySummary] Médico ${medico.id} (${medico.correo}): ${citas.length} cita(s) → FALLIDO: ${resultado.error}`,
      )
    }
  }

  // e) Resumen de la ejecución.
  const resumen = { medicosProcesados: medicos.length, enviados, fallidos }
  console.log(
    `[dailySummary] Resumen: ${resumen.medicosProcesados} médico(s) procesado(s), ${resumen.enviados} enviado(s), ${resumen.fallidos} fallido(s).`,
  )
  return resumen
}

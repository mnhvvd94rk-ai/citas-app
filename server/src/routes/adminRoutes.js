import { Router } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../services/db.js'
import { recuperarAdmin } from '../jobs/recuperarRecordatorios.js'

// ⚠️ ENDPOINT TEMPORAL — SE ELIMINA tras la ejecución de recuperación única.
// No debe quedar como puerta permanente en producción.
const router = Router()

// Comparación en tiempo constante para el secreto (evita timing attacks).
function claveValida(recibida, esperada) {
  if (!recibida || !esperada) return false
  const a = Buffer.from(String(recibida))
  const b = Buffer.from(String(esperada))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Marca de "ya ejecutada" (un solo uso). Se guarda como fila centinela en
// NotificacionEnviada (citaId 0 no corresponde a ninguna cita real; el campo no
// tiene FK), para no requerir una migración.
const SENTINEL = { citaId: 0, tipo: 'ADMIN_RECOVERY' }

// POST /admin/recuperar-recordatorios
router.post('/recuperar-recordatorios', async (req, res) => {
  const esperada = process.env.ADMIN_RECOVERY_KEY
  if (!esperada) {
    return res.status(503).json({ error: 'Recuperación no configurada (falta ADMIN_RECOVERY_KEY en el entorno).' })
  }
  if (!claveValida(req.get('X-Admin-Recovery-Key'), esperada)) {
    return res.status(403).json({ error: 'No autorizado.' })
  }

  // Un solo uso: si ya se ejecutó, no vuelve a enviar.
  const ya = await prisma.notificacionEnviada.findUnique({
    where: { citaId_tipo: { citaId: SENTINEL.citaId, tipo: SENTINEL.tipo } },
  })
  if (ya) {
    return res.status(409).json({ error: 'La recuperación ya se ejecutó antes.', ejecutadaEn: ya.fechaEnviada })
  }

  try {
    const reporte = await recuperarAdmin()
    // Marca ejecutada (aunque algún canal individual haya fallado): el objetivo
    // es que un segundo llamado accidental no reenvíe todo.
    await prisma.notificacionEnviada.create({ data: { citaId: SENTINEL.citaId, tipo: SENTINEL.tipo } })
    res.json({ ok: true, ...reporte })
  } catch (err) {
    console.error('[admin/recuperar-recordatorios] error:', err)
    res.status(500).json({ error: 'Error al ejecutar la recuperación', detalle: err.message })
  }
})

export default router

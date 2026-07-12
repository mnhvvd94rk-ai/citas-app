import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Suscripción Web Push tal cual la entrega el navegador
// (PushSubscription.toJSON()): { endpoint, keys: { p256dh, auth }, expirationTime? }.
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.union([z.number(), z.null()]).optional(),
})

/** A partir del JWT, devuelve el par de campos de propietario de la suscripción. */
function ownerFields(user) {
  // Un dispositivo pertenece a un cliente (PACIENTE) o a un profesional (MEDICO).
  if (user.tipo === 'MEDICO') return { profesionalId: user.id, clienteId: null }
  return { clienteId: user.id, profesionalId: null }
}

// POST /push/subscribe — guarda (o actualiza) la suscripción del dispositivo,
// asociada al usuario autenticado. Idempotente por `endpoint`.
router.post('/subscribe', requireAuth, async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Suscripción inválida',
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }

  const { endpoint, keys } = parsed.data
  const owner = ownerFields(req.user)

  // Un mismo endpoint puede reasignarse a otro usuario si cambia la sesión en
  // ese dispositivo: upsert por endpoint actualiza propietario y claves.
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, keys, ...owner },
    update: { keys, ...owner },
    select: { id: true },
  })

  res.status(201).json({ ok: true, id: sub.id })
})

// DELETE /push/unsubscribe — elimina la suscripción del dispositivo (al
// desactivar notificaciones). Solo borra si pertenece al usuario autenticado.
const unsubscribeSchema = z.object({ endpoint: z.string().url() })

router.delete('/unsubscribe', requireAuth, async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'endpoint es obligatorio' })
  }

  const owner = ownerFields(req.user)
  const ownerWhere =
    req.user.tipo === 'MEDICO' ? { profesionalId: owner.profesionalId } : { clienteId: owner.clienteId }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, ...ownerWhere },
  })

  res.json({ ok: true })
})

export default router

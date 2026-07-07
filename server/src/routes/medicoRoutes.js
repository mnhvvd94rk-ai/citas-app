import { Router } from 'express'
import { prisma } from '../services/db.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// La app es una agenda personal: hay UN solo profesional. Este endpoint
// devuelve el primero registrado para que el cliente reserve con él sin tener
// que elegirlo. Cualquier usuario autenticado (cliente o profesional) puede leerlo.
router.get('/primero', requireAuth, async (req, res) => {
  const medico = await prisma.medico.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, nombre: true, especialidad: true, correo: true },
  })
  if (!medico) {
    return res.status(404).json({ error: 'No hay ningún profesional registrado todavía' })
  }
  res.json(medico)
})

export default router

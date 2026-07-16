import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { tr } from '../i18n/messages.js'

const router = Router()
router.use(requireAuth, requireRole('MEDICO'))

const schema = z.object({
  citaId: z.number().int().positive(),
  texto: z.string().min(1, 'El texto es obligatorio'),
})

// ── POST /notas-por-cita ─────────────────────────────────────────────────────
// Crea una nota vinculada a una cita concreta. El pacienteId se deriva de la
// cita; el medicoId sale del token. Verifica que la cita pertenezca al médico.
router.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }
  const { citaId, texto } = parsed.data

  const cita = await prisma.cita.findUnique({ where: { id: citaId } })
  if (!cita) return res.status(404).json({ error: tr(req.lang, 'error.citaNoEncontrada') })
  if (cita.medicoId !== req.user.id) {
    return res.status(403).json({ error: tr(req.lang, 'error.citaAjena') })
  }

  const nota = await prisma.notaPaciente.create({
    data: { pacienteId: cita.pacienteId, medicoId: req.user.id, citaId, texto },
    include: { medico: { select: { id: true, nombre: true } } },
  })
  res.status(201).json(nota)
})

export default router

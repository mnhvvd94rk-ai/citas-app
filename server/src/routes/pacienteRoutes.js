import { Router } from 'express'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'

const router = Router()

// Todas las rutas de pacientes son exclusivas del médico autenticado.
router.use(requireAuth, requireRole('MEDICO'))

// Nunca exponer passwordHash.
const PACIENTE_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  documentoIdentidad: true,
  telefono: true,
  correo: true,
  estado: true,
  fechaRegistro: true,
}

// ── GET /pacientes ───────────────────────────────────────────────────────────
// Lista todos los pacientes (sin passwordHash), ordenados por apellido.
// Las notas viven en su propio router (/notas).
router.get('/', async (req, res) => {
  const pacientes = await prisma.usuario.findMany({
    select: PACIENTE_SELECT,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })
  res.json(pacientes)
})

export default router

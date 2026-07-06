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
  fotoIdentidadUrl: true,
}

// ── GET /pacientes ───────────────────────────────────────────────────────────
// Lista todos los pacientes (sin passwordHash), ordenados por apellido, con su
// última cita (fecha/hora/estado). Las notas viven en su propio router (/notas).
router.get('/', async (req, res) => {
  const pacientes = await prisma.usuario.findMany({
    select: {
      ...PACIENTE_SELECT,
      citas: {
        select: { fecha: true, horaInicio: true, estado: true },
        orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
        take: 1,
      },
    },
    orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
  })
  // Aplana la última cita a `ultimaCita` (o null) para el frontend.
  const salida = pacientes.map(({ citas, ...p }) => ({
    ...p,
    ultimaCita: citas[0] || null,
  }))
  res.json(salida)
})

export default router

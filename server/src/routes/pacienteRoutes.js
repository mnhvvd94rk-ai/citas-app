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
const CITAS_ACTIVAS = ['CONFIRMADA', 'COMPLETADA']

router.get('/', async (req, res) => {
  const pacientes = await prisma.usuario.findMany({
    select: {
      ...PACIENTE_SELECT,
      citas: {
        select: { id: true, fecha: true, horaInicio: true, horaFin: true, estado: true },
        orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
      },
    },
    orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
  })

  // Deriva estadísticas por cliente. `edad` = null: no hay fecha de nacimiento
  // en el modelo (el OCR del documento no está implementado), así que no se
  // puede calcular una edad real sin inventarla.
  const salida = pacientes.map(({ citas, ...p }) => ({
    ...p,
    edad: null,
    ultimaCita: citas[0] || null, // orden desc → la primera es la más reciente
    primeraCita: citas.length ? citas[citas.length - 1].fecha : null,
    totalCitas: citas.filter((c) => CITAS_ACTIVAS.includes(c.estado)).length,
    historial: citas, // todas las citas (desc) para el panel expandido
  }))
  res.json(salida)
})

export default router

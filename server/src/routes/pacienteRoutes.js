import { Router } from 'express'
import { z } from 'zod'
import { randomUUID, randomBytes } from 'node:crypto'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { hashPassword } from '../services/authService.js'

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
  edadManual: true,
  estadoTratamiento: true,
  tratamientoFinalizadoEn: true,
}

const ESTADOS_TRATAMIENTO = ['ACTIVO', 'COMPLETADO', 'EN_PAUSA']
const ACTIVAS = ['PENDIENTE', 'CONFIRMADA']

/** "YYYY-MM-DD" de hoy (para calcular la próxima cita). */
function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Deriva las estadísticas y el resumen visual de un cliente a partir de sus citas. */
function conResumen({ citas, ...p }) {
  const hoy = hoyISO()
  const futurasActivas = citas
    .filter((c) => c.fecha.toISOString().slice(0, 10) >= hoy && ACTIVAS.includes(c.estado))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : a.horaInicio.localeCompare(b.horaInicio)))
  return {
    ...p,
    edad: p.edadManual ?? null, // sin fecha de nacimiento: solo la manual, si existe
    primeraCita: citas.length ? citas[citas.length - 1].fecha : null,
    totalCitasCompletadas: citas.filter((c) => c.estado === 'COMPLETADA').length,
    totalCitasAnuladas: citas.filter((c) => c.estado === 'ANULADA').length,
    proximaCita: futurasActivas[0]
      ? { fecha: futurasActivas[0].fecha, horaInicio: futurasActivas[0].horaInicio }
      : null,
    historial: citas, // todas las citas (desc) para el panel expandido
  }
}

// ── GET /pacientes ───────────────────────────────────────────────────────────
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
  res.json(pacientes.map(conResumen))
})

// ── POST /pacientes/importar ─────────────────────────────────────────────────
// Alta masiva de clientes desde un archivo (CSV/Excel) parseado en el cliente.
// El profesional envía filas ya mapeadas a {nombre, apellido?, telefono?, correo?}.
// Solo `nombre` es obligatorio; los demás son opcionales.
//
// El modelo Usuario exige documentoIdentidad y correo únicos y no nulos, además
// de passwordHash: como los clientes importados no inician sesión, se generan
// valores marcador (documento IMPORT-*, correo placeholder si falta) y una
// contraseña ALEATORIA E INDIVIDUAL por cliente que nunca se comunica a nadie.
// Al ser única por registro, aunque una se filtrara no afectaría a las demás.
const importarSchema = z.object({
  clientes: z
    .array(
      z.object({
        nombre: z.string().trim().min(1),
        apellido: z.string().trim().optional(),
        telefono: z.string().trim().optional(),
        correo: z.string().trim().optional(),
      }),
    )
    .min(1)
    .max(2000),
})

router.post('/importar', async (req, res) => {
  const parsed = importarSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }

  let creados = 0
  let duplicados = 0
  let errores = 0

  for (const c of parsed.data.clientes) {
    const correo = c.correo ? c.correo.toLowerCase() : `importado-${randomUUID()}@sin-correo.local`
    // Contraseña aleatoria e individual por cliente: nunca se revela ni se
    // reutiliza, por lo que estas cuentas no pueden iniciar sesión en la práctica.
    const passwordHash = await hashPassword(randomBytes(32).toString('hex'))
    try {
      await prisma.usuario.create({
        data: {
          nombre: c.nombre,
          apellido: c.apellido || '',
          documentoIdentidad: `IMPORT-${randomUUID()}`,
          telefono: c.telefono || '',
          correo,
          passwordHash,
          estado: 'NUEVO',
        },
      })
      creados++
    } catch (err) {
      if (err.code === 'P2002') {
        duplicados++ // correo ya existente
      } else {
        errores++
        console.error('Import cliente:', err)
      }
    }
  }

  res.status(201).json({ creados, duplicados, errores, total: parsed.data.clientes.length })
})

// ── PATCH /pacientes/:id ─────────────────────────────────────────────────────
// Actualiza la gestión del cliente: edad (manual) y estado de tratamiento.
const patchSchema = z
  .object({
    edadManual: z.number().int().min(0).max(150).nullable().optional(),
    estadoTratamiento: z.enum(ESTADOS_TRATAMIENTO).optional(),
  })
  .refine((d) => d.edadManual !== undefined || d.estadoTratamiento !== undefined, {
    message: 'Nada que actualizar',
  })

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' })

  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }

  const actual = await prisma.usuario.findUnique({ where: { id } })
  if (!actual) return res.status(404).json({ error: 'Cliente no encontrado' })

  const data = {}
  if (parsed.data.edadManual !== undefined) data.edadManual = parsed.data.edadManual
  if (parsed.data.estadoTratamiento !== undefined) {
    data.estadoTratamiento = parsed.data.estadoTratamiento
    // Marca/limpia la fecha de finalización al pasar a/desde COMPLETADO.
    if (parsed.data.estadoTratamiento === 'COMPLETADO') {
      data.tratamientoFinalizadoEn = actual.tratamientoFinalizadoEn || new Date()
    } else {
      data.tratamientoFinalizadoEn = null
    }
  }

  const actualizado = await prisma.usuario.update({
    where: { id },
    data,
    select: {
      id: true,
      edadManual: true,
      estadoTratamiento: true,
      tratamientoFinalizadoEn: true,
    },
  })
  res.json({ ...actualizado, edad: actualizado.edadManual ?? null })
})

export default router

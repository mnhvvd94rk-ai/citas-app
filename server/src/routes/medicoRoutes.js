import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { slugify } from '../services/slug.js'

const router = Router()

// GET /medicos/mi-profesional — devuelve el profesional al que está vinculado el
// cliente autenticado (por su profesionalId). Cada cliente reserva SOLO con su
// profesional; nunca se expone ni se asume "el primero" de la tabla.
router.get('/mi-profesional', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const cliente = await prisma.usuario.findUnique({
    where: { id: req.user.id },
    select: { profesionalId: true },
  })
  if (!cliente?.profesionalId) {
    return res.status(404).json({
      error: 'Tu cuenta no está vinculada a ningún profesional.',
      code: 'SIN_PROFESIONAL',
    })
  }
  const medico = await prisma.medico.findUnique({
    where: { id: cliente.profesionalId },
    select: { id: true, nombre: true, especialidad: true, telefono: true, correo: true },
  })
  if (!medico) {
    return res.status(404).json({ error: 'Profesional no encontrado' })
  }
  res.json(medico)
})

// GET /medicos/slug/:slug  (público) — resuelve el enlace de registro
// (/reservar/:slug) al profesional correspondiente. Se usa para validar que el
// enlace existe y mostrar el nombre del profesional en el flujo de registro del
// cliente. No expone datos sensibles.
router.get('/slug/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase()
  const medico = await prisma.medico.findUnique({
    where: { slug },
    select: { id: true, nombre: true, especialidad: true, slug: true },
  })
  if (!medico) {
    return res.status(404).json({ error: 'Enlace de registro no encontrado', code: 'SLUG_INVALIDO' })
  }
  res.json(medico)
})

// PATCH /medicos/mi-slug  (profesional autenticado) — edita el slug una sola
// vez. Valida formato y unicidad; si ya se editó antes, se rechaza.
const slugSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
})

router.patch('/mi-slug', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const parsed = slugSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }

  // Normaliza para evitar guiones sobrantes o mayúsculas que el regex no filtra.
  const nuevoSlug = slugify(parsed.data.slug)
  if (!nuevoSlug) {
    return res.status(400).json({ error: 'El enlace no puede quedar vacío' })
  }

  const actual = await prisma.medico.findUnique({ where: { id: req.user.id } })
  if (!actual) return res.status(404).json({ error: 'Profesional no encontrado' })
  if (actual.slugEditado) {
    return res.status(409).json({
      error: 'Tu enlace ya se editó una vez y no puede volver a cambiarse.',
      code: 'SLUG_YA_EDITADO',
    })
  }

  // Si no cambia respecto al actual, no consume la edición: se responde ok.
  if (nuevoSlug === actual.slug) {
    return res.json({ id: actual.id, slug: actual.slug, slugEditado: actual.slugEditado })
  }

  const ocupado = await prisma.medico.findUnique({ where: { slug: nuevoSlug } })
  if (ocupado) {
    return res.status(409).json({ error: 'Ese enlace ya está en uso. Elige otro.', code: 'SLUG_OCUPADO' })
  }

  const actualizado = await prisma.medico.update({
    where: { id: actual.id },
    data: { slug: nuevoSlug, slugEditado: true },
    select: { id: true, slug: true, slugEditado: true },
  })
  res.json(actualizado)
})

export default router

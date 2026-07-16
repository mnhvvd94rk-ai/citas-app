import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { slugify } from '../services/slug.js'
import { tr } from '../i18n/messages.js'

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
      error: tr(req.lang, 'error.sinProfesional'),
      code: 'SIN_PROFESIONAL',
    })
  }
  const medico = await prisma.medico.findUnique({
    where: { id: cliente.profesionalId },
    select: {
      id: true, nombre: true, especialidad: true, telefono: true, correo: true,
      fotoPerfilUrl: true, direccion: true, bio: true,
    },
  })
  if (!medico) {
    return res.status(404).json({ error: tr(req.lang, 'error.profesionalNoEncontrado') })
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
    return res.status(404).json({ error: tr(req.lang, 'error.enlaceNoEncontrado'), code: 'SLUG_INVALIDO' })
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
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }

  // Normaliza para evitar guiones sobrantes o mayúsculas que el regex no filtra.
  const nuevoSlug = slugify(parsed.data.slug)
  if (!nuevoSlug) {
    return res.status(400).json({ error: tr(req.lang, 'error.enlaceVacio') })
  }

  const actual = await prisma.medico.findUnique({ where: { id: req.user.id } })
  if (!actual) return res.status(404).json({ error: tr(req.lang, 'error.profesionalNoEncontrado') })
  if (actual.slugEditado) {
    return res.status(409).json({
      error: tr(req.lang, 'error.slugYaEditado'),
      code: 'SLUG_YA_EDITADO',
    })
  }

  // Si no cambia respecto al actual, no consume la edición: se responde ok.
  if (nuevoSlug === actual.slug) {
    return res.json({ id: actual.id, slug: actual.slug, slugEditado: actual.slugEditado })
  }

  const ocupado = await prisma.medico.findUnique({ where: { slug: nuevoSlug } })
  if (ocupado) {
    return res.status(409).json({ error: tr(req.lang, 'error.slugOcupado'), code: 'SLUG_OCUPADO' })
  }

  const actualizado = await prisma.medico.update({
    where: { id: actual.id },
    data: { slug: nuevoSlug, slugEditado: true },
    select: { id: true, slug: true, slugEditado: true },
  })
  res.json(actualizado)
})

// PATCH /medicos/mi-foto  (profesional autenticado) — sube o quita su foto de
// perfil (opcional). La imagen llega como data URL (base64), igual que la foto de
// identidad del cliente. `fotoPerfilUrl: null` la elimina y vuelve al avatar genérico.
const fotoSchema = z.object({
  // Acepta data URL de imagen o null. Límite defensivo de tamaño (~3MB en base64).
  fotoPerfilUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Formato de imagen no válido')
    .max(4_000_000)
    .nullable(),
})

router.patch('/mi-foto', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const parsed = fotoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }
  const actualizado = await prisma.medico.update({
    where: { id: req.user.id },
    data: { fotoPerfilUrl: parsed.data.fotoPerfilUrl },
    select: { id: true, fotoPerfilUrl: true },
  })
  res.json(actualizado)
})

// PATCH /medicos/mi-perfil  (profesional autenticado) — edita datos de perfil que
// el cliente ve en su dashboard: teléfono, dirección/ubicación y ficha biográfica.
// Todos opcionales; solo se actualizan los campos presentes en el body. Cadena
// vacía → se guarda null (el profesional "borra" el dato).
const perfilSchema = z.object({
  telefono: z.string().trim().max(40).nullish(),
  direccion: z.string().trim().max(300).nullish(),
  bio: z.string().trim().max(1000).nullish(),
})

router.patch('/mi-perfil', requireAuth, requireRole('MEDICO'), async (req, res) => {
  const parsed = perfilSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }
  // Solo toca los campos enviados; '' se normaliza a null.
  const data = {}
  for (const campo of ['telefono', 'direccion', 'bio']) {
    if (parsed.data[campo] !== undefined) data[campo] = parsed.data[campo] || null
  }
  const actualizado = await prisma.medico.update({
    where: { id: req.user.id },
    data,
    select: { id: true, telefono: true, direccion: true, bio: true },
  })
  res.json(actualizado)
})

export default router

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
      fotoPerfilUrl: true, direccion: true, bio: true, esNegocioPro: true,
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
    select: { id: true, nombre: true, especialidad: true, slug: true, activo: true },
  })
  if (!medico) {
    return res.status(404).json({ error: tr(req.lang, 'error.enlaceNoEncontrado'), code: 'SLUG_INVALIDO' })
  }
  // Profesional deshabilitado: el enlace resuelve pero ya no está operativo. Se
  // responde con un mensaje claro (código propio) para que el frontend muestre
  // "este enlace ya no está activo" en vez de un error genérico o un 404.
  if (medico.activo === false) {
    return res.status(403).json({ error: tr(req.lang, 'error.enlaceInactivo'), code: 'PROFESIONAL_INACTIVO' })
  }
  const { activo, ...publico } = medico
  res.json(publico)
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

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPO — Empleados de una cuenta de negocio Pro. Todas estas rutas exigen que
// el profesional autenticado tenga esNegocioPro=true; una cuenta normal recibe
// 403 y nunca ve/gestiona empleados. Es la base del modo "equipo" del motor de
// citas (asignación automática y "repetir con X").
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica que el profesional autenticado sea una cuenta Pro. Responde 403 y
 * devuelve null si no lo es (o 404 si no existe). Si lo es, devuelve el medico.
 */
async function requireNegocioPro(req, res) {
  const medico = await prisma.medico.findUnique({
    where: { id: req.user.id },
    select: { id: true, esNegocioPro: true },
  })
  if (!medico) {
    res.status(404).json({ error: tr(req.lang, 'error.profesionalNoEncontrado') })
    return null
  }
  if (!medico.esNegocioPro) {
    res.status(403).json({ error: tr(req.lang, 'error.noEsNegocioPro'), code: 'NO_ES_NEGOCIO_PRO' })
    return null
  }
  return medico
}

const EMPLEADO_PUBLICO = { id: true, nombre: true, bio: true, fotoUrl: true, activo: true }

const crearEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  bio: z.string().trim().max(1000).nullish(),
  // Foto opcional como data URL (mismo criterio que la foto del profesional).
  fotoUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Formato de imagen no válido')
    .max(4_000_000)
    .nullish(),
})

const actualizarEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(1000).nullish(),
  fotoUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Formato de imagen no válido')
    .max(4_000_000)
    .nullish(),
  activo: z.boolean().optional(),
})

// GET /medicos/mis-empleados — lista los empleados del negocio (activos e
// inactivos; el panel muestra el estado). Solo cuentas Pro.
router.get('/mis-empleados', requireAuth, requireRole('MEDICO'), async (req, res) => {
  if (!(await requireNegocioPro(req, res))) return
  const empleados = await prisma.empleado.findMany({
    where: { medicoId: req.user.id },
    select: EMPLEADO_PUBLICO,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })
  res.json(empleados)
})

// POST /medicos/mis-empleados — alta de un empleado. Solo cuentas Pro.
router.post('/mis-empleados', requireAuth, requireRole('MEDICO'), async (req, res) => {
  if (!(await requireNegocioPro(req, res))) return
  const parsed = crearEmpleadoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }
  const empleado = await prisma.empleado.create({
    data: {
      medicoId: req.user.id,
      nombre: parsed.data.nombre,
      bio: parsed.data.bio || null,
      fotoUrl: parsed.data.fotoUrl || null,
    },
    select: EMPLEADO_PUBLICO,
  })
  res.status(201).json(empleado)
})

/** Carga un empleado y verifica que pertenezca al profesional autenticado. */
async function cargarEmpleadoPropio(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: tr(req.lang, 'error.idInvalido') })
    return null
  }
  const empleado = await prisma.empleado.findUnique({ where: { id } })
  if (!empleado) {
    res.status(404).json({ error: tr(req.lang, 'error.empleadoNoEncontrado') })
    return null
  }
  if (empleado.medicoId !== req.user.id) {
    res.status(403).json({ error: tr(req.lang, 'error.empleadoAjeno') })
    return null
  }
  return empleado
}

// PATCH /medicos/mis-empleados/:id — edita nombre/bio/foto o activa/desactiva.
router.patch('/mis-empleados/:id', requireAuth, requireRole('MEDICO'), async (req, res) => {
  if (!(await requireNegocioPro(req, res))) return
  const empleado = await cargarEmpleadoPropio(req, res)
  if (!empleado) return

  const parsed = actualizarEmpleadoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: tr(req.lang, 'error.datosInvalidos'),
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }
  const data = {}
  if (parsed.data.nombre !== undefined) data.nombre = parsed.data.nombre
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio || null
  if (parsed.data.fotoUrl !== undefined) data.fotoUrl = parsed.data.fotoUrl || null
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo

  const actualizado = await prisma.empleado.update({
    where: { id: empleado.id },
    data,
    select: EMPLEADO_PUBLICO,
  })
  res.json(actualizado)
})

// DELETE /medicos/mis-empleados/:id — "eliminar" es SOFT: marca activo=false para
// conservar el historial de citas/disponibilidad y no romper referencias. El
// empleado deja de aparecer en la disponibilidad combinada y en la asignación.
router.delete('/mis-empleados/:id', requireAuth, requireRole('MEDICO'), async (req, res) => {
  if (!(await requireNegocioPro(req, res))) return
  const empleado = await cargarEmpleadoPropio(req, res)
  if (!empleado) return
  await prisma.empleado.update({ where: { id: empleado.id }, data: { activo: false } })
  res.json({ ok: true, desactivado: empleado.id })
})

export default router

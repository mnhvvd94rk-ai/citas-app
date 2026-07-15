import { Router } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { signToken } from '../services/authService.js'
import {
  DEVICE_COOKIE,
  DEVICE_TTL_DIAS,
  generarTokenDispositivo,
  opcionesCookie,
} from '../services/deviceToken.js'

const router = Router()

function sinPassword(row) {
  if (!row) return row
  const { passwordHash, ...resto } = row
  return resto
}

// Cookie de dispositivo para el login semi-automático (solo si hay profesional).
async function emitirDispositivo(res, clienteId, profesionalId) {
  if (!profesionalId) return
  const { token, tokenHash } = generarTokenDispositivo()
  const expiraEn = new Date(Date.now() + DEVICE_TTL_DIAS * 24 * 60 * 60 * 1000)
  await prisma.dispositivoCliente.create({ data: { tokenHash, clienteId, profesionalId, expiraEn } })
  res.cookie(DEVICE_COOKIE, token, opcionesCookie())
}

// Todas las cuentas de cliente que pertenecen a la MISMA persona que la cuenta
// autenticada. El vínculo principal es EXPLÍCITO: la identidad raíz (id de la
// cuenta raíz) enlaza a todas sus cuentas por profesional (ver `identidadRaizId`).
// Se añade una compatibilidad por correo/teléfono para las cuentas antiguas que se
// crearon antes del vínculo explícito (multi-cuenta por mismo teléfono). El correo
// ahora es único POR profesional, así que un mismo correo real identifica de forma
// fiable a la misma persona en varios profesionales.
async function cuentasHermanas(userId) {
  const yo = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { id: true, correo: true, telefono: true, identidadRaizId: true },
  })
  if (!yo) return []
  const raiz = yo.identidadRaizId ?? yo.id
  return prisma.usuario.findMany({
    where: {
      cuentaActivada: true,
      OR: [
        { id: raiz }, // la cuenta raíz
        { identidadRaizId: raiz }, // cuentas vinculadas explícitamente a la raíz
        // Compatibilidad con cuentas antiguas (sin vínculo explícito):
        { correo: yo.correo },
        { telefono: yo.telefono },
      ],
    },
    select: { id: true, profesionalId: true, profesional: { select: { nombre: true, slug: true } } },
    orderBy: { id: 'asc' },
  })
}

// GET /clientes/mis-profesionales — lista de profesionales del cliente logueado.
router.get('/mis-profesionales', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const cuentas = await cuentasHermanas(req.user.id)
  res.json({
    profesionales: cuentas
      .filter((c) => c.profesionalId)
      .map((c) => ({
        clienteId: c.id,
        profesionalId: c.profesionalId,
        nombre: c.profesional?.nombre || '—',
        slug: c.profesional?.slug || null,
        actual: c.id === req.user.id,
      })),
  })
})

// POST /clientes/cambiar-profesional — cambia la sesión a otra cuenta del mismo
// identificador, sin pedir contraseña. Valida que la cuenta destino realmente
// pertenece al identificador ya autenticado (no se puede saltar a una ajena).
const cambiarSchema = z.object({ profesionalId: z.number().int() })
router.post('/cambiar-profesional', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const parsed = cambiarSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })

  const cuentas = await cuentasHermanas(req.user.id)
  const destino = cuentas.find((c) => c.profesionalId === parsed.data.profesionalId)
  if (!destino) {
    return res.status(404).json({ error: 'No tienes una cuenta con ese profesional.', code: 'CUENTA_NO_ENCONTRADA' })
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: destino.id } })
  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  await emitirDispositivo(res, usuario.id, usuario.profesionalId)
  res.json({ token, usuario: sinPassword(usuario) })
})

// POST /clientes/agregar-profesional — el cliente YA AUTENTICADO se conecta con un
// nuevo profesional a partir de su código/enlace (slug), sin volver a rellenar el
// formulario ni pedir contraseña. Crea una nueva cuenta bajo ese profesional
// copiando su identidad (nombre/apellido/teléfono y su correo REAL, que ahora es
// único por profesional) y la vincula EXPLÍCITAMENTE a su identidad raíz. Sin foto
// ni firma (opcionales). Si ya está conectado con ese profesional, no duplica nada.
const agregarSchema = z.object({ codigo: z.string().min(1) })
router.post('/agregar-profesional', requireAuth, requireRole('PACIENTE'), async (req, res) => {
  const parsed = agregarSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' })
  // El frontend ya normaliza el código/enlace al slug; aquí solo se afina.
  const slug = parsed.data.codigo.trim().toLowerCase()

  const profesional = await prisma.medico.findUnique({ where: { slug } })
  if (!profesional) {
    return res.status(404).json({
      error: 'No encontramos ningún profesional con ese código o enlace.',
      code: 'SLUG_INVALIDO',
    })
  }

  const yo = await prisma.usuario.findUnique({ where: { id: req.user.id } })
  if (!yo) return res.status(404).json({ error: 'Cuenta no encontrada' })

  // ¿Ya tiene una cuenta con ese profesional? (por identidad explícita o legacy)
  const cuentas = await cuentasHermanas(req.user.id)
  if (cuentas.some((c) => c.profesionalId === profesional.id)) {
    return res.json({ yaConectado: true, profesional: { id: profesional.id, nombre: profesional.nombre } })
  }

  // Identidad raíz a la que se vincula la nueva cuenta (la propia si es la raíz).
  const raiz = yo.identidadRaizId ?? yo.id
  try {
    const nuevo = await prisma.usuario.create({
      data: {
        nombre: yo.nombre,
        apellido: yo.apellido,
        // Documento marcador: no se re-pide al agregar (como en la importación).
        documentoIdentidad: `LINK-${randomUUID()}`,
        telefono: yo.telefono,
        correo: yo.correo, // correo REAL: único por profesional → recordatorios OK
        passwordHash: yo.passwordHash, // misma contraseña sirve para todas sus cuentas
        estado: 'NUEVO',
        cuentaActivada: true,
        profesionalId: profesional.id,
        idiomaPreferido: yo.idiomaPreferido,
        identidadRaizId: raiz, // vínculo explícito con su identidad
      },
    })
    return res.status(201).json({
      creado: true,
      clienteId: nuevo.id,
      profesional: { id: profesional.id, nombre: profesional.nombre },
    })
  } catch (err) {
    // Carrera: otra petición ya creó la cuenta (correo, profesional). No es error.
    if (err.code === 'P2002') {
      return res.json({ yaConectado: true, profesional: { id: profesional.id, nombre: profesional.nombre } })
    }
    console.error('[agregar-profesional]', err)
    return res.status(500).json({ error: 'No se pudo agregar el profesional. Inténtalo de nuevo.' })
  }
})

export default router

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../services/db.js'
import {
  hashPassword,
  verifyPassword,
  signToken,
  signActivationToken,
  verifyActivationToken,
} from '../services/authService.js'
import { enviarEmailActivacion } from '../services/emailService.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { generarSlugUnico } from '../services/slug.js'
import {
  DEVICE_COOKIE,
  DEVICE_TTL_DIAS,
  generarTokenDispositivo,
  hashToken,
  leerCookieDispositivo,
  opcionesCookie,
} from '../services/deviceToken.js'
import { esZonaHorariaValida } from '../services/timezone.js'

// Base del frontend para construir el enlace de activación.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://citas-app-client.vercel.app'

const router = Router()

// ── Esquemas de validación (zod) ────────────────────────────────────────────
const registroPacienteSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  documentoIdentidad: z.string().min(1),
  telefono: z.string().min(1),
  correo: z.string().email(),
  password: z.string().min(6),
  fotoIdentidadUrl: z.string().url().optional(),
  firmaUrl: z.string().url().optional(),
  // Enlace del profesional desde el que llega el cliente (/reservar/:slug).
  // Obligatorio: un cliente siempre queda vinculado a un profesional; no se
  // permiten registros "huérfanos" sin profesional asociado.
  slug: z.string().min(1),
  // Idioma preferido según el selector de la página al registrarse (no default fijo).
  idiomaPreferido: z.enum(['ES', 'EN', 'FR']).optional(),
})

const registroMedicoSchema = z.object({
  nombre: z.string().min(1),
  especialidad: z.string().min(1),
  telefono: z.string().min(1).optional(),
  correo: z.string().email(),
  password: z.string().min(6),
  costoCancelacion: z.number().min(0).optional(),
  diasAnticipacionRequierida: z.number().int().min(0).optional(),
  // Plan elegido en la pantalla inicial del registro (Básica/Pro). Fija
  // esNegocioPro EN EL MOMENTO de crear la cuenta; nunca se vuelve a preguntar.
  esNegocioPro: z.boolean().optional(),
  // Zona horaria IANA del negocio (para el cálculo correcto de recordatorios).
  // Opcional: si no se envía, se aplica el default del schema. Se valida que sea
  // una zona real para no guardar basura.
  zonaHoraria: z
    .string()
    .trim()
    .refine((tz) => esZonaHorariaValida(tz), { message: 'Zona horaria no válida' })
    .optional(),
})

const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
})

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Valida `body` contra `schema`; si falla, responde 400 y devuelve null. */
function parseOr400(schema, body, res) {
  const result = schema.safeParse(body)
  if (!result.success) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalles: result.error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message,
      })),
    })
    return null
  }
  return result.data
}

/** Quita passwordHash de un registro de Usuario/Medico. */
function sinPassword(row) {
  if (!row) return row
  const { passwordHash, ...rest } = row
  return rest
}

/** Crea un token de dispositivo para (cliente, profesional) y lo pone en cookie. */
async function emitirDispositivo(res, clienteId, profesionalId) {
  const { token, tokenHash } = generarTokenDispositivo()
  const expiraEn = new Date(Date.now() + DEVICE_TTL_DIAS * 24 * 60 * 60 * 1000)
  await prisma.dispositivoCliente.create({ data: { tokenHash, clienteId, profesionalId, expiraEn } })
  res.cookie(DEVICE_COOKIE, token, opcionesCookie())
}

/**
 * Valida la cookie de dispositivo contra el profesional del `slug`.
 * Devuelve el registro DispositivoCliente (con cliente) si es válido y vigente,
 * o null. No lanza.
 */
async function validarDispositivo(req, slug) {
  const token = leerCookieDispositivo(req)
  if (!token || !slug) return null
  const medico = await prisma.medico.findUnique({ where: { slug }, select: { id: true } })
  if (!medico) return null
  const disp = await prisma.dispositivoCliente.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { cliente: { select: { id: true, nombre: true, apellido: true, cuentaActivada: true } } },
  })
  if (!disp) return null
  if (disp.profesionalId !== medico.id) return null // token de otro profesional
  if (disp.expiraEn < new Date()) return null // caducado
  return disp
}

// ── Rutas ──────────────────────────────────────────────────────────────────
// POST /auth/registro-paciente
router.post('/registro-paciente', async (req, res) => {
  const data = parseOr400(registroPacienteSchema, req.body, res)
  if (!data) return

  // Resuelve el profesional a partir del slug del enlace. Si el slug no existe,
  // no se crea la cuenta: el cliente necesita el enlace válido de su profesional.
  const profesional = await prisma.medico.findUnique({ where: { slug: data.slug } })
  if (!profesional) {
    return res.status(404).json({
      error: 'El enlace de registro no es válido. Solicita a tu profesional su enlace de registro.',
      code: 'SLUG_INVALIDO',
    })
  }
  // Profesional deshabilitado: su enlace ya no acepta nuevos registros. Mensaje
  // claro (no un error genérico) para que el cliente pida el enlace correcto.
  if (profesional.activo === false) {
    return res.status(403).json({
      error: 'Este enlace ya no está activo. Contacta a tu profesional para obtener su enlace de registro actual.',
      code: 'PROFESIONAL_INACTIVO',
    })
  }

  // Detección temprana de colisiones para dar un mensaje claro (en vez del 409
  // genérico de Prisma). El correo y el documento son ÚNICOS a nivel global; el
  // teléfono NO: un mismo teléfono puede existir bajo varios profesionales (así
  // es como un cliente se registra con un segundo profesional: mismo teléfono,
  // correo distinto). Por eso el teléfono nunca bloquea el registro.
  const correo = data.correo.trim()

  // Cuenta pre-registrada (por el propio profesional, manual o CSV) que aún no se
  // ha activado: nace con cuentaActivada=false y sin contraseña. Si el cliente
  // intenta registrarse por el enlace de ESE MISMO profesional y sus datos
  // (correo o teléfono) coinciden con esa cuenta, NO es un duplicado: es una
  // cuenta incompleta que puede completar. En vez de bloquear, se le ofrece el
  // flujo de activación directa (confirmar teléfono + crear contraseña). El
  // filtro por profesionalId es clave: una coincidencia con OTRO profesional no
  // entra aquí (no se puede activar una cuenta ajena por el enlace equivocado).
  const pendientePropia = await prisma.usuario.findFirst({
    where: {
      profesionalId: profesional.id,
      cuentaActivada: false,
      OR: [{ correo }, { correo: correo.toLowerCase() }, { telefono: data.telefono }],
    },
    select: { id: true },
  })
  if (pendientePropia) {
    return res.status(409).json({
      code: 'ACTIVACION_DISPONIBLE',
      profesionalNombre: profesional.nombre,
      error: 'Ya tienes una cuenta con este profesional. Confirma tu teléfono para activarla.',
    })
  }

  const [porCorreo, porDocumento, porTelefono] = await Promise.all([
    prisma.usuario.findFirst({ where: { OR: [{ correo }, { correo: correo.toLowerCase() }] } }),
    prisma.usuario.findFirst({ where: { documentoIdentidad: data.documentoIdentidad } }),
    // ¿El teléfono ya pertenece a una cuenta con la que se puede iniciar sesión?
    prisma.usuario.findFirst({
      where: { telefono: data.telefono, cuentaActivada: true, passwordHash: { not: null } },
    }),
  ])

  if (porCorreo) {
    // El correo es único global: no se puede reutilizar para otro profesional. Si
    // además el teléfono coincide con una cuenta existente (o la propia cuenta del
    // correo está activada), el cliente puede iniciar sesión y usar el selector de
    // profesionales en vez de crear otra cuenta.
    const puedeIniciarSesion =
      Boolean(porTelefono) || Boolean(porCorreo.cuentaActivada && porCorreo.passwordHash)
    return res.status(409).json({
      code: 'CORREO_YA_REGISTRADO',
      puedeIniciarSesion,
      error:
        'Ya existe una cuenta con este correo. Si quieres registrarte con un profesional distinto, usa un correo diferente. Si tu número de teléfono coincide con una cuenta existente, inicia sesión con tus credenciales para ver el selector de profesionales.',
    })
  }

  if (porDocumento) {
    return res.status(409).json({
      code: 'DOCUMENTO_YA_REGISTRADO',
      error:
        'Ya existe una cuenta con este documento de identidad. Si ya tienes cuenta, inicia sesión con tus credenciales; si crees que es un error, contacta a tu profesional.',
    })
  }

  try {
    const passwordHash = await hashPassword(data.password)
    const usuario = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        documentoIdentidad: data.documentoIdentidad,
        telefono: data.telefono,
        correo: data.correo,
        passwordHash,
        fotoIdentidadUrl: data.fotoIdentidadUrl,
        firmaUrl: data.firmaUrl,
        estado: 'NUEVO',
        profesionalId: profesional.id,
        // Idioma: si el cliente lo eligió explícitamente, se respeta y se marca
        // como explícito; si no, HEREDA el idioma del profesional (no un 'ES'
        // fijo) y queda como no-explícito (corregible en lote por el profesional).
        idiomaPreferido: data.idiomaPreferido || profesional.idiomaPreferido || 'ES',
        idiomaPreferidoExplicito: Boolean(data.idiomaPreferido),
      },
    })
    const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
    // Token de dispositivo para el login semi-automático futuro en este navegador.
    await emitirDispositivo(res, usuario.id, profesional.id)
    res.status(201).json({ token, usuario: sinPassword(usuario) })
  } catch (err) {
    // Red de seguridad ante carreras (dos registros simultáneos con el mismo dato).
    if (err.code === 'P2002') {
      const campo = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '')
      if (campo.includes('correo')) {
        return res.status(409).json({
          code: 'CORREO_YA_REGISTRADO',
          error:
            'Ya existe una cuenta con este correo. Si quieres registrarte con un profesional distinto, usa un correo diferente. Si tu número de teléfono coincide con una cuenta existente, inicia sesión con tus credenciales para ver el selector de profesionales.',
        })
      }
      return res.status(409).json({ code: 'DOCUMENTO_YA_REGISTRADO', error: 'Correo o documento ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno al registrar paciente' })
  }
})

// POST /auth/registro-medico  (abierto en dev; se protegerá más adelante)
router.post('/registro-medico', async (req, res) => {
  const data = parseOr400(registroMedicoSchema, req.body, res)
  if (!data) return

  try {
    const passwordHash = await hashPassword(data.password)
    // Slug único para su enlace público de registro de clientes, derivado del
    // nombre (con sufijo -2, -3… si ya está ocupado).
    const slug = await generarSlugUnico(
      data.nombre,
      async (s) => (await prisma.medico.count({ where: { slug: s } })) > 0,
    )
    const medico = await prisma.medico.create({
      data: {
        nombre: data.nombre,
        especialidad: data.especialidad,
        telefono: data.telefono,
        correo: data.correo,
        passwordHash,
        slug,
        // Plan elegido al registrarse: Pro activa el modo negocio/equipo desde ya.
        // Si no viene, cae en el default del schema (false = Básica).
        ...(data.esNegocioPro !== undefined && { esNegocioPro: data.esNegocioPro }),
        ...(data.zonaHoraria && { zonaHoraria: data.zonaHoraria }),
        ...(data.costoCancelacion !== undefined && { costoCancelacion: data.costoCancelacion }),
        ...(data.diasAnticipacionRequierida !== undefined && {
          diasAnticipacionRequierida: data.diasAnticipacionRequierida,
        }),
      },
    })
    const token = signToken({ id: medico.id, tipo: 'MEDICO' })
    res.status(201).json({ token, medico: sinPassword(medico) })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Correo ya registrado' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno al registrar médico' })
  }
})

// POST /auth/login-paciente
router.post('/login-paciente', async (req, res) => {
  const data = parseOr400(loginSchema, req.body, res)
  if (!data) return

  // El correo ya no es único global (es único por profesional): puede haber varias
  // cuentas de la misma persona. findFirst basta para el login por correo directo.
  const usuario = await prisma.usuario.findFirst({ where: { correo: data.correo } })
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  // Cuenta importada aún sin activar: mensaje claro y código para el frontend.
  if (!usuario.cuentaActivada) {
    return res.status(403).json({
      error: 'Esta cuenta aún no está activada. Revisa tu correo o solicita activarla.',
      code: 'CUENTA_NO_ACTIVADA',
    })
  }
  if (!usuario.passwordHash || !(await verifyPassword(data.password, usuario.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  res.json({ token, usuario: sinPassword(usuario) })
})

// ── Login real de cliente EN EL CONTEXTO de su profesional (por slug) ─────────
// El identificador es email o teléfono; la cuenta se busca dentro del profesional
// del enlace (las cuentas son exclusivas por profesional). Emite JWT + cookie de
// dispositivo para el login semi-automático futuro.
const clienteLoginSchema = z.object({
  slug: z.string().min(1),
  identificador: z.string().min(1),
  password: z.string().min(1),
})

router.post('/cliente-login', async (req, res) => {
  const data = parseOr400(clienteLoginSchema, req.body, res)
  if (!data) return

  const medico = await prisma.medico.findUnique({ where: { slug: data.slug }, select: { id: true } })
  if (!medico) {
    return res.status(404).json({ error: 'El enlace no es válido.', code: 'SLUG_INVALIDO' })
  }

  const ident = data.identificador.trim()
  const usuario = await prisma.usuario.findFirst({
    where: {
      profesionalId: medico.id,
      OR: [{ correo: ident }, { correo: ident.toLowerCase() }, { telefono: ident }],
    },
  })
  if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' })
  if (!usuario.cuentaActivada) {
    return res.status(403).json({
      error: 'Esta cuenta aún no está activada. Revisa tu correo o solicita activarla.',
      code: 'CUENTA_NO_ACTIVADA',
    })
  }
  if (!usuario.passwordHash || !(await verifyPassword(data.password, usuario.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  await emitirDispositivo(res, usuario.id, medico.id)
  res.json({ token, usuario: sinPassword(usuario) })
})

// ── Login de cliente por credenciales SIN código/enlace ───────────────────────
// El cliente ya tiene email/teléfono + contraseña propios: puede entrar sin el
// enlace de su profesional. El correo es único global (0/1 coincidencia), pero el
// teléfono NO: un mismo teléfono puede existir bajo varios profesionales, así que
// si hay más de una cuenta válida se devuelve la lista para elegir (sin token).
const clienteLoginGlobalSchema = z.object({
  identificador: z.string().min(1),
  password: z.string().min(1),
})

// Enmascara el contacto para la pantalla de elección, sin revelar el dato entero:
// correo -> "pe•••@gmail.com"; si no hay correo, teléfono -> "•••789".
function pistaContacto(u) {
  if (u.correo) {
    const [nombre, dominio] = String(u.correo).split('@')
    const ini = nombre.length <= 2 ? nombre.slice(0, 1) : nombre.slice(0, 2)
    return `${ini}•••@${dominio || ''}`
  }
  if (u.telefono) return '•••' + String(u.telefono).slice(-3)
  return ''
}

// Emite sesión (JWT + cookie de dispositivo) para un cliente ya verificado.
async function emitirSesionCliente(res, u) {
  const token = signToken({ id: u.id, tipo: 'PACIENTE' })
  // Solo hay cookie de dispositivo si el cliente está vinculado a un profesional
  // (los registros legacy podrían no tenerlo; la sesión JWT funciona igual).
  if (u.profesionalId) await emitirDispositivo(res, u.id, u.profesionalId)
  res.json({ token, usuario: sinPassword(u) })
}

// POST /auth/cliente-login-global
router.post('/cliente-login-global', async (req, res) => {
  const data = parseOr400(clienteLoginGlobalSchema, req.body, res)
  if (!data) return
  const ident = data.identificador.trim()
  const candidatos = await prisma.usuario.findMany({
    where: { OR: [{ correo: ident }, { correo: ident.toLowerCase() }, { telefono: ident }] },
    include: { profesional: { select: { id: true, nombre: true } } },
  })
  // Solo cuentan las cuentas cuya contraseña coincide (no se filtra por existencia
  // de cuenta antes de validar la contraseña, para no permitir enumeración).
  const validos = []
  for (const u of candidatos) {
    if (u.passwordHash && (await verifyPassword(data.password, u.passwordHash))) validos.push(u)
  }
  if (validos.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' })
  const activos = validos.filter((u) => u.cuentaActivada)
  if (activos.length === 0) {
    return res.status(403).json({
      error: 'Esta cuenta aún no está activada. Revisa tu correo o solicita activarla.',
      code: 'CUENTA_NO_ACTIVADA',
    })
  }
  if (activos.length === 1) return emitirSesionCliente(res, activos[0])
  // Varias cuentas válidas (mismo teléfono en distintos profesionales): elegir.
  return res.json({
    multiple: true,
    opciones: activos.map((u) => ({
      id: u.id,
      profesionalNombre: u.profesional?.nombre || '—',
      pista: pistaContacto(u),
    })),
  })
})

// POST /auth/cliente-login-elegir — segundo paso de la desambiguación: el cliente
// eligió una cuenta concreta. Se re-verifica la contraseña por seguridad (la lista
// se devolvió sin sesión).
const clienteLoginElegirSchema = z.object({
  usuarioId: z.number().int(),
  identificador: z.string().min(1),
  password: z.string().min(1),
})
router.post('/cliente-login-elegir', async (req, res) => {
  const data = parseOr400(clienteLoginElegirSchema, req.body, res)
  if (!data) return
  const ident = data.identificador.trim()
  const u = await prisma.usuario.findUnique({ where: { id: data.usuarioId } })
  const coincide = u && (u.correo === ident || u.correo === ident.toLowerCase() || u.telefono === ident)
  if (!u || !coincide || !u.passwordHash || !(await verifyPassword(data.password, u.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  if (!u.cuentaActivada) {
    return res.status(403).json({
      error: 'Esta cuenta aún no está activada. Revisa tu correo o solicita activarla.',
      code: 'CUENTA_NO_ACTIVADA',
    })
  }
  return emitirSesionCliente(res, u)
})

// ── Token de dispositivo (login semi-automático) ──────────────────────────────
const dispositivoSlugSchema = z.object({ slug: z.string().min(1) })

// POST /auth/dispositivo/estado — ¿este navegador ya tiene sesión recordada con
// el profesional del slug? Devuelve el nombre del cliente para el saludo.
router.post('/dispositivo/estado', async (req, res) => {
  const data = parseOr400(dispositivoSlugSchema, req.body, res)
  if (!data) return
  const disp = await validarDispositivo(req, data.slug)
  if (!disp || !disp.cliente) return res.json({ ok: false })
  res.json({ ok: true, cliente: { id: disp.cliente.id, nombre: disp.cliente.nombre } })
})

// POST /auth/dispositivo/canjear — cambia el token de dispositivo por un JWT de
// sesión fresco (un clic, sin credenciales).
router.post('/dispositivo/canjear', async (req, res) => {
  const data = parseOr400(dispositivoSlugSchema, req.body, res)
  if (!data) return
  const disp = await validarDispositivo(req, data.slug)
  if (!disp) {
    return res.status(401).json({ error: 'Dispositivo no reconocido.', code: 'DISPOSITIVO_INVALIDO' })
  }
  await prisma.dispositivoCliente.update({ where: { id: disp.id }, data: { ultimoUsoEn: new Date() } })
  const usuario = await prisma.usuario.findUnique({ where: { id: disp.clienteId } })
  if (!usuario) return res.status(404).json({ error: 'Cuenta no encontrada.' })
  const token = signToken({ id: usuario.id, tipo: 'PACIENTE' })
  res.json({ token, usuario: sinPassword(usuario) })
})

// POST /auth/dispositivo/revocar — "No soy yo": elimina el token de dispositivo y
// borra la cookie. El logout normal NO llama a esto (mantiene el semi-login).
router.post('/dispositivo/revocar', async (req, res) => {
  const token = leerCookieDispositivo(req)
  if (token) {
    await prisma.dispositivoCliente.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  const prod = process.env.NODE_ENV === 'production'
  res.clearCookie(DEVICE_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'none' : 'lax',
  })
  res.json({ ok: true })
})

// POST /auth/activar-cuenta  — solicita el email con el enlace de activación.
// Respuesta genérica (no revela si el correo existe) salvo el caso de que la
// cuenta ya esté activada, donde conviene un mensaje útil.
const activarSchema = z.object({ correo: z.string().email() })

router.post('/activar-cuenta', async (req, res) => {
  const data = parseOr400(activarSchema, req.body, res)
  if (!data) return

  const correo = data.correo.toLowerCase()
  // El correo es único por profesional (ya no global): puede haber varias cuentas.
  // Para la activación interesa una que aún no esté activada.
  const usuario =
    (await prisma.usuario.findFirst({ where: { correo, cuentaActivada: false } })) ||
    (await prisma.usuario.findFirst({ where: { correo } }))

  // Solo enviamos si existe y aún no está activada. En cualquier otro caso
  // devolvemos el mismo 200 para no filtrar qué correos están registrados.
  if (usuario && !usuario.cuentaActivada) {
    const token = signActivationToken(usuario.id)
    const link = `${FRONTEND_URL}/activar-cuenta?token=${encodeURIComponent(token)}`
    const r = await enviarEmailActivacion({ correo: usuario.correo, nombre: usuario.nombre, link })
    if (!r.ok) {
      console.error('[activar-cuenta] No se pudo enviar el email:', r.error)
      return res.status(502).json({ error: 'No se pudo enviar el correo de activación. Inténtalo más tarde.' })
    }
  }

  res.json({ ok: true, mensaje: 'Si el correo corresponde a una cuenta pendiente, te hemos enviado un enlace de activación.' })
})

// POST /auth/completar-activacion  — el cliente define su contraseña.
const completarSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

router.post('/completar-activacion', async (req, res) => {
  const data = parseOr400(completarSchema, req.body, res)
  if (!data) return

  let payload
  try {
    payload = verifyActivationToken(data.token)
  } catch {
    return res.status(400).json({ error: 'El enlace de activación no es válido o ha caducado.' })
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } })
  if (!usuario) {
    return res.status(404).json({ error: 'Cuenta no encontrada.' })
  }
  if (usuario.cuentaActivada) {
    return res.status(409).json({ error: 'Esta cuenta ya está activada. Inicia sesión con tu contraseña.' })
  }

  const passwordHash = await hashPassword(data.password)
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash, cuentaActivada: true },
  })

  res.json({ ok: true, mensaje: 'Cuenta activada. Ya puedes iniciar sesión.' })
})

// ── Activación directa por el enlace del profesional ──────────────────────────
// Puerta ADICIONAL al correo de activación: cuando un cliente pre-registrado (sin
// contraseña) llega por /reservar/:slug de SU MISMO profesional, puede completar
// su cuenta confirmando el teléfono registrado (prueba de identidad) y creando su
// contraseña, sin esperar ningún correo. No reemplaza al enlace por email.

// Throttle server-side de la confirmación de teléfono: tras MAX fallos seguidos,
// el servidor BLOQUEA la cuenta durante VENTANA_MS (independiente del límite
// visual del frontend). El contador se persiste en Usuario y se reinicia al
// acertar o cuando la ventana ya expiró.
const MAX_INTENTOS_ACTIVACION = 5
const VENTANA_BLOQUEO_ACTIVACION_MS = 15 * 60 * 1000 // 15 minutos

function respuestaBloqueada(minutos) {
  return {
    fail: {
      status: 429,
      code: 'ACTIVACION_BLOQUEADA',
      error: `Demasiados intentos fallidos. Espera unos ${minutos} minutos e inténtalo de nuevo, o contacta a tu profesional para activar tu cuenta.`,
      reintentarEnMinutos: minutos,
    },
  }
}

/**
 * Localiza la cuenta PENDIENTE (cuentaActivada=false) bajo el profesional del
 * `slug` que corresponde al cliente, y confirma que el `telefono` dado coincide
 * EXACTAMENTE con el guardado. Prioriza el correo tecleado en el registro (así el
 * contador de intentos funciona aunque el teléfono sea incorrecto); si no hay
 * coincidencia por correo (p.ej. cuenta importada sin correo real), cae al
 * teléfono exacto. Aplica el throttle server-side: bloquea tras MAX fallos y
 * mutará el contador en cada intento (fallo suma, acierto reinicia). No revela si
 * la cuenta existe cuando no se puede localizar (mismo TELEFONO_NO_COINCIDE),
 * para no permitir enumeración. Devuelve { profesional, usuario } o
 * { fail: {status, code, error} }.
 */
async function resolverActivacionPendiente({ slug, correo, telefono }) {
  const profesional = await prisma.medico.findUnique({ where: { slug } })
  if (!profesional || profesional.activo === false) {
    return { fail: { status: 404, code: 'SLUG_INVALIDO', error: 'El enlace no es válido.' } }
  }

  const tel = String(telefono || '').trim()
  const mail = correo ? String(correo).trim() : ''
  let usuario = null
  if (mail) {
    usuario = await prisma.usuario.findFirst({
      where: {
        profesionalId: profesional.id,
        cuentaActivada: false,
        OR: [{ correo: mail }, { correo: mail.toLowerCase() }],
      },
    })
  }
  if (!usuario) {
    usuario = await prisma.usuario.findFirst({
      where: { profesionalId: profesional.id, cuentaActivada: false, telefono: tel },
    })
  }

  // Cuenta no localizable: respuesta genérica (anti-enumeración). Sin cuenta no
  // hay contador que tocar ni bloqueo posible por esta vía.
  if (!usuario) {
    return { fail: { status: 401, code: 'TELEFONO_NO_COINCIDE', error: 'El teléfono no coincide con la cuenta registrada.' } }
  }

  const ahora = new Date()
  const ultimo = usuario.ultimoIntentoActivacion ? new Date(usuario.ultimoIntentoActivacion) : null
  const enVentana = ultimo && ahora.getTime() - ultimo.getTime() < VENTANA_BLOQUEO_ACTIVACION_MS
  const fallosPrevios = usuario.intentosActivacionFallidos || 0

  // Ya bloqueada y todavía dentro de la ventana: rechaza sin ni siquiera comparar
  // el teléfono (protege aunque el frontend ignore el límite).
  if (fallosPrevios >= MAX_INTENTOS_ACTIVACION && enVentana) {
    const restanteMs = VENTANA_BLOQUEO_ACTIVACION_MS - (ahora.getTime() - ultimo.getTime())
    return respuestaBloqueada(Math.max(1, Math.ceil(restanteMs / 60000)))
  }

  // Base del contador: si la ventana ya expiró, el ciclo se reinicia (empieza de 0).
  const base = fallosPrevios >= MAX_INTENTOS_ACTIVACION && !enVentana ? 0 : fallosPrevios

  // El teléfono confirmado debe coincidir EXACTAMENTE con el registrado. Un
  // teléfono vacío guardado (importado sin teléfono) nunca coincide: esa cuenta
  // solo se puede activar por el enlace de correo.
  if (!tel || usuario.telefono !== tel) {
    const nuevos = base + 1
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosActivacionFallidos: nuevos, ultimoIntentoActivacion: ahora },
    })
    if (nuevos >= MAX_INTENTOS_ACTIVACION) {
      return respuestaBloqueada(Math.ceil(VENTANA_BLOQUEO_ACTIVACION_MS / 60000))
    }
    return { fail: { status: 401, code: 'TELEFONO_NO_COINCIDE', error: 'El teléfono no coincide con la cuenta registrada.' } }
  }

  // Acierto: reinicia el contador si venía acumulando.
  if (fallosPrevios !== 0 || usuario.ultimoIntentoActivacion) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosActivacionFallidos: 0, ultimoIntentoActivacion: null },
    })
    usuario.intentosActivacionFallidos = 0
    usuario.ultimoIntentoActivacion = null
  }
  return { profesional, usuario }
}

// POST /auth/activacion-directa/verificar — paso 1: confirma que el teléfono
// coincide, sin mutar nada. Permite separar el conteo de intentos (teléfono) del
// paso de crear la contraseña.
const activacionVerificarSchema = z.object({
  slug: z.string().min(1),
  correo: z.string().email().optional(),
  telefono: z.string().min(1),
})
router.post('/activacion-directa/verificar', async (req, res) => {
  const data = parseOr400(activacionVerificarSchema, req.body, res)
  if (!data) return
  const r = await resolverActivacionPendiente(data)
  if (r.fail) return res.status(r.fail.status).json({ error: r.fail.error, code: r.fail.code })
  res.json({ ok: true })
})

// POST /auth/activacion-directa — paso 2: teléfono correcto + contraseña nueva.
// Marca cuentaActivada=true, fija el idioma elegido como explícito y autentica
// al cliente (JWT + cookie de dispositivo), igual que un registro normal.
const activacionDirectaSchema = z.object({
  slug: z.string().min(1),
  correo: z.string().email().optional(),
  telefono: z.string().min(1),
  password: z.string().min(6),
  idiomaPreferido: z.enum(['ES', 'EN', 'FR']).optional(),
})
router.post('/activacion-directa', async (req, res) => {
  const data = parseOr400(activacionDirectaSchema, req.body, res)
  if (!data) return

  const r = await resolverActivacionPendiente(data)
  if (r.fail) return res.status(r.fail.status).json({ error: r.fail.error, code: r.fail.code })
  const { profesional, usuario } = r

  const passwordHash = await hashPassword(data.password)
  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      cuentaActivada: true,
      // Idioma elegido explícitamente en la pantalla trilingüe del flujo: se
      // respeta y se marca como explícito (la corrección en lote no lo pisa).
      idiomaPreferido: data.idiomaPreferido || usuario.idiomaPreferido || profesional.idiomaPreferido || 'ES',
      idiomaPreferidoExplicito: Boolean(data.idiomaPreferido) || usuario.idiomaPreferidoExplicito,
    },
  })

  const token = signToken({ id: actualizado.id, tipo: 'PACIENTE' })
  await emitirDispositivo(res, actualizado.id, profesional.id)
  res.json({ token, usuario: sinPassword(actualizado) })
})

// POST /auth/login-medico
router.post('/login-medico', async (req, res) => {
  const data = parseOr400(loginSchema, req.body, res)
  if (!data) return

  const medico = await prisma.medico.findUnique({ where: { correo: data.correo } })
  if (!medico || !(await verifyPassword(data.password, medico.passwordHash))) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  // Cuenta deshabilitada (p. ej. duplicada desactivada): credenciales correctas
  // pero no puede iniciar sesión. 403 (autorización de negocio, no cierra sesión).
  if (medico.activo === false) {
    return res.status(403).json({
      error: 'Esta cuenta ya no está activa. Si crees que es un error, contáctanos.',
      code: 'MEDICO_INACTIVO',
    })
  }
  const token = signToken({ id: medico.id, tipo: 'MEDICO' })
  res.json({ token, medico: sinPassword(medico) })
})

// GET /auth/me  (protegida — verifica el middleware)
router.get('/me', requireAuth, async (req, res) => {
  const { id, tipo } = req.user
  if (tipo === 'PACIENTE') {
    const usuario = await prisma.usuario.findUnique({ where: { id } })
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    return res.json({ tipo, usuario: sinPassword(usuario) })
  }
  if (tipo === 'MEDICO') {
    const medico = await prisma.medico.findUnique({ where: { id } })
    if (!medico) return res.status(404).json({ error: 'Médico no encontrado' })
    return res.json({ tipo, medico: sinPassword(medico) })
  }
  return res.status(400).json({ error: 'Tipo de usuario desconocido' })
})

// PATCH /auth/me — guarda el idioma preferido (para notificaciones). Lo usan
// tanto el cliente (Usuario) como el profesional (Medico).
const patchMeSchema = z.object({ idiomaPreferido: z.enum(['ES', 'EN', 'FR']) })

router.patch('/me', requireAuth, async (req, res) => {
  const { id, tipo } = req.user
  const data = parseOr400(patchMeSchema, req.body, res)
  if (!data) return

  if (tipo === 'MEDICO') {
    const medico = await prisma.medico.update({
      where: { id },
      data: { idiomaPreferido: data.idiomaPreferido },
    })
    return res.json({ tipo, medico: sinPassword(medico) })
  }

  // El cliente elige su idioma explícitamente: se marca como explícito para que
  // la corrección en lote del profesional ("aplicar mi idioma") no lo pise.
  const usuario = await prisma.usuario.update({
    where: { id },
    data: { idiomaPreferido: data.idiomaPreferido, idiomaPreferidoExplicito: true },
  })
  res.json({ tipo, usuario: sinPassword(usuario) })
})

export default router

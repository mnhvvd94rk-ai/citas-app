// Verificación del flujo de ACTIVACIÓN DIRECTA de una cuenta pre-registrada por el
// enlace del propio profesional. Monta el router real de auth contra un Prisma
// simulado (en memoria) y ejercita cada rama que pide la especificación:
//  - detección de cuenta pendiente del MISMO profesional → ACTIVACION_DISPONIBLE
//  - cliente completamente nuevo → registro normal sin cambios
//  - teléfono incorrecto → error sin bloquear; teléfono correcto → ok
//  - activación: crea contraseña, marca cuentaActivada + idioma explícito, autentica
//  - aislamiento: correo/teléfono que coincide con OTRO profesional NO se activa
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import express from 'express'
import http from 'node:http'

// Estado en memoria + Prisma simulado (hoisted para usarlo en los mocks y en los tests).
const h = vi.hoisted(() => {
  const store = { usuarios: [], medicos: [], nextId: 1000 }

  // Emula el `where` de Prisma para los campos que usan las rutas: igualdad simple,
  // OR (array de subcláusulas) y { not: X }.
  function matchWhere(row, where) {
    for (const [k, v] of Object.entries(where)) {
      if (k === 'OR') {
        if (!v.some((sub) => matchWhere(row, sub))) return false
      } else if (v && typeof v === 'object' && 'not' in v) {
        if (row[k] === v.not) return false
      } else if (row[k] !== v) {
        return false
      }
    }
    return true
  }

  const prisma = {
    medico: {
      findUnique: vi.fn(async ({ where }) =>
        store.medicos.find((m) => (where.slug ? m.slug === where.slug : m.correo === where.correo)) || null,
      ),
      create: vi.fn(async ({ data }) => ({ id: store.nextId++, ...data })),
    },
    usuario: {
      findFirst: vi.fn(async ({ where }) => store.usuarios.find((u) => matchWhere(u, where)) || null),
      findMany: vi.fn(async ({ where }) => store.usuarios.filter((u) => matchWhere(u, where))),
      create: vi.fn(async ({ data }) => {
        const row = { id: store.nextId++, ...data }
        store.usuarios.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = store.usuarios.find((u) => u.id === where.id)
        Object.assign(row, data)
        return row
      }),
    },
    dispositivoCliente: {
      create: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({})),
    },
  }
  return { store, prisma }
})

vi.mock('../services/db.js', () => ({ prisma: h.prisma }))
vi.mock('../services/authService.js', () => ({
  hashPassword: vi.fn(async (p) => 'hash:' + p),
  verifyPassword: vi.fn(async (p, hash) => hash === 'hash:' + p),
  signToken: vi.fn(() => 'jwt-token'),
  signActivationToken: vi.fn(() => 'act-token'),
  verifyActivationToken: vi.fn(() => ({ id: 1 })),
}))
vi.mock('../services/emailService.js', () => ({ enviarEmailActivacion: vi.fn(async () => ({ ok: true })) }))
vi.mock('../services/slug.js', () => ({ generarSlugUnico: vi.fn(async () => 'slug-generado') }))
vi.mock('../services/deviceToken.js', () => ({
  DEVICE_COOKIE: 'dev',
  DEVICE_TTL_DIAS: 30,
  generarTokenDispositivo: () => ({ token: 't', tokenHash: 'th' }),
  hashToken: (t) => 'h' + t,
  leerCookieDispositivo: () => null,
  opcionesCookie: () => ({}),
}))
vi.mock('../services/timezone.js', () => ({ esZonaHorariaValida: () => true }))
vi.mock('../middleware/authMiddleware.js', () => ({ requireAuth: (req, res, next) => next() }))

const { store } = h
let baseUrl
let server

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  return { status: res.status, data }
}

beforeAll(async () => {
  const { default: authRouter } = await import('./authRoutes.js')
  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

beforeEach(() => {
  store.nextId = 1000
  store.medicos = [
    { id: 100, slug: 'pro-test', nombre: 'Pro Test', activo: true, idiomaPreferido: 'ES' },
    { id: 200, slug: 'otro-pro', nombre: 'Otro Pro', activo: true, idiomaPreferido: 'EN' },
  ]
  store.usuarios = [
    // Pre-registrada por Pro Test (con correo real), sin activar.
    {
      id: 1, profesionalId: 100, cuentaActivada: false, passwordHash: null,
      nombre: 'Cli', apellido: '', documentoIdentidad: 'IMPORT-1',
      correo: 'cliente@test.com', telefono: '+5213311112222',
      idiomaPreferido: 'ES', idiomaPreferidoExplicito: false,
      intentosActivacionFallidos: 0, ultimoIntentoActivacion: null,
    },
    // Pre-registrada por Pro Test SIN correo real (importada), solo teléfono.
    {
      id: 2, profesionalId: 100, cuentaActivada: false, passwordHash: null,
      nombre: 'SinCorreo', apellido: '', documentoIdentidad: 'IMPORT-2',
      correo: 'importado-abc@sin-correo.local', telefono: '+5215556667777',
      idiomaPreferido: 'ES', idiomaPreferidoExplicito: false,
      intentosActivacionFallidos: 0, ultimoIntentoActivacion: null,
    },
  ]
})

const registroBase = {
  nombre: 'Cli', apellido: 'Ente', documentoIdentidad: 'DOC-9', password: 'secreta1',
}

describe('registro-paciente → detección de cuenta pendiente', () => {
  it('correo coincide con cuenta pendiente del MISMO profesional → ACTIVACION_DISPONIBLE', async () => {
    const { status, data } = await post('/auth/registro-paciente', {
      ...registroBase, slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5210000000000',
    })
    expect(status).toBe(409)
    expect(data.code).toBe('ACTIVACION_DISPONIBLE')
    expect(data.profesionalNombre).toBe('Pro Test')
  })

  it('solo el teléfono coincide (cuenta importada sin correo) → ACTIVACION_DISPONIBLE', async () => {
    const { status, data } = await post('/auth/registro-paciente', {
      ...registroBase, slug: 'pro-test', correo: 'nuevo-correo@test.com', telefono: '+5215556667777',
    })
    expect(status).toBe(409)
    expect(data.code).toBe('ACTIVACION_DISPONIBLE')
  })

  it('cliente completamente nuevo → registro normal (201), sin cambios', async () => {
    const { status, data } = await post('/auth/registro-paciente', {
      ...registroBase, slug: 'pro-test', correo: 'flamante@test.com', telefono: '+5218889990000',
    })
    expect(status).toBe(201)
    expect(data.token).toBe('jwt-token')
    expect(data.usuario.cuentaActivada === undefined || data.usuario.correo === 'flamante@test.com').toBe(true)
  })

  it('AISLAMIENTO: mismo correo pero por el enlace de OTRO profesional → NO activa, es duplicado', async () => {
    const { status, data } = await post('/auth/registro-paciente', {
      ...registroBase, slug: 'otro-pro', correo: 'cliente@test.com', telefono: '+5210000000000',
    })
    expect(status).toBe(409)
    expect(data.code).toBe('CORREO_YA_REGISTRADO') // no ACTIVACION_DISPONIBLE
  })
})

describe('activacion-directa/verificar → confirmación de teléfono', () => {
  it('teléfono incorrecto → 401 TELEFONO_NO_COINCIDE (no bloquea el reintento)', async () => {
    const { status, data } = await post('/auth/activacion-directa/verificar', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5219999999999',
    })
    expect(status).toBe(401)
    expect(data.code).toBe('TELEFONO_NO_COINCIDE')
  })

  it('teléfono correcto → { ok: true }', async () => {
    const { status, data } = await post('/auth/activacion-directa/verificar', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5213311112222',
    })
    expect(status).toBe(200)
    expect(data.ok).toBe(true)
  })

  it('AISLAMIENTO: teléfono correcto pero por el enlace de OTRO profesional → 401', async () => {
    const { status, data } = await post('/auth/activacion-directa/verificar', {
      slug: 'otro-pro', correo: 'cliente@test.com', telefono: '+5213311112222',
    })
    expect(status).toBe(401)
    expect(data.code).toBe('TELEFONO_NO_COINCIDE')
  })
})

describe('activacion-directa → crea contraseña, activa y autentica', () => {
  it('teléfono correcto + contraseña → 200, cuenta activada, idioma explícito, token', async () => {
    const { status, data } = await post('/auth/activacion-directa', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5213311112222',
      password: 'miNuevaPass', idiomaPreferido: 'FR',
    })
    expect(status).toBe(200)
    expect(data.token).toBe('jwt-token')
    const u = store.usuarios.find((x) => x.id === 1)
    expect(u.cuentaActivada).toBe(true)
    expect(u.passwordHash).toBe('hash:miNuevaPass')
    expect(u.idiomaPreferido).toBe('FR')
    expect(u.idiomaPreferidoExplicito).toBe(true)
    // No se filtra el hash en la respuesta.
    expect(data.usuario.passwordHash).toBeUndefined()
  })

  it('teléfono incorrecto → 401 y la cuenta NO se activa', async () => {
    const { status } = await post('/auth/activacion-directa', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5210000000000', password: 'otraPass',
    })
    expect(status).toBe(401)
    const u = store.usuarios.find((x) => x.id === 1)
    expect(u.cuentaActivada).toBe(false)
    expect(u.passwordHash).toBeNull()
  })

  it('activación por teléfono (cuenta importada sin correo real)', async () => {
    const { status } = await post('/auth/activacion-directa', {
      slug: 'pro-test', correo: 'cualquier@correo.com', telefono: '+5215556667777',
      password: 'passImportada', idiomaPreferido: 'ES',
    })
    expect(status).toBe(200)
    const u = store.usuarios.find((x) => x.id === 2)
    expect(u.cuentaActivada).toBe(true)
    expect(u.passwordHash).toBe('hash:passImportada')
  })
})

describe('throttle server-side (independiente del frontend)', () => {
  const WRONG = { slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5219999999999' }

  it('5 intentos fallidos seguidos en /verificar → el 5º bloquea (429) y el 6º sigue bloqueado', async () => {
    const codigos = []
    for (let i = 0; i < 6; i++) {
      const { status, data } = await post('/auth/activacion-directa/verificar', WRONG)
      codigos.push([status, data.code])
    }
    // Intentos 1-4: no coincide (401). Intento 5: bloqueada (429). Intento 6: sigue bloqueada.
    expect(codigos.slice(0, 4)).toEqual([
      [401, 'TELEFONO_NO_COINCIDE'], [401, 'TELEFONO_NO_COINCIDE'],
      [401, 'TELEFONO_NO_COINCIDE'], [401, 'TELEFONO_NO_COINCIDE'],
    ])
    expect(codigos[4]).toEqual([429, 'ACTIVACION_BLOQUEADA'])
    expect(codigos[5]).toEqual([429, 'ACTIVACION_BLOQUEADA'])
    const u = store.usuarios.find((x) => x.id === 1)
    expect(u.intentosActivacionFallidos).toBe(5)
  })

  it('el bloqueo también aplica al endpoint que muta /activacion-directa', async () => {
    let last
    for (let i = 0; i < 6; i++) {
      last = await post('/auth/activacion-directa', { ...WRONG, password: 'loQueSea' })
    }
    expect(last.status).toBe(429)
    expect(last.data.code).toBe('ACTIVACION_BLOQUEADA')
    const u = store.usuarios.find((x) => x.id === 1)
    // Nunca se activó pese a 6 intentos.
    expect(u.cuentaActivada).toBe(false)
    expect(u.passwordHash).toBeNull()
  })

  it('estando bloqueada, ni siquiera el teléfono CORRECTO pasa (dentro de la ventana)', async () => {
    for (let i = 0; i < 5; i++) await post('/auth/activacion-directa/verificar', WRONG)
    const { status, data } = await post('/auth/activacion-directa/verificar', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5213311112222', // correcto
    })
    expect(status).toBe(429)
    expect(data.code).toBe('ACTIVACION_BLOQUEADA')
  })

  it('tras expirar la ventana, el teléfono correcto vuelve a funcionar y reinicia el contador', async () => {
    for (let i = 0; i < 5; i++) await post('/auth/activacion-directa/verificar', WRONG)
    // Simula que el último intento fue hace 20 min (> ventana de 15 min).
    const u = store.usuarios.find((x) => x.id === 1)
    u.ultimoIntentoActivacion = new Date(Date.now() - 20 * 60 * 1000)
    const { status, data } = await post('/auth/activacion-directa/verificar', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5213311112222',
    })
    expect(status).toBe(200)
    expect(data.ok).toBe(true)
    expect(u.intentosActivacionFallidos).toBe(0)
    expect(u.ultimoIntentoActivacion).toBeNull()
  })

  it('un acierto antes del límite reinicia el contador de fallos', async () => {
    await post('/auth/activacion-directa/verificar', WRONG) // fallo 1
    await post('/auth/activacion-directa/verificar', WRONG) // fallo 2
    let u = store.usuarios.find((x) => x.id === 1)
    expect(u.intentosActivacionFallidos).toBe(2)
    const ok = await post('/auth/activacion-directa/verificar', {
      slug: 'pro-test', correo: 'cliente@test.com', telefono: '+5213311112222',
    })
    expect(ok.status).toBe(200)
    u = store.usuarios.find((x) => x.id === 1)
    expect(u.intentosActivacionFallidos).toBe(0)
  })
})

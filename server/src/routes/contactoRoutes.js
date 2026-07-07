import { Router } from 'express'
import { z } from 'zod'
import { enviarEmailContacto } from '../services/emailService.js'

const router = Router()

// ── Rate limiting básico en memoria: máx. 5 mensajes por IP por hora ─────────
const VENTANA_MS = 60 * 60 * 1000
const MAX_POR_VENTANA = 5
const registros = new Map() // ip -> [timestamps]

function limitado(ip) {
  const ahora = Date.now()
  const previos = (registros.get(ip) || []).filter((t) => ahora - t < VENTANA_MS)
  if (previos.length >= MAX_POR_VENTANA) {
    registros.set(ip, previos)
    return true
  }
  previos.push(ahora)
  registros.set(ip, previos)
  return false
}

const contactoSchema = z.object({
  nombre: z.string().min(1).max(120),
  email: z.string().email(),
  asunto: z.string().min(1).max(160),
  mensaje: z.string().min(1).max(5000),
})

// ── POST /contacto (público) ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'desconocida'
  if (limitado(ip)) {
    return res.status(429).json({ error: 'Demasiados mensajes. Inténtalo de nuevo más tarde.' })
  }

  const parsed = contactoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    })
  }

  const resultado = await enviarEmailContacto(parsed.data)
  if (!resultado.ok) {
    return res.status(502).json({ error: 'No se pudo enviar el mensaje. Inténtalo más tarde.' })
  }
  res.json({ ok: true })
})

export default router

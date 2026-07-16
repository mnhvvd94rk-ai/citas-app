import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import healthRouter from './routes/health.js'
import authRouter from './routes/authRoutes.js'
import disponibilidadRouter from './routes/disponibilidadRoutes.js'
import citaRouter from './routes/citaRoutes.js'
import pacienteRouter from './routes/pacienteRoutes.js'
import clienteRouter from './routes/clienteRoutes.js'
import notaRouter from './routes/notaRoutes.js'
import notaCitaRouter from './routes/notaCitaRoutes.js'
import medicoRouter from './routes/medicoRoutes.js'
import contactoRouter from './routes/contactoRoutes.js'
import pushRouter from './routes/pushRoutes.js'
import { runDailySummary } from './jobs/dailySummary.js'
import notificacionesJob from './jobs/notificacionesAutomaticas.js'
import { idiomaRequest } from './middleware/langMiddleware.js'

const app = express()
const PORT = process.env.PORT || 3001

// Orígenes permitidos: localhost (dev), el frontend en Vercel y el dominio propio.
const allowedOrigins = [
  "http://localhost:5173",
  "https://citas-app-client.vercel.app",
  "https://kohtun.com",
  "https://www.kohtun.com",
  // Dominio custom del backend (en verificación en Render). Se añade como origen
  // permitido por si alguna petición/redirección sale desde el propio api.kohtun.com.
  "https://api.kohtun.com"
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Límite amplio: el registro de paciente envía foto de identidad y firma como
// data URLs (base64) en el body.
app.use(express.json({ limit: '20mb' }))
// Resuelve el idioma del solicitante (req.lang) para traducir los mensajes de error.
app.use(idiomaRequest)

app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/disponibilidad', disponibilidadRouter)
app.use('/citas', citaRouter)
app.use('/pacientes', pacienteRouter)
app.use('/clientes', clienteRouter)
app.use('/notas', notaRouter)
app.use('/notas-por-cita', notaCitaRouter)
app.use('/medicos', medicoRouter)
app.use('/contacto', contactoRouter)
app.use('/push', pushRouter)

app.get('/', (req, res) => {
  res.json({ message: 'Citas App API — hola mundo' })
})

// Resumen diario al gestor: todos los días a las 06:00 (hora del servidor).
// Expresión cron "0 6 * * *" = minuto 0, hora 6, cualquier día/mes/día-semana.
cron.schedule('0 6 * * *', async () => {
  try {
    await runDailySummary()
  } catch (err) {
    // Un fallo del job nunca debe tumbar el servidor.
    console.error('[cron] runDailySummary falló:', err)
  }
})

// Recordatorios automáticos de cita (48h / 24h / 3h). Se auto-programa (cada hora).
notificacionesJob.iniciar()

// Escucha en 0.0.0.0 (todas las interfaces) — requerido por Railway.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server escuchando en http://localhost:${PORT}`)
})

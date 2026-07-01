import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import healthRouter from './routes/health.js'
import authRouter from './routes/authRoutes.js'
import disponibilidadRouter from './routes/disponibilidadRoutes.js'
import citaRouter from './routes/citaRoutes.js'
import { runDailySummary } from './jobs/dailySummary.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/disponibilidad', disponibilidadRouter)
app.use('/citas', citaRouter)

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

app.listen(PORT, () => {
  console.log(`Server escuchando en http://localhost:${PORT}`)
})

// Script de prueba manual: ejecuta el resumen diario una vez y termina.
// Uso: npm run summary:test
import 'dotenv/config'
import { runDailySummary } from './dailySummary.js'

runDailySummary()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[runDailySummaryNow] Error:', err)
    process.exit(1)
  })

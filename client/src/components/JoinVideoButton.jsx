import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'
import { minutosHastaCita } from '../lib/format.js'

// Botón "Unirse a la videollamada" para citas de videoconferencia.
// Solo se habilita cuando faltan ≤15 min para la cita; antes muestra un aviso
// atenuado. Se re-evalúa solo cada 30s para que aparezca sin recargar.
const VENTANA_MIN = 15

export default function JoinVideoButton({ cita, className = '', onDark = false }) {
  const { t } = useLanguage()
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [])

  if (cita?.tipoCita !== 'VIDEOCONFERENCIA' || !cita?.enlaceVideoconferencia) return null

  const minutos = minutosHastaCita(cita.fecha, cita.horaInicio)
  const disponible = minutos <= VENTANA_MIN

  if (!disponible) {
    return (
      <p className={`text-xs ${onDark ? 'text-white/70' : 'text-navy-400'} ${className}`}>
        {t('appt.availableFifteenMinBefore')}
      </p>
    )
  }

  return (
    <a
      href={cita.enlaceVideoconferencia}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 ${className}`}
    >
      🎥 {t('appt.joinVideoCall')}
    </a>
  )
}

import { useState } from 'react'
import { medicosApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { zonaHorariaDelNavegador } from './TimezoneSelect.jsx'

// Clave de descarte por par (detectada|guardada): si el profesional dice "mantener",
// no se le vuelve a preguntar por ESA misma combinación (evita molestar en cada
// carga). Vuelve a aparecer si cambia su dispositivo o su zona guardada.
const DISMISS_KEY = 'kohtun_tzbanner_dismiss'

// Banner NO intrusivo de zona horaria: al entrar al panel, si la zona real del
// dispositivo difiere de la guardada en la cuenta, ofrece actualizarla. Nunca la
// cambia solo: solo con clic en "Actualizar" (cambiarla en silencio podría
// desalinear citas ya agendadas). Pensado sobre todo para los profesionales
// existentes, que nunca pasaron por el registro donde se detecta la zona.
export default function TimezoneBanner() {
  const { user, tipo, refreshUser } = useAuth()
  const { t } = useLanguage()

  const detected = zonaHorariaDelNavegador()
  const stored = user?.zonaHoraria || null

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [descartado, setDescartado] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === `${detected}|${stored}` } catch { return false }
  })

  // Solo para profesionales, con zona guardada, cuando difiere de la del dispositivo.
  if (tipo !== 'MEDICO' || !stored || !detected || detected === stored || descartado) return null

  async function actualizar() {
    setError(null)
    setGuardando(true)
    try {
      await medicosApi.actualizarPerfil({ zonaHoraria: detected })
      await refreshUser() // stored pasa a == detected → el banner desaparece
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  function mantener() {
    try { localStorage.setItem(DISMISS_KEY, `${detected}|${stored}`) } catch { /* noop */ }
    setDescartado(true)
  }

  return (
    <div data-testid="tz-banner" className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-900">
          {t('tzBanner.text', { detected, current: stored })}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            data-testid="tz-update"
            onClick={actualizar}
            disabled={guardando}
            className="rounded-lg bg-navy-700 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
          >
            {guardando ? t('tzBanner.updating') : t('tzBanner.update', { detected })}
          </button>
          <button
            data-testid="tz-keep"
            onClick={mantener}
            disabled={guardando}
            className="rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            {t('tzBanner.keep')}
          </button>
        </div>
      </div>
      {error && <p className="mx-auto mt-2 max-w-6xl text-sm text-red-600">{error.message || t('common.genericError')}</p>}
    </div>
  )
}

import { useState } from 'react'
import { pacientesApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

const NOMBRE_IDIOMA = { ES: 'Español', EN: 'English', FR: 'Français' }

// Corrección masiva de idioma (BUG 2): aplica el idioma del profesional a todos
// sus clientes SIN idioma definido explícitamente. Flujo: clic → cuenta cuántos
// (dryRun) → confirma con el número claro → aplica. Lo usa el propio profesional
// (p. ej. Raquel para poner FR a sus clientes que quedaron en ES por defecto).
export default function AplicarIdiomaButton({ onApplied }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const idioma = user?.idiomaPreferido || 'ES'
  const idiomaNombre = NOMBRE_IDIOMA[idioma] || idioma

  const [estado, setEstado] = useState('idle') // idle | preguntando | aplicando
  const [candidatos, setCandidatos] = useState(0)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  async function abrir() {
    setError(null)
    setResultado(null)
    try {
      const r = await pacientesApi.aplicarMiIdioma(true) // dryRun: solo cuenta
      setCandidatos(r.candidatos)
      setEstado('preguntando')
    } catch (err) {
      setError(err)
    }
  }

  async function aplicar() {
    setEstado('aplicando')
    setError(null)
    try {
      const r = await pacientesApi.aplicarMiIdioma(false)
      setResultado(r)
      setEstado('idle')
      onApplied?.()
    } catch (err) {
      setError(err)
      setEstado('idle')
    }
  }

  return (
    <div>
      <button
        onClick={abrir}
        className="rounded-lg border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
      >
        {t('clients.applyLang.button', { lang: idiomaNombre })}
      </button>

      {error && <ErrorMessage error={error} className="mt-2" />}
      {resultado && (
        <p className="mt-2 text-sm font-medium text-emerald-600">
          {t('clients.applyLang.done', { count: resultado.actualizados, lang: idiomaNombre })}
        </p>
      )}

      {estado === 'preguntando' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy-800">{t('clients.applyLang.confirmTitle')}</h2>
            <p className="mt-2 text-sm text-navy-600">
              {t('clients.applyLang.confirmBody', { count: candidatos, lang: idiomaNombre })}
            </p>
            <p className="mt-2 text-xs text-navy-500">{t('clients.applyLang.confirmNote')}</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEstado('idle')}
                className="flex-1 rounded-xl bg-navy-50 py-3 font-semibold text-navy-700 transition hover:bg-navy-100"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={aplicar}
                disabled={candidatos === 0}
                className="flex-1 rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {t('clients.applyLang.confirmCta', { lang: idiomaNombre })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

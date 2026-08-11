import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { medicosApi } from '../../services/api.js'
import PlanCard from '../../components/PlanCard.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'

// Parte 3 — Pantalla "Actualizar a Pro". Solo tiene sentido para cuentas Básicas:
// si el profesional ya es Pro, se redirige a "Mi Equipo" (nunca debería llegar
// aquí, porque el enlace del menú solo aparece cuando esNegocioPro=false).
export default function ActualizarPro() {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  if (user?.esNegocioPro) return <Navigate to="/gestor/equipo" replace />

  async function confirmar() {
    setError(null)
    setEnviando(true)
    try {
      await medicosApi.actualizarPro()
      await refreshUser() // refresca esNegocioPro=true en el contexto
      navigate('/gestor/equipo', { replace: true })
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('plans.upgradeTitle')}</h1>
      <p className="mt-1 mb-7 text-sm text-navy-500">{t('plans.upgradeSubtitle')}</p>

      {error && <ErrorMessage error={error} className="mb-4" />}

      <div className="mt-2">
        <PlanCard plan="pro" selected note={t('plans.freeTrial')} />
      </div>

      <button
        type="button"
        onClick={confirmar}
        disabled={enviando}
        className="mt-7 w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
      >
        {enviando ? t('plans.upgrading') : t('plans.upgradeCta')}
      </button>
    </div>
  )
}

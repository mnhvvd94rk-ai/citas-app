import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'

// Landing minimalista y premium: fondo blanco limpio, tipografía moderna,
// acentos dorados sutiles.
export default function Landing() {
  const { isAuthenticated, tipo } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate(tipo === 'MEDICO' ? '/gestor/agenda' : '/paciente/citas', { replace: true })
    }
  }, [isAuthenticated, tipo, navigate])

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-white to-slate-50 text-slate-800">
      {/* Filo dorado sutil superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/70 to-transparent" />

      <header className="flex items-center justify-end px-6 py-5">
        <LanguageSelector />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-700 shadow-lg shadow-navy-900/20 ring-1 ring-gold-500/40">
            <span className="text-2xl font-bold tracking-tight text-gold-400">B</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{t('common.appName')}</h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">
            {t('common.tagline')}
          </p>

          <div className="mt-12 space-y-3">
            <button
              onClick={() => navigate('/login-paciente')}
              className="w-full rounded-xl bg-navy-700 py-4 text-base font-semibold text-white shadow-lg shadow-navy-900/15 transition hover:-translate-y-0.5 hover:bg-navy-800"
            >
              {t('landing.clientBtn')}
            </button>
            <button
              onClick={() => navigate('/login-medico')}
              className="w-full rounded-xl border-2 border-navy-700 bg-transparent py-4 text-base font-semibold text-navy-700 transition hover:-translate-y-0.5 hover:bg-navy-50"
            >
              {t('landing.proBtn')}
            </button>
          </div>

          <p className="mt-10 text-sm text-slate-500">
            {t('landing.firstTime')}{' '}
            <Link to="/registro-paciente" className="font-semibold text-navy-700 hover:text-gold-600">
              {t('landing.registerCta')}
            </Link>
          </p>
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-slate-400">{t('common.appName')}</footer>
    </div>
  )
}

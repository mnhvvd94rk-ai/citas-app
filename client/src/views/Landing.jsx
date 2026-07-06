import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'

// Landing minimalista y premium: marca, tagline y selección de rol.
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
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-navy-800 via-navy-800 to-navy-900 text-white">
      {/* Acento decorativo sutil */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />

      <header className="flex items-center justify-end px-6 py-5">
        <LanguageSelector variant="dark" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5">
            <span className="text-xl font-bold tracking-tight text-gold-400">B</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">{t('common.appName')}</h1>
          <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-gold-400/90">
            {t('common.tagline')}
          </p>

          <div className="mt-12 space-y-3">
            <button
              onClick={() => navigate('/login-paciente')}
              className="w-full rounded-xl bg-white py-4 text-base font-semibold text-navy-800 shadow-lg shadow-navy-900/40 transition hover:-translate-y-0.5 hover:bg-navy-50"
            >
              {t('landing.clientBtn')}
            </button>
            <button
              onClick={() => navigate('/login-medico')}
              className="w-full rounded-xl border border-white/25 bg-white/5 py-4 text-base font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-gold-500/60 hover:bg-white/10"
            >
              {t('landing.proBtn')}
            </button>
          </div>

          <p className="mt-10 text-sm text-white/60">
            {t('landing.firstTime')}{' '}
            <Link to="/registro-paciente" className="font-semibold text-gold-400 hover:text-gold-300">
              {t('landing.registerCta')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

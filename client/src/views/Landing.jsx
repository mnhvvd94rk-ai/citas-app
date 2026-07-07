import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import Logo from '../components/Logo.jsx'

// Landing pública de Meetun: hero premium + 3 beneficios.
export default function Landing() {
  const { isAuthenticated, tipo } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate(tipo === 'MEDICO' ? '/gestor/agenda' : '/paciente/citas', { replace: true })
    }
  }, [isAuthenticated, tipo, navigate])

  const beneficios = [
    { icon: '📅', title: t('landing.benefit1Title'), desc: t('landing.benefit1Desc') },
    { icon: '✨', title: t('landing.benefit2Title'), desc: t('landing.benefit2Desc') },
    { icon: '🔔', title: t('landing.benefit3Title'), desc: t('landing.benefit3Desc') },
  ]

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-white via-white to-coral-50/40 text-slate-800">
      {/* Filo coral superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy-700 via-coral-500 to-navy-700" />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <LanguageSelector />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center px-6">
        <section className="w-full max-w-2xl pt-10 pb-14 text-center sm:pt-16">
          <Logo variant="mark" className="mx-auto h-16 w-16" />
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-navy-800 sm:text-6xl">Meetun</h1>
          <p className="mt-4 text-xl font-semibold text-navy-600 sm:text-2xl">{t('common.tagline')}</p>
          <p className="mx-auto mt-3 max-w-md text-base text-slate-500">{t('landing.heroSubtitle')}</p>

          <div className="mt-9 flex flex-col items-center gap-3">
            <button
              onClick={() => navigate('/login-paciente')}
              className="w-full max-w-xs rounded-xl bg-navy-700 py-4 text-lg font-semibold text-white shadow-lg shadow-navy-900/15 transition hover:-translate-y-0.5 hover:bg-navy-800"
            >
              {t('landing.bookAppt')}
            </button>
            <p className="text-sm text-slate-500">
              {t('landing.firstTime')}{' '}
              <Link to="/registro-paciente" className="font-semibold text-coral-600 hover:text-coral-500">
                {t('landing.registerCta')}
              </Link>
            </p>
          </div>
        </section>

        {/* 3 beneficios */}
        <section className="grid w-full max-w-4xl grid-cols-1 gap-4 pb-14 sm:grid-cols-3">
          {beneficios.map((b) => (
            <div key={b.title} className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-coral-50 text-2xl">{b.icon}</div>
              <h3 className="mt-4 font-bold text-navy-800">{b.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{b.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center">
        <Link to="/login-medico" className="text-sm font-medium text-slate-400 transition hover:text-navy-700">
          {t('landing.proAccess')} →
        </Link>
        <p className="mt-2 text-xs text-slate-300">Meetun · {t('common.tagline')}</p>
      </footer>
    </div>
  )
}

import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'
import LanguageSelector from '../../components/LanguageSelector.jsx'
import Logo from '../../components/Logo.jsx'

// Documento legal genérico (Términos / Privacidad). Recibe título + secciones
// [{ title, body: [párrafos] }].
export default function LegalDoc({ title, sections }) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <button onClick={() => navigate('/landing')} aria-label="Ikatun"><Logo /></button>
          <LanguageSelector />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{t('legal.updated')}</p>

        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold text-navy-800">{s.title}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-600">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-200 pt-6">
          <Link to="/landing" className="text-sm font-semibold text-green-600 hover:text-green-500">
            {t('legal.backHome')}
          </Link>
        </div>
      </main>
    </div>
  )
}

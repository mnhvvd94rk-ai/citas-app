import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import Logo from '../components/Logo.jsx'
import Footer from '../components/Footer.jsx'

// Acordeón de una pregunta (mismo estilo que el FAQ de la landing).
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-semibold text-navy-800">{q}</span>
        <span className="text-brand-500">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="px-5 pb-4 text-sm leading-relaxed text-slate-500">{a}</p>}
    </div>
  )
}

export default function FAQPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const items = t('faqPage.items')

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <button onClick={() => navigate('/landing')} aria-label="Kohtun"><Logo /></button>
          <LanguageSelector />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">{t('faqPage.title')}</h1>

        <div className="mt-8 space-y-3">
          {items.map((it) => (
            <FaqItem key={it.q} q={it.q} a={it.a} />
          ))}
        </div>

        <div className="mt-12 border-t border-slate-200 pt-6">
          <Link to="/landing" className="text-sm font-semibold text-brand-600 hover:text-brand-500">
            {t('legal.backHome')}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

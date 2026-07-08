import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { Zap, Bell, CalendarCheck } from 'lucide-react'
import LanguageSelector from '../components/LanguageSelector.jsx'
import Logo from '../components/Logo.jsx'

// Fade-in al entrar en viewport.
function Reveal({ children, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
    >
      {children}
    </div>
  )
}

function Feature({ icon, title, desc }) {
  return (
    <div className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl transition group-hover:bg-green-100">{icon}</div>
      <h3 className="mt-4 font-bold text-navy-800 transition group-hover:text-green-600">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500">{desc}</p>
    </div>
  )
}

function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-semibold text-navy-800">{q}</span>
        <span className="text-green-500">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="px-5 pb-4 text-sm text-slate-500">{a}</p>}
    </div>
  )
}

export default function LandingPage() {
  const { isAuthenticated, tipo } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate(tipo === 'MEDICO' ? '/gestor/agenda' : '/paciente/citas', { replace: true })
    }
  }, [isAuthenticated, tipo, navigate])

  const iconCls = 'h-7 w-7 text-green-600'
  const clientes = [
    { icon: <Zap className={iconCls} strokeWidth={2} />, title: t('landingPublic.c1Title'), desc: t('landingPublic.c1Desc') },
    { icon: <Bell className={iconCls} strokeWidth={2} />, title: t('landingPublic.c2Title'), desc: t('landingPublic.c2Desc') },
    { icon: <CalendarCheck className={iconCls} strokeWidth={2} />, title: t('landingPublic.c3Title'), desc: t('landingPublic.c3Desc') },
  ]
  const pros = [
    { icon: '📅', title: t('landingPublic.p1Title'), desc: t('landingPublic.p1Desc') },
    { icon: '👥', title: t('landingPublic.p2Title'), desc: t('landingPublic.p2Desc') },
    { icon: '🔔', title: t('landingPublic.p3Title'), desc: t('landingPublic.p3Desc') },
  ]
  const pasos = [
    { n: 1, title: t('landingPublic.s1Title'), desc: t('landingPublic.s1Desc') },
    { n: 2, title: t('landingPublic.s2Title'), desc: t('landingPublic.s2Desc') },
    { n: 3, title: t('landingPublic.s3Title'), desc: t('landingPublic.s3Desc') },
    { n: 4, title: t('landingPublic.s4Title'), desc: t('landingPublic.s4Desc') },
  ]
  const testimonios = [
    { text: t('landingPublic.t1'), author: t('landingPublic.t1Author') },
    { text: t('landingPublic.t2'), author: t('landingPublic.t2Author') },
    { text: t('landingPublic.t3'), author: t('landingPublic.t3Author') },
  ]

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <button onClick={() => navigate('/landing')} aria-label="Ikatun"><Logo /></button>
          <div className="hidden items-center gap-6 text-sm font-medium text-navy-600 md:flex">
            <a href="#clientes" className="hover:text-green-600">{t('landingPublic.navClients')}</a>
            <a href="#profesionales" className="hover:text-green-600">{t('landingPublic.navPros')}</a>
            <a href="#como-funciona" className="hover:text-green-600">{t('landingPublic.navHow')}</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector />
            <button onClick={() => navigate('/login-paciente')} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-navy-700 hover:text-green-600 sm:block">
              {t('landingPublic.login')}
            </button>
            <button onClick={() => navigate('/registro-paciente')} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600">
              {t('landingPublic.startFree')}
            </button>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-800 via-navy-800 to-navy-900 text-white">
        {/* Glows esmeralda en las esquinas (dan profundidad al navy plano) */}
        <div className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-green-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-green-400/10 blur-3xl" />
        {/* Vignette radial esmeralda muy sutil */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.10), transparent 70%)' }}
        />
        {/* Patrón de puntos tenue para que el fondo no se vea plano */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-28">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{t('landingPublic.heroHeadline')}</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">{t('landingPublic.heroSub')}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/registro-paciente')} className="w-full max-w-xs rounded-xl bg-green-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-green-500/25 transition hover:-translate-y-0.5 hover:bg-green-600 sm:w-auto">
              {t('landingPublic.startFree')}
            </button>
            <button onClick={() => navigate('/login-medico')} className="w-full max-w-xs rounded-xl bg-white/95 px-8 py-4 text-lg font-bold text-navy-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-white sm:w-auto">
              {t('landing.proAccess')}
            </button>
          </div>
        </div>
      </section>

      {/* PARA CLIENTES */}
      <section id="clientes" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-navy-800">{t('landingPublic.forClientsTitle')}</h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {clientes.map((c) => <Feature key={c.title} {...c} />)}
          </div>
        </Reveal>
      </section>

      {/* PARA PROFESIONALES */}
      <section id="profesionales" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-bold text-navy-800">{t('landingPublic.forProsTitle')}</h2>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {pros.map((p) => <Feature key={p.title} {...p} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-navy-800">{t('landingPublic.howTitle')}</h2>
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pasos.map((s, i) => (
              <li key={s.n} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-700 font-bold text-green-300">{s.n}</div>
                <h3 className="mt-3 font-bold text-navy-800">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
                {i < pasos.length - 1 && <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-2xl text-green-400 lg:block">→</span>}
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* PRECIOS */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-bold text-navy-800">{t('landingPublic.pricingTitle')}</h2>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold text-navy-800">{t('landingPublic.priceClientTitle')}</h3>
                <p className="mt-2 text-slate-500">{t('landingPublic.priceClientDesc')}</p>
                <button onClick={() => navigate('/registro-paciente')} className="mt-5 w-full rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800">
                  {t('landingPublic.startFree')}
                </button>
              </div>
              <div className="rounded-2xl bg-navy-800 p-8 text-center text-white shadow-lg ring-1 ring-navy-900">
                <h3 className="text-xl font-bold">{t('landingPublic.priceProTitle')}</h3>
                <p className="mt-2 text-white/80">{t('landingPublic.priceProDesc')}</p>
                <button onClick={() => navigate('/login-medico')} className="mt-5 w-full rounded-xl bg-green-500 py-3 font-semibold text-white transition hover:bg-green-600">
                  {t('landing.proAccess')}
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIOS + FAQ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-navy-800">{t('landingPublic.testimonialsTitle')}</h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {testimonios.map((tm) => (
              <figure key={tm.author} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-green-400">★★★★★</div>
                <blockquote className="mt-3 text-navy-700">“{tm.text}”</blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-slate-500">{tm.author}</figcaption>
              </figure>
            ))}
          </div>

          <h3 className="mt-16 text-center text-2xl font-bold text-navy-800">{t('landingPublic.faqTitle')}</h3>
          <div className="mx-auto mt-6 max-w-2xl space-y-3">
            <Faq q={t('landingPublic.faq1Q')} a={t('landingPublic.faq1A')} />
            <Faq q={t('landingPublic.faq2Q')} a={t('landingPublic.faq2A')} />
            <Faq q={t('landingPublic.faq3Q')} a={t('landingPublic.faq3A')} />
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo onDark />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
            <Link to="/terminos" className="hover:text-green-300">{t('landingPublic.footerTerms')}</Link>
            <Link to="/privacidad" className="hover:text-green-300">{t('landingPublic.footerPrivacy')}</Link>
            <Link to="/contacto" className="hover:text-green-300">{t('landingPublic.footerContact')}</Link>
            <Link to="/faq" className="hover:text-green-300">{t('landingPublic.footerFaq')}</Link>
            <a href="#" className="hover:text-green-300">{t('landingPublic.footerBlog')}</a>
          </div>
          <div className="flex items-center gap-3 text-white/60">
            <a href="#" aria-label="X" className="hover:text-white">𝕏</a>
            <a href="#" aria-label="Instagram" className="hover:text-white">◎</a>
            <a href="#" aria-label="LinkedIn" className="hover:text-white">in</a>
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-white/40">{t('landingPublic.copyright')}</p>
      </footer>
    </div>
  )
}

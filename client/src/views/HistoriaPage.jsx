import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import Logo from '../components/Logo.jsx'
import Footer from '../components/Footer.jsx'

const serif = { fontFamily: 'Georgia, "Times New Roman", "Playfair Display", serif' }

// ── Emblema KOHT (fuego · lugar) ─────────────────────────────────────────────
// Círculo con glow radial de fuego, anillo con degradado fuego, eje vertical
// central y dos puntos (superior/inferior): orientación y permanencia.
function EmblemaKoht() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
      <defs>
        <radialGradient id="koht-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8823A" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#E8823A" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#E8823A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="koht-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8823A" />
          <stop offset="50%" stopColor="#B5451F" />
          <stop offset="100%" stopColor="#5a230e" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#koht-glow)" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="url(#koht-ring)" strokeWidth="2.5" />
      <line x1="60" y1="24" x2="60" y2="96" stroke="url(#koht-ring)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="24" r="4.5" fill="#E8823A" />
      <circle cx="60" cy="96" r="4.5" fill="#B5451F" />
    </svg>
  )
}

// ── Emblema TUN (teal · tiempo) ──────────────────────────────────────────────
// Círculo con glow radial teal, anillo y dos líneas que forman un ángulo desde
// el centro con puntos en los extremos: un ciclo, una medida del tiempo.
function EmblemaTun() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
      <defs>
        <radialGradient id="tun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5dcaa5" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#2C7C79" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#2C7C79" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tun-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5dcaa5" />
          <stop offset="50%" stopColor="#2C7C79" />
          <stop offset="100%" stopColor="#0f3d3a" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#tun-glow)" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="url(#tun-ring)" strokeWidth="2.5" />
      {/* ángulo desde el centro */}
      <line x1="60" y1="64" x2="36" y2="34" stroke="url(#tun-ring)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="60" y1="64" x2="84" y2="34" stroke="url(#tun-ring)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="36" cy="34" r="4.5" fill="#5dcaa5" />
      <circle cx="84" cy="34" r="4.5" fill="#2C7C79" />
      <circle cx="60" cy="64" r="3.5" fill="#5dcaa5" />
    </svg>
  )
}

// ── Tarjeta de origen ────────────────────────────────────────────────────────
function Carta({ emblema, label, subtitle, desc, accent, gradient }) {
  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-2xl px-8 py-10 text-center"
      style={{
        background: gradient,
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="mb-5">{emblema}</div>
      <h3 className="text-2xl font-semibold tracking-[0.3em]" style={{ ...serif, color: '#f4ece4' }}>
        {label}
      </h3>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
        {subtitle}
      </p>
      <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70" style={serif}>
        {desc}
      </p>
    </div>
  )
}

export default function HistoriaPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: '#0f1f33' }}>
      {/* Glows radiales de fondo (profundidad) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(50% 40% at 50% 0%, rgba(232,130,58,0.14), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(45% 45% at 85% 80%, rgba(44,124,121,0.12), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <button onClick={() => navigate('/landing')} aria-label="Kohtun"><Logo onDark /></button>
        <LanguageSelector />
      </header>

      {/* Contenido */}
      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-10 sm:pt-16">
        {/* Kicker + título */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em]" style={{ color: '#e8a978' }}>
            {t('historia.historiaKicker')}
          </p>
          <h1 className="mt-5 text-4xl leading-tight sm:text-5xl" style={{ ...serif, fontWeight: 400, color: '#f4ece4' }}>
            {t('historia.historiaTitle')}{' '}
            <em
              style={{
                fontStyle: 'italic',
                backgroundImage: 'linear-gradient(90deg, #E8823A, #e8a978)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Kohtun
            </em>
          </h1>
        </div>

        {/* Divisoria con glow */}
        <div className="mx-auto my-12 h-px w-40" style={{ background: 'linear-gradient(90deg, transparent, #e8a978, transparent)', boxShadow: '0 0 14px 1px rgba(232,169,120,0.5)' }} />

        {/* Dos tarjetas */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Carta
            emblema={<EmblemaKoht />}
            label={t('historia.kohtLabel')}
            subtitle={t('historia.kohtSubtitle')}
            desc={t('historia.kohtDesc')}
            accent="#e8a978"
            gradient="linear-gradient(160deg, #152a45, #0f1f33)"
          />
          <Carta
            emblema={<EmblemaTun />}
            label={t('historia.tunLabel')}
            subtitle={t('historia.tunSubtitle')}
            desc={t('historia.tunDesc')}
            accent="#5dcaa5"
            gradient="linear-gradient(160deg, #133433, #0f1f33)"
          />
        </div>

        {/* Narrativa completa */}
        <p className="mx-auto mt-14 max-w-2xl text-center text-lg leading-loose text-white/75" style={serif}>
          {t('historia.historiaBody')}
        </p>

        {/* Cita destacada */}
        <div className="mx-auto mt-16 h-px w-24" style={{ background: 'linear-gradient(90deg, transparent, rgba(244,236,228,0.5), transparent)' }} />
        <blockquote className="mx-auto mt-10 max-w-2xl text-center text-2xl italic leading-relaxed" style={{ ...serif, color: '#f4ece4' }}>
          {t('historia.historiaCita')}
        </blockquote>

        {/* ¿Por qué existe Kohtun? */}
        <section className="mt-24">
          <div
            className="mx-auto mb-12 h-px w-40"
            style={{ background: 'linear-gradient(90deg, transparent, #e8a978, transparent)', boxShadow: '0 0 14px 1px rgba(232,169,120,0.5)' }}
          />
          <h2 className="text-center text-3xl leading-tight sm:text-4xl" style={{ ...serif, fontWeight: 400, color: '#f4ece4' }}>
            {t('historia.whyKohtunTitle')}
          </h2>

          <div className="mx-auto mt-8 max-w-2xl space-y-5 text-lg leading-loose text-white/75" style={serif}>
            <p>{t('historia.whyKohtunP1')}</p>
            <p>{t('historia.whyKohtunP2')}</p>
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: '#e8a978' }}>
              {t('historia.whyKohtunListTitle')}
            </p>
            <ul className="mt-5 space-y-3.5">
              {t('historia.whyKohtunList').map((item, i) => (
                <li key={i} className="flex gap-3 text-white/80" style={serif}>
                  <span aria-hidden="true" className="shrink-0 font-semibold" style={{ color: '#e8a978' }}>—</span>
                  <span className="text-[15px] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/registro-cliente')}
              className="rounded-xl bg-brand-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-brand-600"
            >
              {t('historia.startFreeButton')}
            </button>
          </div>
        </section>

        {/* Volver */}
        <div className="mt-16 text-center">
          <Link to="/landing" className="text-sm font-medium tracking-wide text-white/50 transition hover:text-white/90">
            ← {t('historia.back')}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

import { useLanguage } from '../context/LanguageContext.jsx'

// Selector de idioma segmentado (ES / EN / FR). `variant` ajusta el color
// para fondo claro ('light') u oscuro ('dark').
export default function LanguageSelector({ variant = 'light' }) {
  const { lang, setLang, langs } = useLanguage()
  const dark = variant === 'dark'

  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border text-xs font-semibold ${
        dark ? 'border-white/25 bg-white/10' : 'border-slate-200 bg-white'
      }`}
    >
      {langs.map((l) => {
        const active = l.code === lang
        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            className={`px-3 py-1.5 transition-colors ${
              active
                ? 'bg-gold-500 text-navy-900'
                : dark
                  ? 'text-white/80 hover:text-white'
                  : 'text-slate-500 hover:text-navy-700'
            }`}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

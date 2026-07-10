import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import Logo from './Logo.jsx'

// Footer compartido por todas las páginas públicas: navegación consistente.
const LINKS = [
  { to: '/historia', key: 'footerStory' },
  { to: '/faq', key: 'footerFaq' },
  { to: '/contacto', key: 'footerContact' },
  { to: '/terminos', key: 'footerTerms' },
  { to: '/privacidad', key: 'footerPrivacy' },
]

export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="border-t border-white/10 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between">
        <Link to="/landing" aria-label="Kohtun">
          <Logo onDark />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-medium text-white/85">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition hover:text-brand-300">
              {t('landingPublic.' + l.key)}
            </Link>
          ))}
        </nav>
      </div>
      <p className="pb-6 text-center text-xs text-white/40">{t('landingPublic.copyright')}</p>
    </footer>
  )
}

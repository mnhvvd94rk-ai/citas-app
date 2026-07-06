import { NavLink, Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

// Layout del profesional: navbar + pestañas de navegación + contenido (Outlet).
export default function GestorLayout() {
  const { t } = useLanguage()
  const tabs = [
    { to: '/gestor/agenda', label: t('tabs.agenda') },
    { to: '/gestor/citas-pendientes', label: t('tabs.pending') },
    { to: '/gestor/disponibilidad', label: t('tabs.availability') },
    { to: '/gestor/pacientes', label: t('tabs.clients') },
  ]

  return (
    <div className="min-h-screen">
      <Navbar />
      <nav className="sticky top-[57px] z-10 border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `shrink-0 border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-gold-500 text-navy-800'
                    : 'border-transparent text-navy-400 hover:text-navy-700'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

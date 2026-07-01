import { NavLink, Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

const TABS = [
  { to: '/gestor/agenda', label: 'Agenda', icon: '📅' },
  { to: '/gestor/citas-pendientes', label: 'Pendientes', icon: '⏳' },
  { to: '/gestor/disponibilidad', label: 'Horarios', icon: '🕒' },
  { to: '/gestor/pacientes', label: 'Pacientes', icon: '👥' },
]

// Layout del gestor: navbar + pestañas de navegación + contenido (Outlet).
export default function GestorLayout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <nav className="sticky top-[57px] z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}

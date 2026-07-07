import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import Logo from './Logo.jsx'

// Dashboard profesional estilo Calendly: header + sidebar estrecho de 3 opciones
// (colapsable en móvil) + contenido principal.
export default function GestorLayout() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const nav = [
    { to: '/gestor/agenda', label: t('tabs.agenda'), icon: '📅' },
    { to: '/gestor/disponibilidad', label: t('tabs.availability'), icon: '⚙️' },
    { to: '/gestor/pacientes', label: t('tabs.clients'), icon: '👥' },
  ]

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-sm font-semibold transition-colors ${
      isActive
        ? 'border-green-500 bg-navy-50 text-navy-800'
        : 'border-transparent text-navy-400 hover:bg-navy-50 hover:text-navy-700'
    }`

  const NavItems = ({ onNavigate }) =>
    nav.map((n) => (
      <NavLink key={n.to} to={n.to} onClick={onNavigate} className={linkCls}>
        <span aria-hidden className="text-lg">{n.icon}</span>
        <span>{n.label}</span>
      </NavLink>
    ))

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuAbierto(true)}
              className="rounded-lg p-1.5 text-navy-600 hover:bg-navy-50 md:hidden"
              aria-label="Menú"
            >
              <span className="text-lg">☰</span>
            </button>
            <button onClick={() => navigate('/')} className="flex items-center" aria-label="Ikatun">
              <Logo />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-navy-600 sm:inline">
              {user?.nombre}
            </span>
            <LanguageSelector />
            <button
              onClick={handleLogout}
              className="rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-700 transition hover:bg-navy-100"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-3 md:block">
          <nav className="flex flex-col gap-1">
            <NavItems />
          </nav>
        </aside>

        {/* Drawer móvil */}
        {menuAbierto && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-navy-900/40" onClick={() => setMenuAbierto(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between px-2 py-2">
                <span className="font-bold text-navy-800">{t('common.appName')}</span>
                <button onClick={() => setMenuAbierto(false)} className="rounded-lg p-1 text-navy-500 hover:bg-navy-50" aria-label={t('agenda.close')}>✕</button>
              </div>
              <nav className="flex flex-col gap-1">
                <NavItems onNavigate={() => setMenuAbierto(false)} />
              </nav>
            </aside>
          </div>
        )}

        {/* Contenido principal */}
        <main className="min-w-0 flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

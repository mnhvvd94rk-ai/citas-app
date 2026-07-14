import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import Logo from './Logo.jsx'
import AvatarProfesional from './AvatarProfesional.jsx'

// Barra superior premium. Marca + selector de idioma + cerrar sesión.
export default function Navbar() {
  const { isAuthenticated, user, tipo, logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  const nombre = user
    ? tipo === 'MEDICO'
      ? user.nombre
      : `${user.nombre} ${user.apellido || ''}`.trim()
    : null

  return (
    <header className="sticky top-0 z-20 bg-navy-800 text-white shadow-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <button onClick={() => navigate('/')} className="flex items-center" aria-label="Kohtun">
          <Logo onDark />
        </button>
        <div className="flex items-center gap-3">
          <LanguageSelector variant="dark" />
          {isAuthenticated && (
            <>
              {tipo === 'MEDICO' && (
                <AvatarProfesional src={user.fotoPerfilUrl} nombre={user.nombre} className="h-8 w-8 rounded-full text-xs" />
              )}
              <span className="hidden max-w-[9rem] truncate text-sm text-white/70 sm:inline">{nombre}</span>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium transition hover:bg-white/20"
              >
                {t('common.logout')}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

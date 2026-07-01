import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Barra superior. Muestra la marca y, si hay sesión, el usuario y "Cerrar sesión".
export default function Navbar() {
  const { isAuthenticated, user, tipo, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  const nombre = user
    ? tipo === 'MEDICO'
      ? `Dr(a). ${user.nombre}`
      : `${user.nombre} ${user.apellido || ''}`.trim()
    : null

  return (
    <header className="sticky top-0 z-20 border-b border-teal-700 bg-teal-600 text-white shadow-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="text-lg">🩺</span>
          <span>Citas App</span>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[10rem] truncate opacity-90 sm:inline">{nombre}</span>
            <button
              onClick={handleLogout}
              className="rounded-md bg-teal-700 px-3 py-1.5 font-medium hover:bg-teal-800"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

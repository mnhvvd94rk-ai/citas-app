import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Spinner from './Spinner.jsx'

/**
 * Protege una ruta. Redirige a "/" si no hay sesión.
 * Si se pasa `rol` ("PACIENTE" | "MEDICO"), valida además el rol y, si no
 * coincide, redirige al dashboard correspondiente al rol real.
 */
export default function ProtectedRoute({ children, rol }) {
  const { isAuthenticated, loading, tipo } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (rol && tipo !== rol) {
    const destino = tipo === 'MEDICO' ? '/gestor/agenda' : '/paciente/citas'
    return <Navigate to={destino} replace />
  }

  return children
}

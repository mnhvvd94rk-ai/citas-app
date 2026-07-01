import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// Página de bienvenida: selector de tipo de usuario.
export default function Landing() {
  const { isAuthenticated, tipo } = useAuth()
  const navigate = useNavigate()

  // Si ya hay sesión, salta directo al dashboard correspondiente.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(tipo === 'MEDICO' ? '/gestor/agenda' : '/paciente/citas', { replace: true })
    }
  }, [isAuthenticated, tipo, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-600 to-teal-800 px-6 py-12 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mb-2 text-6xl">🩺</div>
        <h1 className="text-3xl font-bold">Citas App</h1>
        <p className="mt-2 text-teal-100">Gestión de citas médicas, simple y rápida.</p>

        <div className="mt-10 space-y-3">
          <button
            onClick={() => navigate('/login-paciente')}
            className="w-full rounded-xl bg-white py-4 text-lg font-semibold text-teal-700 shadow-lg transition hover:bg-teal-50"
          >
            🧑 Soy Paciente
          </button>
          <button
            onClick={() => navigate('/login-medico')}
            className="w-full rounded-xl border-2 border-white/70 bg-teal-700/40 py-4 text-lg font-semibold text-white shadow-lg backdrop-blur transition hover:bg-teal-700/70"
          >
            👩‍⚕️ Soy Profesional
          </button>
        </div>

        <p className="mt-8 text-sm text-teal-100">
          ¿Primera vez?{' '}
          <Link to="/registro-paciente" className="font-semibold text-white underline">
            Regístrate como paciente
          </Link>
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

// Login del médico/gestor.
export default function LoginMedico() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const res = await authApi.loginMedico(correo, password)
      login(res.token, res)
      navigate('/gestor/agenda', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-sm text-teal-700 hover:underline">← Volver</Link>
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 text-center">
            <div className="text-4xl">👩‍⚕️</div>
            <h1 className="mt-2 text-xl font-bold text-slate-800">Acceso Profesional</h1>
          </div>

          {error && <ErrorMessage error={error} className="mb-4" />}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Correo</label>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                placeholder="profesional@ejemplo.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
            >
              {cargando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

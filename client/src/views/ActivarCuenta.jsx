import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'

// Activación de cuenta de clientes importados.
// - Sin ?token → formulario para solicitar el email de activación.
// - Con ?token → formulario para crear la contraseña.
export default function ActivarCuenta() {
  const [params] = useSearchParams()
  const token = params.get('token')
  return token ? <CrearPassword token={token} /> : <SolicitarEmail />
}

const inputCls =
  'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

function Marco({ children }) {
  const { t } = useLanguage()
  return (
    <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/login-cliente" className="text-sm font-medium text-navy-500 hover:text-navy-700">
          ← {t('common.back')}
        </Link>
        <LanguageSelector />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-white p-7 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Paso 1: solicitar el email de activación ─────────────────────────────────
function SolicitarEmail() {
  const { t } = useLanguage()
  const [params] = useSearchParams()
  const [correo, setCorreo] = useState(params.get('email') || '')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [enviado, setEnviado] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await authApi.activarCuenta(correo)
      setEnviado(true)
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Marco>
      <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-navy-800">
        {t('activate.activateAccount')}
      </h1>

      {enviado ? (
        <div className="text-center">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t('activate.activationEmailSent')}
          </p>
          <Link
            to="/login-cliente"
            className="mt-6 inline-block text-sm font-semibold text-navy-700 hover:text-brand-600"
          >
            {t('activate.backToLogin')}
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-5 text-center text-sm text-navy-500">{t('activate.requestHint')}</p>
          {error && <ErrorMessage error={error} className="mb-4" />}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.email')}</label>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={inputCls}
                placeholder="tu@correo.com"
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
            >
              {cargando ? t('activate.sending') : t('activate.sendLink')}
            </button>
          </form>
        </>
      )}
    </Marco>
  )
}

// ── Paso 2: crear la contraseña (con token) ──────────────────────────────────
function CrearPassword({ token }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError({ message: t('activate.passwordTooShort') })
      return
    }
    if (password !== confirm) {
      setError({ message: t('activate.passwordMismatch') })
      return
    }
    setCargando(true)
    try {
      await authApi.completarActivacion(token, password)
      // Redirige al login con un aviso de éxito.
      navigate('/login-cliente?activated=1', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Marco>
      <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-navy-800">
        {t('activate.createYourPassword')}
      </h1>
      {error && <ErrorMessage error={error} className="mb-4" />}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('activate.confirmPassword')}</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
        >
          {cargando ? t('activate.activating') : t('activate.createAndEnter')}
        </button>
      </form>
    </Marco>
  )
}

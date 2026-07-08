import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'

// Login del profesional.
export default function LoginMedico() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLanguage()
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

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-700">
          ← {t('common.back')}
        </Link>
        <LanguageSelector />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-white p-7 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-navy-800">
              {t('loginPro.title')}
            </h1>

            {error && <ErrorMessage error={error} className="mb-4" />}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.email')}</label>
                <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} className={inputCls} placeholder="tu@correo.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
              </div>
              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {cargando ? t('common.entering') : t('common.enter')}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-navy-500">
              <Link to="/registro-profesional" className="font-semibold text-brand-600 hover:underline">
                {t('registerPro.dontHaveAccount')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

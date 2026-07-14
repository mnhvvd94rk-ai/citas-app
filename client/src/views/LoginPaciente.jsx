import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

// Ruta /login-cliente ("Se connecter (client)"): el cliente ya tiene credenciales
// propias (email o teléfono + contraseña) desde su registro, así que entra directo
// sin necesitar el código/enlace de su profesional.
//
// El correo es único global, pero el teléfono no: un mismo teléfono puede existir
// bajo varios profesionales. Si el backend encuentra más de una cuenta válida,
// devuelve { multiple, opciones } y mostramos una pantalla para elegir cuál.
export default function LoginPaciente() {
  const { t } = useLanguage()
  const { login } = useAuth()
  const navigate = useNavigate()

  const [cred, setCred] = useState({ identificador: '', password: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [opciones, setOpciones] = useState(null) // cuentas coincidentes a elegir

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  function entrar(res) {
    login(res.token, res)
    navigate('/paciente/citas', { replace: true })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const res = await authApi.clienteLoginGlobal(cred.identificador.trim(), cred.password)
      if (res?.multiple) setOpciones(res.opciones)
      else entrar(res)
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  async function elegir(usuarioId) {
    setError(null)
    setEnviando(true)
    try {
      const res = await authApi.clienteLoginElegir(usuarioId, cred.identificador.trim(), cred.password)
      entrar(res)
    } catch (err) {
      setError(err)
      setOpciones(null) // vuelve al formulario para reintentar
    } finally {
      setEnviando(false)
    }
  }

  // Pantalla de elección cuando el identificador coincide con varias cuentas.
  if (opciones) {
    return (
      <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
        <div className="flex items-center justify-between">
          <button onClick={() => { setOpciones(null); setError(null) }} className="text-sm font-medium text-navy-500 hover:text-navy-700">
            ← {t('common.back')}
          </button>
          <LanguageSelector />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            <h1 className="mb-1 text-center text-xl font-bold text-navy-800">{t('loginClient.chooseTitle')}</h1>
            <p className="mb-5 text-center text-sm text-navy-500">{t('loginClient.chooseMsg')}</p>
            {error && <ErrorMessage error={error} className="mb-4" />}
            <div className="space-y-3">
              {opciones.map((o) => (
                <button
                  key={o.id}
                  onClick={() => elegir(o.id)}
                  disabled={enviando}
                  className="flex w-full items-center justify-between rounded-xl border border-navy-200 bg-white px-4 py-3 text-left transition hover:border-navy-400 hover:bg-navy-50 disabled:opacity-60"
                >
                  <span className="font-semibold text-navy-800">{o.profesionalNombre}</span>
                  <span className="text-xs text-navy-400">{o.pista}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-700">
          ← {t('common.back')}
        </Link>
        <LanguageSelector />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
          <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-navy-800">{t('loginClient.title')}</h1>
          <p className="mb-6 text-center text-sm text-navy-500">{t('loginClient.credSubtitle')}</p>
          {error && <ErrorMessage error={error} className="mb-4" />}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('reservar.identifier')}</label>
              <input
                name="username"
                autoComplete="username"
                value={cred.identificador}
                onChange={(e) => setCred((p) => ({ ...p, identificador: e.target.value }))}
                className={inputCls}
                placeholder={t('reservar.identifierPlaceholder')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={cred.password}
                onChange={(e) => setCred((p) => ({ ...p, password: e.target.value }))}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
            >
              {enviando ? t('common.entering') : t('common.enter')}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-navy-500">
            {t('loginClient.noAccount')}{' '}
            <Link to="/registro-cliente" className="font-semibold text-brand-600 hover:underline">
              {t('loginClient.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

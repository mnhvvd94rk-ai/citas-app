import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import PhoneInput from '../components/PhoneInput.jsx'

// Registro self-serve del profesional. POST /auth/registro-medico → auto-login.
export default function RegistroProfesional() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLanguage()

  const [form, setForm] = useState({
    nombre: '',
    especialidad: '',
    telefono: '',
    correo: '',
    password: '',
    confirmar: '',
  })
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)

  function setCampo(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function validar() {
    if (!form.nombre.trim()) return t('registerPro.errName')
    if (!form.especialidad.trim()) return t('registerPro.errSpecialty')
    if (!/^\S+@\S+\.\S+$/.test(form.correo)) return t('registerPro.errEmail')
    if (form.password.length < 6) return t('registerPro.errPwLen')
    if (form.password !== form.confirmar) return t('registerPro.errPwMatch')
    if (!acepta) return t('registerPro.errTerms')
    return null
  }

  async function onSubmit(e) {
    e.preventDefault()
    const err = validar()
    if (err) return setError(err)
    setError(null)
    setEnviando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        especialidad: form.especialidad.trim(),
        correo: form.correo.trim(),
        password: form.password,
        telefono: form.telefono.trim() || undefined,
      }
      const res = await authApi.registroMedico(payload)
      // El backend devuelve token → auto-login para entrar directo al panel.
      if (res?.token) login(res.token, res)
      setExito(true)
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  if (exito) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50 px-6 py-8">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-600">✓</div>
          <h1 className="mt-4 text-xl font-bold text-navy-800">{t('registerPro.successTitle')}</h1>
          <p className="mt-2 text-navy-500">{t('registerPro.successMsg')}</p>
          <button
            onClick={() => navigate('/gestor/agenda', { replace: true })}
            className="mt-6 w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800"
          >
            {t('registerPro.goToPanel')}
          </button>
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
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-7 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            <h1 className="text-center text-2xl font-bold tracking-tight text-navy-800">
              {t('registerPro.registerAsProfessional')}
            </h1>
            <p className="mt-1 mb-6 text-center text-sm text-navy-500">{t('registerPro.subtitle')}</p>

            {error && <ErrorMessage error={error} className="mb-4" />}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('registerPro.fullName')}</label>
                <input name="nombre" value={form.nombre} onChange={setCampo} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('registerPro.specialtyOrService')}</label>
                <input name="especialidad" value={form.especialidad} onChange={setCampo} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.email')}</label>
                  <input name="correo" type="email" value={form.correo} onChange={setCampo} className={inputCls} placeholder="tu@correo.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('registerPro.phone')}</label>
                  <PhoneInput value={form.telefono} onChange={(v) => setForm((f) => ({ ...f, telefono: v }))} inputClassName={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
                  <input name="password" type="password" value={form.password} onChange={setCampo} className={inputCls} placeholder="••••••••" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('registerPro.confirmPassword')}</label>
                  <input name="confirmar" type="password" value={form.confirmar} onChange={setCampo} className={inputCls} placeholder="••••••••" />
                </div>
              </div>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acepta}
                  onChange={(e) => setAcepta(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-navy-300 text-navy-700 focus:ring-navy-500"
                />
                <span className="text-sm text-navy-700">
                  {t('registerPro.acceptTerms')}{' '}
                  <Link to="/terminos" target="_blank" className="font-semibold text-brand-600 hover:underline">{t('legal.seeTerms')}</Link>
                  {' · '}
                  <Link to="/privacidad" target="_blank" className="font-semibold text-brand-600 hover:underline">{t('legal.seePrivacy')}</Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {enviando ? t('registerPro.creating') : t('registerPro.createAccount')}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-navy-500">
              <Link to="/login-medico" className="font-semibold text-brand-600 hover:underline">
                {t('registerPro.alreadyHaveAccount')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

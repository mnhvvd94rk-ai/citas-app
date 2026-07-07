import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import CameraCapture from '../components/CameraCapture.jsx'
import SignaturePad from '../components/SignaturePad.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'

const N_STEPS = 6

export default function RegistroPaciente() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLanguage()
  const [paso, setPaso] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const [foto, setFoto] = useState(null)
  const [firma, setFirma] = useState(null)
  const [datos, setDatos] = useState({ nombre: '', apellido: '', documentoIdentidad: '', telefono: '' })
  const [cuenta, setCuenta] = useState({ correo: '', password: '', confirmar: '' })
  const [acepta, setAcepta] = useState(false)

  const steps = t('register.steps')

  function setCampo(setter) {
    return (e) => setter((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function validarPaso() {
    switch (paso) {
      case 0:
        return foto ? null : t('register.errNeedPhoto')
      case 1:
        if (!datos.nombre.trim()) return t('register.errName')
        if (!datos.apellido.trim()) return t('register.errLastName')
        if (!datos.documentoIdentidad.trim()) return t('register.errId')
        if (!datos.telefono.trim()) return t('register.errPhone')
        return null
      case 2:
        return firma ? null : t('register.errNeedSign')
      case 3:
        if (!/^\S+@\S+\.\S+$/.test(cuenta.correo)) return t('register.errEmail')
        if (cuenta.password.length < 6) return t('register.errPwLen')
        if (cuenta.password !== cuenta.confirmar) return t('register.errPwMatch')
        return null
      case 4:
        return acepta ? null : t('register.errTerms')
      default:
        return null
    }
  }

  function avanzar() {
    const err = validarPaso()
    if (err) return setError(err)
    setError(null)
    setPaso((p) => Math.min(p + 1, N_STEPS - 1))
  }

  function retroceder() {
    setError(null)
    setPaso((p) => Math.max(p - 1, 0))
  }

  async function crearCuenta() {
    setError(null)
    setEnviando(true)
    try {
      const payload = {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        documentoIdentidad: datos.documentoIdentidad.trim(),
        telefono: datos.telefono.trim(),
        correo: cuenta.correo.trim(),
        password: cuenta.password,
        fotoIdentidadUrl: foto || undefined,
        firmaUrl: firma || undefined,
      }
      const res = await authApi.registroPaciente(payload)
      login(res.token, res)
      navigate('/paciente/citas', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div className="min-h-screen bg-navy-50 pb-24">
      <header className="bg-navy-800 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link to="/" className="text-sm text-white/70 hover:text-white">← {t('register.exit')}</Link>
          <span className="font-semibold">{t('register.header')}</span>
          <LanguageSelector variant="dark" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4">
        <div className="my-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-coral-500 transition-all" style={{ width: `${((paso + 1) / N_STEPS) * 100}%` }} />
          </div>
          <p className="mt-2 text-center text-sm font-medium text-navy-500">
            {t('register.step')} {paso + 1}: {steps[paso]}
          </p>
        </div>

        {error && <ErrorMessage error={error} className="mb-4" />}

        <div className="rounded-2xl bg-white p-6 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
          {paso === 0 && (
            <div>
              <h2 className="mb-1 text-lg font-bold text-navy-800">{t('register.docTitle')}</h2>
              <p className="mb-4 text-sm text-navy-500">{t('register.docDesc')}</p>
              <CameraCapture value={foto} onCapture={setFoto} />
            </div>
          )}

          {paso === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-navy-800">{t('register.dataTitle')}</h2>
              {[
                { name: 'nombre', label: t('register.fName') },
                { name: 'apellido', label: t('register.fLastName') },
                { name: 'documentoIdentidad', label: t('register.fId') },
                { name: 'telefono', label: t('register.fPhone'), type: 'tel' },
              ].map((f) => (
                <div key={f.name}>
                  <label className="mb-1.5 block text-sm font-medium text-navy-700">{f.label}</label>
                  <input name={f.name} type={f.type || 'text'} value={datos[f.name]} onChange={setCampo(setDatos)} className={inputCls} />
                </div>
              ))}
            </div>
          )}

          {paso === 2 && (
            <div>
              <h2 className="mb-1 text-lg font-bold text-navy-800">{t('register.signTitle')}</h2>
              <p className="mb-4 text-sm text-navy-500">{t('register.signDesc')}</p>
              <SignaturePad value={firma} onConfirm={setFirma} />
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-navy-800">{t('register.accountTitle')}</h2>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.email')}</label>
                <input name="correo" type="email" value={cuenta.correo} onChange={setCampo(setCuenta)} className={inputCls} placeholder="tu@correo.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
                <input name="password" type="password" value={cuenta.password} onChange={setCampo(setCuenta)} className={inputCls} placeholder={t('register.pwPlaceholder')} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('register.confirmPassword')}</label>
                <input name="confirmar" type="password" value={cuenta.confirmar} onChange={setCampo(setCuenta)} className={inputCls} placeholder={t('register.pwConfirmPlaceholder')} />
              </div>
            </div>
          )}

          {paso === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-navy-800">{t('register.termsTitle')}</h2>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-navy-100 bg-navy-50 p-4 text-sm text-navy-600">
                {t('register.termsBody')}
              </div>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 h-5 w-5 rounded border-navy-300 text-navy-700 focus:ring-navy-500" />
                <span className="text-sm text-navy-700">{t('register.termsAccept')}</span>
              </label>
            </div>
          )}

          {paso === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-navy-800">{t('register.summaryTitle')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Resumen label={t('register.sDoc')} valor={foto ? t('register.sCaptured') : '—'} />
                <Resumen label={t('register.sSign')} valor={firma ? t('register.sRegistered') : '—'} />
                <Resumen label={t('register.fName')} valor={datos.nombre} />
                <Resumen label={t('register.fLastName')} valor={datos.apellido} />
                <Resumen label={t('register.fId')} valor={datos.documentoIdentidad} />
                <Resumen label={t('register.fPhone')} valor={datos.telefono} />
                <Resumen label={t('common.email')} valor={cuenta.correo} className="col-span-2" />
              </div>
              {foto && <img src={foto} alt="" className="mx-auto max-h-40 rounded-xl border border-navy-100" />}
              <button
                onClick={crearCuenta}
                disabled={enviando}
                className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {enviando ? t('register.creatingAccount') : t('register.createAccount')}
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          {paso > 0 && (
            <button onClick={retroceder} className="flex-1 rounded-xl border border-navy-200 bg-white py-3.5 font-medium text-navy-700 transition hover:bg-navy-50">
              {t('register.back')}
            </button>
          )}
          {paso < N_STEPS - 1 && (
            <button onClick={avanzar} className="flex-1 rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800">
              {t('register.continue')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Resumen({ label, valor, className = '' }) {
  return (
    <div className={`rounded-xl bg-navy-50 px-3 py-2 ${className}`}>
      <p className="text-xs text-navy-400">{label}</p>
      <p className="truncate text-sm font-semibold text-navy-800">{valor || '—'}</p>
    </div>
  )
}

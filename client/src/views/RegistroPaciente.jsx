import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authApi, medicosApi, LAST_SLUG_KEY } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import CameraCapture from '../components/CameraCapture.jsx'
import SignaturePad from '../components/SignaturePad.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import Spinner from '../components/Spinner.jsx'
import EntrarConCodigo from '../components/EntrarConCodigo.jsx'
import PhoneInput from '../components/PhoneInput.jsx'

const N_STEPS = 6

export default function RegistroPaciente() {
  const navigate = useNavigate()
  const { slug } = useParams() // presente solo en /reservar/:slug
  const { login } = useAuth()
  const { t, lang } = useLanguage()
  const [paso, setPaso] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // Resolución del enlace del profesional. Sin slug no se puede registrar: un
  // cliente siempre nace vinculado al profesional dueño del enlace.
  // estadoEnlace: 'sin-enlace' | 'cargando' | 'ok' | 'invalido'
  const [estadoEnlace, setEstadoEnlace] = useState(slug ? 'cargando' : 'sin-enlace')
  const [profesional, setProfesional] = useState(null)

  // vista: 'registro' (multi-paso) | 'login' (email/tel + contraseña) | 'auto'
  // (semi-automático "Hola de nuevo"). saludo = nombre del cliente recordado.
  const [vista, setVista] = useState('registro')
  const [saludo, setSaludo] = useState('')
  const [accion, setAccion] = useState(false) // procesando continuar/login
  const [credencial, setCredencial] = useState({ identificador: '', password: '' })

  useEffect(() => {
    if (!slug) {
      setEstadoEnlace('sin-enlace')
      return
    }
    let cancelado = false
    setEstadoEnlace('cargando')
    medicosApi
      .porSlug(slug)
      .then(async (prof) => {
        if (cancelado) return
        setProfesional(prof)
        setEstadoEnlace('ok')
        // Recuerda el enlace para redirigir aquí si expira la sesión (Tarea 1).
        try { localStorage.setItem(LAST_SLUG_KEY, slug) } catch { /* noop */ }
        // ¿Este dispositivo ya tiene sesión recordada con este profesional?
        try {
          const est = await authApi.dispositivoEstado(slug)
          if (!cancelado && est?.ok) {
            setSaludo(est.cliente?.nombre || '')
            setVista('auto')
          }
        } catch {
          /* sin sesión recordada: se queda en 'registro' */
        }
      })
      .catch(() => {
        if (cancelado) return
        setEstadoEnlace('invalido')
      })
    return () => {
      cancelado = true
    }
  }, [slug])

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
        // Foto de identidad OPCIONAL: no bloquea el avance. Si en el futuro el
        // profesional quiere exigirla, se decidirá de su lado, no aquí.
        return null
      case 1:
        if (!datos.nombre.trim()) return t('register.errName')
        if (!datos.apellido.trim()) return t('register.errLastName')
        if (!datos.documentoIdentidad.trim()) return t('register.errId')
        if (!datos.telefono.trim()) return t('register.errPhone')
        return null
      case 2:
        // Firma OPCIONAL: no bloquea el avance (misma lógica que la foto).
        return null
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
        slug, // vincula el nuevo cliente al profesional dueño del enlace
        idiomaPreferido: lang.toUpperCase(), // idioma elegido en pantalla al registrarse
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

  // Login semi-automático: canjea el token de dispositivo por un JWT fresco.
  async function continuar() {
    setError(null)
    setAccion(true)
    try {
      const res = await authApi.dispositivoCanjear(slug)
      login(res.token, res)
      navigate('/paciente/citas', { replace: true })
    } catch (err) {
      // El token murió entre el saludo y el clic: cae al login manual.
      setError(err)
      setVista('login')
    } finally {
      setAccion(false)
    }
  }

  // "No soy yo": revoca el token de dispositivo y muestra el login manual.
  async function noSoyYo() {
    setError(null)
    setAccion(true)
    try {
      await authApi.dispositivoRevocar()
    } catch {
      /* noop */
    }
    setSaludo('')
    setVista('login')
    setAccion(false)
  }

  // Login real (email o teléfono + contraseña) en el contexto del profesional.
  async function loginManual(e) {
    e.preventDefault()
    setError(null)
    setAccion(true)
    try {
      const res = await authApi.clienteLogin(slug, credencial.identificador.trim(), credencial.password)
      login(res.token, res)
      navigate('/paciente/citas', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setAccion(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  // Sin enlace de profesional (ruta genérica) o enlace inválido/caducado: no se
  // permite el registro. Se explica que hace falta el enlace propio del profesional.
  if (estadoEnlace === 'sin-enlace' || estadoEnlace === 'invalido') {
    const esInvalido = estadoEnlace === 'invalido'
    return (
      <AvisoEnlace
        t={t}
        titulo={esInvalido ? t('reservar.invalidTitle') : t('reservar.needLinkTitle')}
        mensaje={esInvalido ? t('reservar.invalidMsg') : t('reservar.needLinkMsg')}
      />
    )
  }

  // Resolviendo el enlace del profesional.
  if (estadoEnlace === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50">
        <Spinner label={t('reservar.checking')} />
      </div>
    )
  }

  // Login semi-automático: este dispositivo ya tiene sesión recordada.
  if (vista === 'auto') {
    return (
      <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-700">← {t('common.back')}</Link>
          <LanguageSelector />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            {profesional && <p className="text-sm text-navy-500">{profesional.nombre}</p>}
            <h1 className="mt-2 text-xl font-bold text-navy-800">{t('reservar.welcomeBack', { name: saludo })}</h1>
            {error && <ErrorMessage error={error} className="mt-4" />}
            <button
              onClick={continuar}
              disabled={accion}
              className="mt-6 w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
            >
              {accion ? t('common.entering') : t('reservar.continueSession')}
            </button>
            <button onClick={noSoyYo} disabled={accion} className="mt-3 text-sm font-medium text-navy-500 hover:text-brand-600">
              {t('reservar.notMe')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Login manual con email/teléfono + contraseña, dentro del profesional.
  if (vista === 'login') {
    return (
      <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-700">← {t('common.back')}</Link>
          <LanguageSelector />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            {profesional && <p className="mb-1 text-center text-sm text-navy-500">{t('reservar.withPro')} {profesional.nombre}</p>}
            <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-navy-800">{t('loginClient.title')}</h1>
            {error && <ErrorMessage error={error} className="mb-4" />}
            <form onSubmit={loginManual} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('reservar.identifier')}</label>
                <input name="username" autoComplete="username" value={credencial.identificador} onChange={(e) => setCredencial((p) => ({ ...p, identificador: e.target.value }))} className={inputCls} placeholder={t('reservar.identifierPlaceholder')} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
                <input type="password" name="password" autoComplete="current-password" value={credencial.password} onChange={(e) => setCredencial((p) => ({ ...p, password: e.target.value }))} className={inputCls} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={accion} className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300">
                {accion ? t('common.entering') : t('common.enter')}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-navy-500">
              {t('loginClient.noAccount')}{' '}
              <button onClick={() => { setError(null); setVista('registro') }} className="font-semibold text-navy-700 hover:text-brand-600">
                {t('reservar.imNew')}
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

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
        {profesional && (
          <div className="mt-5 rounded-2xl bg-white px-5 py-4 text-center shadow-sm ring-1 ring-navy-100">
            <p className="text-sm text-navy-500">{t('reservar.withPro')}</p>
            <p className="text-lg font-bold text-navy-800">{profesional.nombre}</p>
            {profesional.especialidad && (
              <p className="text-xs text-navy-400">{profesional.especialidad}</p>
            )}
            <p className="mt-2 text-xs text-navy-500">
              {t('reservar.haveAccount')}{' '}
              <button onClick={() => { setError(null); setVista('login') }} className="font-semibold text-brand-600 hover:underline">
                {t('reservar.login')}
              </button>
            </p>
          </div>
        )}
        <div className="my-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${((paso + 1) / N_STEPS) * 100}%` }} />
          </div>
          <p className="mt-2 text-center text-sm font-medium text-navy-500">
            {t('register.step')} {paso + 1}: {steps[paso]}
          </p>
        </div>

        <ErrorRegistro error={error} t={t} onLogin={() => navigate('/login-cliente')} className="mb-4" />

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
                  {f.name === 'telefono' ? (
                    <PhoneInput value={datos.telefono} onChange={(v) => setDatos((p) => ({ ...p, telefono: v }))} inputClassName={inputCls} />
                  ) : (
                    <input name={f.name} type={f.type || 'text'} value={datos[f.name]} onChange={setCampo(setDatos)} className={inputCls} />
                  )}
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
                <input name="correo" type="email" autoComplete="username" value={cuenta.correo} onChange={setCampo(setCuenta)} className={inputCls} placeholder="tu@correo.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('common.password')}</label>
                <input name="password" type="password" autoComplete="new-password" value={cuenta.password} onChange={setCampo(setCuenta)} className={inputCls} placeholder={t('register.pwPlaceholder')} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('register.confirmPassword')}</label>
                <input name="confirmar" type="password" autoComplete="new-password" value={cuenta.confirmar} onChange={setCampo(setCuenta)} className={inputCls} placeholder={t('register.pwConfirmPlaceholder')} />
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
                <span className="text-sm text-navy-700">{t('legal.acceptTerms')}</span>
              </label>
              <p className="text-xs text-navy-500">
                <Link to="/terminos" target="_blank" className="font-semibold text-brand-600 hover:underline">{t('legal.seeTerms')}</Link>
                {' · '}
                <Link to="/privacidad" target="_blank" className="font-semibold text-brand-600 hover:underline">{t('legal.seePrivacy')}</Link>
              </p>
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

// Pantalla mostrada cuando no hay un enlace de profesional válido: sin él no se
// puede crear una cuenta de cliente.
function AvisoEnlace({ t, titulo, mensaje }) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-700">
          ← {t('common.back')}
        </Link>
        <LanguageSelector />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">
            🔗
          </div>
          <h1 className="mb-2 text-xl font-bold text-navy-800">{titulo}</h1>
          <p className="text-sm text-navy-500">{mensaje}</p>

          {/* Salida real: si el cliente tiene a mano el código de su profesional,
              lo escribe aquí y continúa, en vez de quedarse sin poder avanzar. */}
          <EntrarConCodigo />
        </div>
      </div>
    </div>
  )
}

// Error del registro. Para las colisiones de datos únicos (correo/documento) muestra
// un mensaje claro y traducido + un acceso directo a "Iniciar sesión" (login global
// con selector de profesionales), en vez del texto crudo del backend. El resto de
// errores caen al ErrorMessage estándar.
function ErrorRegistro({ error, t, onLogin, className = '' }) {
  if (!error) return null
  const code = error.code
  if (code === 'CORREO_YA_REGISTRADO' || code === 'DOCUMENTO_YA_REGISTRADO') {
    const mensaje = code === 'CORREO_YA_REGISTRADO' ? t('register.emailExists') : t('register.docExists')
    return (
      <div role="alert" className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}>
        <p>{mensaje}</p>
        <button
          onClick={onLogin}
          className="mt-2 rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-800"
        >
          {t('register.goLogin')}
        </button>
      </div>
    )
  }
  return <ErrorMessage error={error} className={className} />
}

function Resumen({ label, valor, className = '' }) {
  return (
    <div className={`rounded-xl bg-navy-50 px-3 py-2 ${className}`}>
      <p className="text-xs text-navy-400">{label}</p>
      <p className="truncate text-sm font-semibold text-navy-800">{valor || '—'}</p>
    </div>
  )
}

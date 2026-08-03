import { useState } from 'react'
import { pacientesApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import Spinner from './Spinner.jsx'
import ErrorMessage from './ErrorMessage.jsx'
import PhoneInput from './PhoneInput.jsx'

// Alta manual de UN cliente desde "Mis Clientes". Reutiliza EXACTAMENTE la
// misma lógica del alta masiva (POST /pacientes/importar): el cliente nace
// vinculado al profesional actual, sin contraseña y con cuentaActivada: false,
// igual que los importados por CSV. Solo cambia la entrada: un formulario en
// vez de un archivo.
export default function AgregarClienteModal({ onClose, onAdded }) {
  const { t } = useLanguage()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [idioma, setIdioma] = useState('') // ES | EN | FR (obligatorio)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const nombreOk = nombre.trim().length > 0
  const telefonoOk = telefono.trim().length > 0
  const puedeGuardar = nombreOk && telefonoOk && idioma && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      // Reutiliza el endpoint de importación con un solo cliente. El correo
      // vacío se omite: el backend genera un marcador y el cliente nace sin
      // forma propia de activarse (aceptable, igual que un importado sin correo).
      const r = await pacientesApi.importar([
        {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          correo: correo.trim() || undefined,
          idiomaPreferido: idioma,
        },
      ])
      if (r.creados > 0) {
        onAdded?.()
        onClose()
        return
      }
      if (r.duplicados > 0) {
        setError({ message: t('clients.addClient.duplicate') })
      } else {
        setError({ message: t('clients.addClient.error') })
      }
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-3 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold text-navy-800">{t('clients.addClient.title')}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-navy-400 hover:text-navy-700">×</button>
        </div>

        {error && <ErrorMessage error={error} className="mb-4" />}

        <div className="space-y-4">
          {/* Nombre (obligatorio) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">
              {t('clients.addClient.name')} <span className="text-red-500">*</span>
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t('clients.addClient.namePlaceholder')}
              className={inputCls}
            />
          </div>

          {/* Teléfono (obligatorio) — componente PhoneInput con selector de país */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">
              {t('clients.addClient.phone')} <span className="text-red-500">*</span>
            </label>
            <PhoneInput value={telefono} onChange={setTelefono} inputClassName={inputCls} />
          </div>

          {/* Correo (opcional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">
              {t('clients.addClient.email')}
            </label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder={t('clients.addClient.emailPlaceholder')}
              className={inputCls}
            />
          </div>

          {/* Idioma preferido (obligatorio) — importa para sus notificaciones */}
          <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-3">
            <p className="mb-1 text-sm font-semibold text-navy-700">
              {t('clients.addClient.language')} <span className="text-red-500">*</span>
            </p>
            <p className="mb-2 text-xs text-navy-500">{t('clients.addClient.languageHint')}</p>
            <div className="flex flex-wrap gap-2">
              {[['ES', 'spanish'], ['EN', 'english'], ['FR', 'french']].map(([code, key]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setIdioma(code)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                    idioma === code
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-navy-200 text-navy-600 hover:border-brand-300'
                  }`}
                >
                  {t('clients.' + key)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-semibold text-navy-500 hover:text-navy-800">
            {t('common.cancel')}
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className="rounded-lg bg-navy-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
          >
            {guardando ? t('clients.addClient.saving') : t('clients.addClient.save')}
          </button>
        </div>
        {guardando && <Spinner label={t('clients.addClient.saving')} className="mt-3" />}
      </div>
    </div>
  )
}

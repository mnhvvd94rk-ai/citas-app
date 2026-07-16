import { useState } from 'react'
import { medicosApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'
import PhoneInput from './PhoneInput.jsx'

// Tarjeta de perfil editable del profesional: teléfono (con selector de código de
// país), dirección/ubicación y ficha biográfica. Estos datos los ve el cliente en
// su dashboard. Vive junto a la foto de perfil y el enlace de registro en la agenda.
export default function PerfilProfesionalCard() {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()

  const [telefono, setTelefono] = useState(user?.telefono || '')
  const [direccion, setDireccion] = useState(user?.direccion || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(false)

  // Hay cambios sin guardar respecto a lo que ya está en el perfil.
  const sucio =
    (telefono || '') !== (user?.telefono || '') ||
    (direccion || '') !== (user?.direccion || '') ||
    (bio || '') !== (user?.bio || '')

  async function guardar(e) {
    e.preventDefault()
    if (!sucio || guardando) return
    setError(null)
    setAviso(false)
    setGuardando(true)
    try {
      await medicosApi.actualizarPerfil({ telefono, direccion, bio })
      await refreshUser()
      setAviso(true)
      setTimeout(() => setAviso(false), 3000)
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <form onSubmit={guardar} className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-navy-800">{t('profileEdit.title')}</h2>
      <p className="mt-0.5 text-xs text-navy-500">{t('profileEdit.desc')}</p>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('profileEdit.phone')}</label>
          <PhoneInput value={telefono} onChange={setTelefono} inputClassName={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('profileEdit.address')}</label>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder={t('profileEdit.addressPlaceholder')}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('profileEdit.bio')}</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t('profileEdit.bioPlaceholder')}
          className={`${inputCls} resize-y`}
        />
      </div>

      {error && <ErrorMessage error={error} className="mt-3" />}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={!sucio || guardando}
          className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
        >
          {guardando ? t('profileEdit.saving') : t('profileEdit.save')}
        </button>
        {aviso && <span className="text-sm font-medium text-emerald-600">{t('profileEdit.saved')}</span>}
      </div>
    </form>
  )
}

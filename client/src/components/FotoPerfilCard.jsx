import { useRef, useState } from 'react'
import { medicosApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'
import AvatarProfesional from './AvatarProfesional.jsx'

// Reduce la imagen elegida a un cuadrado máx. 512px y la exporta como JPEG base64,
// para no enviar (ni guardar) imágenes enormes. El backend limita el tamaño igual.
function archivoADataUrl(file, maxLado = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Tarjeta de foto de perfil del profesional (panel). Foto opcional: si no hay,
// se ve el avatar genérico. Vive junto al enlace de registro en la agenda.
export default function FotoPerfilCard() {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()
  const inputRef = useRef(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function onArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    setError(null)
    setGuardando(true)
    try {
      const dataUrl = await archivoADataUrl(file)
      await medicosApi.actualizarFoto(dataUrl)
      await refreshUser()
    } catch (err) {
      setError(err?.message ? err : { message: t('profilePhoto.error') })
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    setError(null)
    setGuardando(true)
    try {
      await medicosApi.actualizarFoto(null)
      await refreshUser()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-4">
        <AvatarProfesional src={user?.fotoPerfilUrl} nombre={user?.nombre} className="h-16 w-16 rounded-2xl text-xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-navy-800">{t('profilePhoto.title')}</h2>
          <p className="mt-0.5 text-xs text-navy-500">{t('profilePhoto.desc')}</p>
          <div className="mt-2 flex gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={guardando}
              className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
            >
              {guardando ? t('profilePhoto.saving') : user?.fotoPerfilUrl ? t('profilePhoto.change') : t('profilePhoto.upload')}
            </button>
            {user?.fotoPerfilUrl && !guardando && (
              <button onClick={quitar} className="text-xs font-medium text-navy-500 hover:text-red-600">
                {t('profilePhoto.remove')}
              </button>
            )}
          </div>
          {error && <ErrorMessage error={error} className="mt-2" />}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onArchivo}
          className="hidden"
        />
      </div>
    </div>
  )
}

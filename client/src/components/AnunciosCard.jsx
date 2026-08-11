import { useEffect, useState } from 'react'
import { anunciosApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

// Tarjeta del panel del profesional para publicar/quitar anuncios que sus clientes
// ven en su dashboard. Vive junto a la foto de perfil y el perfil editable en la
// agenda. El "quitar" es un soft-delete en el backend (activo=false).
export default function AnunciosCard() {
  const { t, lang } = useLanguage()
  const [anuncios, setAnuncios] = useState([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [publicando, setPublicando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    anunciosApi
      .listar()
      .then(setAnuncios)
      .catch((e) => setError(e))
      .finally(() => setCargando(false))
  }, [])

  async function publicar(e) {
    e.preventDefault()
    const t2 = texto.trim()
    if (!t2 || publicando) return
    setError(null)
    setPublicando(true)
    try {
      const nuevo = await anunciosApi.crear(t2)
      setAnuncios((prev) => [nuevo, ...prev]) // más reciente primero
      setTexto('')
    } catch (err) {
      setError(err)
    } finally {
      setPublicando(false)
    }
  }

  async function quitar(id) {
    setError(null)
    // Optimista: lo saco de la lista y, si falla, lo restauro.
    const previo = anuncios
    setAnuncios((prev) => prev.filter((a) => a.id !== id))
    try {
      await anunciosApi.quitar(id)
    } catch (err) {
      setAnuncios(previo)
      setError(err)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-navy-800">{t('clientDash.annManageTitle')}</h2>
      <p className="mt-0.5 text-xs text-navy-500">{t('clientDash.annManageDesc')}</p>

      <form onSubmit={publicar} className="mt-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={t('clientDash.annPlaceholder')}
          className={`${inputCls} resize-y`}
        />
        <div className="mt-2">
          <button
            type="submit"
            disabled={!texto.trim() || publicando}
            className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
          >
            {publicando ? t('clientDash.annPublishing') : t('clientDash.annPublish')}
          </button>
        </div>
      </form>

      {error && <ErrorMessage error={error} className="mt-3" />}

      {!cargando && (
        <ul className="mt-4 space-y-2">
          {anuncios.length === 0 ? (
            <li className="text-sm text-navy-400">{t('clientDash.annNone')}</li>
          ) : (
            anuncios.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm text-navy-800">{a.texto}</p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    {new Date(a.fechaCreacion).toLocaleDateString(lang)}
                  </p>
                </div>
                <button
                  onClick={() => quitar(a.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  {t('clientDash.annRemove')}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  )
}

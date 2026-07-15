import { useEffect, useState } from 'react'
import { clientesApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { normalizarCodigo } from '../lib/slug.js'
import ErrorMessage from './ErrorMessage.jsx'

// Selector persistente de "mis profesionales" para el cliente. Muestra los chips
// para cambiar de profesional cuando tiene más de uno, y SIEMPRE ofrece "Agregar
// profesional" para conectarse con uno nuevo desde su código/enlace, sin volver a
// registrarse (el cliente ya está autenticado).
export default function SelectorProfesionales() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const [lista, setLista] = useState([])
  const [cambiando, setCambiando] = useState(false)

  // Formulario "Agregar profesional".
  const [abierto, setAbierto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'info', msg }

  function recargar() {
    return clientesApi
      .misProfesionales()
      .then((r) => setLista(r?.profesionales || []))
      .catch(() => {})
  }
  useEffect(() => {
    recargar()
  }, [])

  async function cambiar(profesionalId, actual) {
    if (actual || cambiando) return
    setCambiando(true)
    try {
      const res = await clientesApi.cambiarProfesional(profesionalId)
      login(res.token, res)
      // Recarga simple: al remontar, el dashboard trae los datos del profesional
      // recién seleccionado con el token nuevo.
      window.location.reload()
    } catch {
      setCambiando(false)
    }
  }

  async function agregar(e) {
    e.preventDefault()
    const slug = normalizarCodigo(codigo)
    if (!slug) {
      setError(t('reservar.codeEmpty'))
      return
    }
    setError(null)
    setAviso(null)
    setAgregando(true)
    try {
      const res = await clientesApi.agregarProfesional(slug)
      const nombre = res?.profesional?.nombre || ''
      if (res?.yaConectado) {
        // Ya tenía cuenta con ese profesional: no se duplica nada.
        setAviso({ tipo: 'info', msg: t('clientDash.addProAlready', { name: nombre }) })
      } else {
        setAviso({ tipo: 'ok', msg: t('clientDash.addProDone', { name: nombre }) })
        setCodigo('')
        setAbierto(false)
        await recargar() // el nuevo profesional aparece de inmediato en el selector
      }
    } catch (err) {
      setError(err?.status === 404 ? t('reservar.codeNotFound') : err)
    } finally {
      setAgregando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div className="mt-4">
      {lista.length > 1 && (
        <>
          <p className="mb-1.5 text-xs font-medium text-navy-500">{t('clientDash.switchPro')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {lista.map((p) => (
              <button
                key={p.profesionalId}
                onClick={() => cambiar(p.profesionalId, p.actual)}
                disabled={cambiando}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                  p.actual
                    ? 'bg-navy-700 text-white shadow'
                    : 'bg-white text-navy-700 ring-1 ring-navy-200 hover:bg-navy-50'
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Agregar profesional — visible siempre (también con un solo profesional). */}
      <div className="mt-2">
        {!abierto ? (
          <button
            onClick={() => {
              setAbierto(true)
              setError(null)
              setAviso(null)
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy-300 px-4 py-2 text-sm font-semibold text-navy-600 transition hover:border-brand-400 hover:text-brand-600"
          >
            + {t('clientDash.addPro')}
          </button>
        ) : (
          <form onSubmit={agregar} className="max-w-md rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy-200">
            <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('clientDash.addProLabel')}</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder={t('reservar.codePlaceholder')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className={inputCls}
            />
            {error && <ErrorMessage error={error} className="mt-3" />}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={agregando}
                className="flex-1 rounded-xl bg-navy-700 py-2.5 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {agregando ? t('clientDash.addProChecking') : t('clientDash.addProConfirm')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbierto(false)
                  setError(null)
                  setCodigo('')
                }}
                className="rounded-xl border border-navy-200 px-4 py-2.5 font-medium text-navy-700 transition hover:bg-navy-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>

      {aviso && (
        <div
          className={`mt-2 max-w-md rounded-xl border px-4 py-2.5 text-sm ${
            aviso.tipo === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-navy-200 bg-navy-50 text-navy-700'
          }`}
        >
          {aviso.msg}
        </div>
      )}
    </div>
  )
}

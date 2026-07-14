import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { medicosApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

// Normaliza el código escrito a mano al mismo formato que el backend guarda como
// slug (minúsculas, sin acentos, guiones). Es idempotente sobre un slug ya válido,
// así que tolera que el cliente escriba "Nombre Profesional" o "nombre-profesional".
// También acepta que peguen el enlace completo (…/reservar/<slug>): en ese caso se
// queda solo con la parte del slug.
function normalizarCodigo(texto) {
  let s = String(texto || '').trim()
  // ¿Pegaron la URL completa del enlace? Quédate con lo que va después de
  // "/reservar/" y hasta la siguiente barra, query (?) o ancla (#).
  const marca = s.toLowerCase().indexOf('/reservar/')
  if (marca !== -1) {
    s = s.slice(marca + '/reservar/'.length).split(/[/?#]/)[0]
  }
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos/tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Salida para el cliente que llegó a /login-cliente o /registro-cliente sin el
// enlace de su profesional: en vez de un callejón sin salida, puede escribir el
// código de su profesional y continuar. Se valida que exista ANTES de redirigir.
export default function EntrarConCodigo() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [codigo, setCodigo] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [error, setError] = useState(null)

  async function continuar(e) {
    e.preventDefault()
    const slug = normalizarCodigo(codigo)
    if (!slug) {
      setError(t('reservar.codeEmpty'))
      return
    }
    setError(null)
    setVerificando(true)
    try {
      await medicosApi.porSlug(slug) // lanza 404 (SLUG_INVALIDO) si no existe
      navigate(`/reservar/${slug}`)
    } catch (err) {
      // 404 = código inexistente → mensaje claro sin salir de la pantalla.
      // Cualquier otro error (red/servidor) muestra su propio mensaje.
      setError(err?.status === 404 ? t('reservar.codeNotFound') : err)
    } finally {
      setVerificando(false)
    }
  }

  return (
    <form onSubmit={continuar} className="mt-6 text-left">
      <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('reservar.codeLabel')}</label>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder={t('reservar.codePlaceholder')}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none"
      />
      {error && <ErrorMessage error={error} className="mt-3" />}
      <button
        type="submit"
        disabled={verificando}
        className="mt-3 w-full rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
      >
        {verificando ? t('reservar.codeChecking') : t('reservar.codeContinue')}
      </button>
    </form>
  )
}

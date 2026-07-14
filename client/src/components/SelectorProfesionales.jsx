import { useEffect, useState } from 'react'
import { clientesApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

// Selector persistente de "mis profesionales" para el cliente que tiene cuentas
// con más de un profesional (mismo identificador). Si solo tiene uno, no muestra
// nada para no estorbar el caso normal.
export default function SelectorProfesionales() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const [lista, setLista] = useState([])
  const [cambiando, setCambiando] = useState(false)

  useEffect(() => {
    clientesApi
      .misProfesionales()
      .then((r) => setLista(r?.profesionales || []))
      .catch(() => {})
  }, [])

  if (lista.length <= 1) return null

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

  return (
    <div className="mt-4">
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
    </div>
  )
}

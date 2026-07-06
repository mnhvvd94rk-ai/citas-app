import { useEffect, useState } from 'react'
import { citasApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import CitaCard from '../../components/CitaCard.jsx'
import { formatFechaCorta } from '../../lib/format.js'

// Citas pendientes de aprobación.
export default function CitasPendientes() {
  const { t } = useLanguage()
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setCitas(await citasApi.agenda({ estado: 'PENDIENTE' }))
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function accion(fn, id) {
    setBusy(id)
    setError(null)
    try {
      await fn()
      await cargar()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('pending.title')}</h1>
      <p className="mt-1 text-sm text-navy-500">{t('pending.subtitle')}</p>

      {error && <ErrorMessage error={error} className="mt-4" />}

      <div className="mt-5">
        {cargando ? (
          <Spinner label={t('pending.loading')} />
        ) : citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-14 text-center text-navy-500">
            {t('pending.empty')}
          </div>
        ) : (
          <ul className="space-y-4">
            {citas.map((c) => (
              <li key={c.id}>
                <p className="mb-1 ml-1 text-xs font-semibold text-navy-400">{formatFechaCorta(c.fecha)}</p>
                <ul>
                  <CitaCard
                    cita={c}
                    busy={busy}
                    mostrarMotivo
                    onAprobar={(id) => accion(() => citasApi.aprobar(id), id)}
                    onAnular={(id, nota) => accion(() => citasApi.anular(id, nota), id)}
                    onCompletar={(id) => accion(() => citasApi.completar(id), id)}
                  />
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

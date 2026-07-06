import { useEffect, useState } from 'react'
import { citasApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import CitaCard from '../../components/CitaCard.jsx'
import { hoyISO, formatFechaLarga } from '../../lib/format.js'

// Agenda del día del profesional.
export default function Agenda() {
  const { t } = useLanguage()
  const [fecha, setFecha] = useState(hoyISO())
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  async function cargar(f) {
    setCargando(true)
    setError(null)
    try {
      setCitas(await citasApi.agenda({ fecha: f }))
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar(fecha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  async function accion(fn, id) {
    setBusy(id)
    setError(null)
    try {
      await fn()
      await cargar(fecha)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('agenda.title')}</h1>
      <div className="mt-3">
        <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('agenda.date')}</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full rounded-xl border border-navy-200 px-4 py-3 sm:w-auto focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none"
        />
        <p className="mt-2 text-sm capitalize text-navy-500">{formatFechaLarga(fecha)}</p>
      </div>

      {error && <ErrorMessage error={error} className="mt-4" />}

      <div className="mt-5">
        {cargando ? (
          <Spinner label={t('agenda.loading')} />
        ) : citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-14 text-center text-navy-500">
            {t('agenda.empty')}
          </div>
        ) : (
          <ul className="space-y-3">
            {citas.map((c) => (
              <CitaCard
                key={c.id}
                cita={c}
                busy={busy}
                mostrarMotivo
                onAprobar={(id) => accion(() => citasApi.aprobar(id), id)}
                onAnular={(id, nota) => accion(() => citasApi.anular(id, nota), id)}
                onCompletar={(id) => accion(() => citasApi.completar(id), id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

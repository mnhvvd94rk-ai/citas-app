import { useEffect, useState } from 'react'
import { citasApi } from '../../services/api.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import CitaCard from '../../components/CitaCard.jsx'
import { hoyISO, formatFechaLarga } from '../../lib/format.js'

// Agenda del día del gestor.
export default function Agenda() {
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
      <h1 className="text-xl font-bold text-slate-800">Agenda</h1>
      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 sm:w-auto focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
        />
        <p className="mt-2 text-sm capitalize text-slate-500">{formatFechaLarga(fecha)}</p>
      </div>

      {error && <ErrorMessage error={error} className="mt-4" />}

      <div className="mt-4">
        {cargando ? (
          <Spinner label="Cargando agenda…" />
        ) : citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-slate-500">
            No hay citas para este día.
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

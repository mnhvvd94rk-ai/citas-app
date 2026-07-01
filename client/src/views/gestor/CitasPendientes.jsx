import { useEffect, useState } from 'react'
import { citasApi } from '../../services/api.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import CitaCard from '../../components/CitaCard.jsx'
import { formatFechaCorta } from '../../lib/format.js'

// Citas pendientes de aprobación.
export default function CitasPendientes() {
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
      <h1 className="text-xl font-bold text-slate-800">Citas pendientes</h1>
      <p className="mt-1 text-sm text-slate-500">Aprueba o rechaza las solicitudes de pacientes.</p>

      {error && <ErrorMessage error={error} className="mt-4" />}

      <div className="mt-4">
        {cargando ? (
          <Spinner label="Cargando pendientes…" />
        ) : citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-slate-500">
            🎉 No hay citas pendientes.
          </div>
        ) : (
          <ul className="space-y-3">
            {citas.map((c) => (
              <li key={c.id}>
                <p className="mb-1 ml-1 text-xs font-medium text-slate-400">{formatFechaCorta(c.fecha)}</p>
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { citasApi } from '../../services/api.js'
import Navbar from '../../components/Navbar.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import EstadoBadge from '../../components/EstadoBadge.jsx'
import { formatFechaLarga } from '../../lib/format.js'

// Dashboard del paciente: lista de "Mis citas" + acceso a reservar.
export default function MisCitas() {
  const navigate = useNavigate()
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setCitas(await citasApi.misCitas())
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Mis citas</h1>
          <button
            onClick={() => navigate('/paciente/nueva-cita')}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            + Nueva cita
          </button>
        </div>

        {cargando ? (
          <Spinner label="Cargando tus citas…" />
        ) : error ? (
          <ErrorMessage error={error} onRetry={cargar} />
        ) : citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 text-slate-500">Todavía no tienes citas.</p>
            <button
              onClick={() => navigate('/paciente/nueva-cita')}
              className="mt-4 rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700"
            >
              Reservar mi primera cita
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {citas.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{formatFechaLarga(c.fecha)}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      🕒 {c.horaInicio} – {c.horaFin}
                    </p>
                    {c.medico && (
                      <p className="mt-1 text-sm text-slate-600">
                        👩‍⚕️ Dr(a). {c.medico.nombre}
                        {c.medico.especialidad ? ` · ${c.medico.especialidad}` : ''}
                      </p>
                    )}
                    {c.notaAnulacion && (
                      <p className="mt-1 text-sm text-red-600">Motivo anulación: {c.notaAnulacion}</p>
                    )}
                  </div>
                  <EstadoBadge estado={c.estado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

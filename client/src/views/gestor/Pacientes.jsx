import { useEffect, useState } from 'react'
import { pacientesApi } from '../../services/api.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { formatFechaCorta } from '../../lib/format.js'

// Lista de pacientes con panel de notas expandible.
export default function Pacientes() {
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setPacientes(await pacientesApi.listar())
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
    <div>
      <h1 className="text-xl font-bold text-slate-800">Pacientes</h1>
      <p className="mt-1 text-sm text-slate-500">Toca un paciente para ver y añadir notas.</p>

      {error && <ErrorMessage error={error} onRetry={cargar} className="mt-4" />}

      <div className="mt-4">
        {cargando ? (
          <Spinner label="Cargando pacientes…" />
        ) : pacientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-slate-500">
            No hay pacientes registrados.
          </div>
        ) : (
          <ul className="space-y-2">
            {pacientes.map((p) => (
              <PacienteItem
                key={p.id}
                paciente={p}
                abierto={abierto === p.id}
                onToggle={() => setAbierto(abierto === p.id ? null : p.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PacienteItem({ paciente, abierto, onToggle }) {
  const [notas, setNotas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargarNotas() {
    setCargando(true)
    setError(null)
    try {
      setNotas(await pacientesApi.notas(paciente.id))
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  // Carga perezosa de notas al abrir por primera vez.
  useEffect(() => {
    if (abierto && notas === null && !cargando) cargarNotas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  async function agregar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const nueva = await pacientesApi.agregarNota(paciente.id, texto.trim())
      setNotas((prev) => [nueva, ...(prev || [])])
      setTexto('')
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <li className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">
            {paciente.nombre} {paciente.apellido}
          </p>
          <p className="text-xs text-slate-500">
            {paciente.correo} · Doc: {paciente.documentoIdentidad}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              paciente.estado === 'NUEVO' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
            }`}
          >
            {paciente.estado === 'NUEVO' ? 'Nuevo' : 'Continuidad'}
          </span>
          <span className="text-slate-400">{abierto ? '▲' : '▼'}</span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          <form onSubmit={agregar} className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nueva nota</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Añade una observación al historial…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
            />
            <button
              type="submit"
              disabled={guardando || !texto.trim()}
              className="mt-2 rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
            >
              {guardando ? 'Guardando…' : 'Guardar nota'}
            </button>
          </form>

          {error && <ErrorMessage error={error} className="mb-3" />}

          {cargando ? (
            <Spinner label="Cargando notas…" />
          ) : notas && notas.length > 0 ? (
            <ul className="space-y-2">
              {notas.map((n) => (
                <li key={n.id} className="rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
                  <p className="text-slate-700">{n.texto}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatFechaCorta(n.fecha)}
                    {n.medico ? ` · Dr(a). ${n.medico.nombre}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-center text-sm text-slate-400">Sin notas todavía.</p>
          )}
        </div>
      )}
    </li>
  )
}

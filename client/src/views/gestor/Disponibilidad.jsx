import { useEffect, useState } from 'react'
import { disponibilidadApi } from '../../services/api.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { hoyISO, formatFechaCorta } from '../../lib/format.js'

// CRUD de disponibilidad horaria del médico.
export default function Disponibilidad() {
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({ fecha: hoyISO(), horaInicio: '09:00', horaFin: '13:00' })
  const [creando, setCreando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [busy, setBusy] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setLista(await disponibilidadApi.listar())
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function setCampo(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function crear(e) {
    e.preventDefault()
    setErrorForm(null)
    setCreando(true)
    try {
      await disponibilidadApi.crear(form)
      await cargar()
    } catch (err) {
      setErrorForm(err)
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(id) {
    setBusy(id)
    setError(null)
    try {
      await disponibilidadApi.eliminar(id)
      await cargar()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">Disponibilidad horaria</h1>
      <p className="mt-1 text-sm text-slate-500">
        Define rangos horarios. El sistema los divide en bloques de 45 minutos.
      </p>

      {/* Formulario de creación */}
      <form onSubmit={crear} className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
            <input
              type="date"
              name="fecha"
              value={form.fecha}
              min={hoyISO()}
              onChange={setCampo}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Hora inicio</label>
            <input
              type="time"
              name="horaInicio"
              value={form.horaInicio}
              onChange={setCampo}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Hora fin</label>
            <input
              type="time"
              name="horaFin"
              value={form.horaFin}
              onChange={setCampo}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
            />
          </div>
        </div>
        {errorForm && <ErrorMessage error={errorForm} className="mt-3" />}
        <button
          type="submit"
          disabled={creando}
          className="mt-3 w-full rounded-lg bg-teal-600 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300 sm:w-auto sm:px-6"
        >
          {creando ? 'Añadiendo…' : 'Añadir disponibilidad'}
        </button>
      </form>

      {/* Lista */}
      <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-700">Disponibilidades registradas</h2>
      {error && <ErrorMessage error={error} className="mb-3" />}
      {cargando ? (
        <Spinner label="Cargando…" />
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-500">
          No hay disponibilidades registradas.
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200"
            >
              <div>
                <p className="font-medium text-slate-800">{formatFechaCorta(d.fecha)}</p>
                <p className="text-sm text-slate-500">🕒 {d.horaInicio} – {d.horaFin}</p>
              </div>
              <button
                disabled={busy === d.id}
                onClick={() => eliminar(d.id)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {busy === d.id ? '…' : 'Eliminar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

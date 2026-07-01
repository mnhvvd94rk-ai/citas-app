import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { citasApi } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import Navbar from '../../components/Navbar.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { hoyISO, formatFechaLarga } from '../../lib/format.js'

const MEDICO_ID = 1 // por ahora solo hay un médico

const slotKey = (s) => `${s.horaInicio}-${s.horaFin}`
const consecutivos = (a, b) => a.horaFin === b.horaInicio || b.horaFin === a.horaInicio

export default function NuevaCita() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const esNuevo = user?.estado === 'NUEVO'

  const [fecha, setFecha] = useState(hoyISO())
  const [motivo, setMotivo] = useState('')
  const [slots, setSlots] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [errorSlots, setErrorSlots] = useState(null)

  const [reservando, setReservando] = useState(false)
  const [errorReserva, setErrorReserva] = useState(null)
  const [exito, setExito] = useState(null)

  async function cargarSlots(f) {
    setCargandoSlots(true)
    setErrorSlots(null)
    setSeleccion([])
    try {
      const res = await citasApi.slotsDisponibles(MEDICO_ID, f)
      setSlots(res.slots || [])
    } catch (err) {
      setErrorSlots(err)
      setSlots([])
    } finally {
      setCargandoSlots(false)
    }
  }

  useEffect(() => {
    cargarSlots(fecha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  const seleccionadas = new Set(seleccion.map(slotKey))
  // Candidatos consecutivos a resaltar (solo continuidad con 1 slot elegido).
  const candidatos = new Set()
  if (!esNuevo && seleccion.length === 1) {
    for (const s of slots) {
      if (!seleccionadas.has(slotKey(s)) && consecutivos(seleccion[0], s)) candidatos.add(slotKey(s))
    }
  }

  function toggleSlot(slot) {
    setErrorReserva(null)
    const key = slotKey(slot)
    if (esNuevo) {
      setSeleccion(seleccionadas.has(key) ? [] : [slot])
      return
    }
    // Continuidad: 1 o 2 consecutivos.
    if (seleccionadas.has(key)) {
      setSeleccion(seleccion.filter((s) => slotKey(s) !== key))
    } else if (seleccion.length === 0) {
      setSeleccion([slot])
    } else if (seleccion.length === 1 && consecutivos(seleccion[0], slot)) {
      const par = [seleccion[0], slot].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      setSeleccion(par)
    } else {
      setSeleccion([slot]) // reinicia la selección
    }
  }

  async function reservar() {
    setErrorReserva(null)
    if (seleccion.length === 0) {
      setErrorReserva('Selecciona al menos un horario.')
      return
    }
    if (esNuevo && !motivo.trim()) {
      setErrorReserva('Indica el motivo de consulta.')
      return
    }
    setReservando(true)
    try {
      const payload = {
        medicoId: MEDICO_ID,
        fecha,
        slotsElegidos: seleccion.map((s) => ({ horaInicio: s.horaInicio, horaFin: s.horaFin })),
      }
      if (esNuevo) payload.motivoConsulta = motivo.trim()
      const cita = await citasApi.reservar(payload)
      setExito(cita)
    } catch (err) {
      setErrorReserva(err)
    } finally {
      setReservando(false)
    }
  }

  if (exito) {
    const confirmada = exito.estado === 'CONFIRMADA'
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-10 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div className="text-5xl">{confirmada ? '✅' : '⏳'}</div>
            <h1 className="mt-4 text-xl font-bold text-slate-800">
              {confirmada ? 'Cita confirmada' : 'Solicitud enviada'}
            </h1>
            <p className="mt-2 text-slate-600">
              {confirmada
                ? 'Tu cita ha quedado confirmada.'
                : 'Tu cita queda pendiente de aprobación por el profesional.'}
            </p>
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>{formatFechaLarga(exito.fecha)}</p>
              <p className="mt-1 font-medium">🕒 {exito.horaInicio} – {exito.horaFin}</p>
            </div>
            <button
              onClick={() => navigate('/paciente/citas')}
              className="mt-6 w-full rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700"
            >
              Ver mis citas
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-5">
        <button onClick={() => navigate('/paciente/citas')} className="text-sm text-teal-700 hover:underline">
          ← Mis citas
        </button>
        <h1 className="mt-2 text-xl font-bold text-slate-800">Reservar nueva cita</h1>
        <p className="mt-1 text-sm text-slate-500">
          {esNuevo
            ? 'Como paciente nuevo, indica el motivo y elige 1 horario. Tu cita quedará pendiente de aprobación.'
            : 'Puedes reservar 1 o 2 horarios consecutivos (máx. 90 min).'}
        </p>

        {esNuevo && (
          <div className="mt-5">
            <label className="mb-1 block text-sm font-medium text-slate-700">Motivo de consulta</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Describe brevemente el motivo de tu consulta…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
          <input
            type="date"
            value={fecha}
            min={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Horarios disponibles</h2>
          {cargandoSlots ? (
            <Spinner label="Buscando horarios…" />
          ) : errorSlots ? (
            <ErrorMessage error={errorSlots} onRetry={() => cargarSlots(fecha)} />
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-slate-500">
              No hay horarios disponibles para esta fecha.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const key = slotKey(s)
                const activa = seleccionadas.has(key)
                const candidato = candidatos.has(key)
                return (
                  <button
                    key={key}
                    onClick={() => toggleSlot(s)}
                    className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                      activa
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : candidato
                          ? 'border-teal-400 bg-teal-50 text-teal-700 ring-2 ring-teal-200'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'
                    }`}
                  >
                    {s.horaInicio}
                  </button>
                )
              })}
            </div>
          )}
          {!esNuevo && seleccion.length === 1 && candidatos.size > 0 && (
            <p className="mt-2 text-xs text-teal-700">
              Los horarios resaltados son consecutivos: puedes añadir uno para una cita de 90 min.
            </p>
          )}
        </div>

        {errorReserva && <ErrorMessage error={errorReserva} className="mt-4" />}

        <div className="mt-6">
          {seleccion.length > 0 && (
            <p className="mb-2 text-sm text-slate-600">
              Seleccionado: <span className="font-semibold">{seleccion[0].horaInicio} – {seleccion[seleccion.length - 1].horaFin}</span>
              {seleccion.length === 2 ? ' (90 min)' : ' (45 min)'}
            </p>
          )}
          <button
            onClick={reservar}
            disabled={reservando || seleccion.length === 0}
            className="w-full rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
          >
            {reservando ? 'Reservando…' : 'Reservar'}
          </button>
        </div>
      </main>
    </div>
  )
}

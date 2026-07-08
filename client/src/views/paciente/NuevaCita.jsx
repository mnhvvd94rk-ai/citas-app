import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { citasApi, medicosApi } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Navbar from '../../components/Navbar.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { hoyISO, formatFechaLarga } from '../../lib/format.js'

const slotKey = (s) => `${s.horaInicio}-${s.horaFin}`

export default function NuevaCita() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useLanguage()
  const esNuevo = user?.estado === 'NUEVO'

  // Agenda personal: hay un único profesional. Se resuelve desde el backend.
  const [medico, setMedico] = useState(null)
  const [cargandoMedico, setCargandoMedico] = useState(true)
  const [errorMedico, setErrorMedico] = useState(null)

  const [fecha, setFecha] = useState(hoyISO())
  const [motivo, setMotivo] = useState('')
  const [slots, setSlots] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [doble, setDoble] = useState(false)
  const [tipoCita, setTipoCita] = useState('PRESENCIAL')
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [errorSlots, setErrorSlots] = useState(null)

  const [reservando, setReservando] = useState(false)
  const [errorReserva, setErrorReserva] = useState(null)
  const [exito, setExito] = useState(null)

  async function cargarMedico() {
    setCargandoMedico(true)
    setErrorMedico(null)
    try {
      setMedico(await medicosApi.primero())
    } catch (err) {
      setErrorMedico(err)
    } finally {
      setCargandoMedico(false)
    }
  }

  useEffect(() => {
    cargarMedico()
  }, [])

  async function cargarSlots(medicoId, f) {
    setCargandoSlots(true)
    setErrorSlots(null)
    setSeleccion([])
    try {
      const res = await citasApi.slotsDisponibles(medicoId, f)
      setSlots(res.slots || [])
    } catch (err) {
      setErrorSlots(err)
      setSlots([])
    } finally {
      setCargandoSlots(false)
    }
  }

  // Carga slots cuando ya se conoce el profesional y la fecha.
  useEffect(() => {
    if (medico?.id) cargarSlots(medico.id, fecha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medico, fecha])

  const seleccionadas = new Set(seleccion.map(slotKey))

  // Busca el bloque consecutivo inmediatamente posterior a `slot` entre los libres.
  function siguienteConsecutivo(slot) {
    return slots.find((s) => s.horaInicio === slot.horaFin) || null
  }

  function toggleSlot(slot) {
    setErrorReserva(null)
    const key = slotKey(slot)
    if (seleccionadas.has(key)) {
      setSeleccion([])
      return
    }
    // Cita doble (solo pacientes de continuidad): reserva el bloque + el siguiente.
    if (!esNuevo && doble) {
      const next = siguienteConsecutivo(slot)
      setSeleccion(next ? [slot, next] : [slot])
      return
    }
    setSeleccion([slot])
  }

  function toggleDoble(e) {
    const val = e.target.checked
    setDoble(val)
    setErrorReserva(null)
    if (val && seleccion.length === 1) {
      const next = siguienteConsecutivo(seleccion[0])
      setSeleccion(next ? [seleccion[0], next] : [seleccion[0]])
    } else if (!val && seleccion.length === 2) {
      setSeleccion([seleccion[0]])
    }
  }

  async function reservar() {
    setErrorReserva(null)
    if (!medico?.id) return
    if (seleccion.length === 0) return setErrorReserva(t('newAppt.errSelect'))
    if (esNuevo && !motivo.trim()) return setErrorReserva(t('newAppt.errDesc'))
    // Cita doble marcada: el segundo bloque consecutivo debe estar libre.
    if (!esNuevo && doble && seleccion.length !== 2) {
      return setErrorReserva(t('newAppt.doubleUnavailable'))
    }
    setReservando(true)
    try {
      const payload = {
        medicoId: medico.id,
        fecha,
        slotsElegidos: seleccion.map((s) => ({ horaInicio: s.horaInicio, horaFin: s.horaFin })),
      }
      if (esNuevo) payload.motivoConsulta = motivo.trim()
      payload.tipoCita = tipoCita
      setExito(await citasApi.reservar(payload))
    } catch (err) {
      setErrorReserva(err)
    } finally {
      setReservando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  if (exito) {
    const confirmada = exito.estado === 'CONFIRMADA'
    return (
      <div className="min-h-screen bg-navy-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-10 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${confirmada ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <span className="text-2xl font-bold">{confirmada ? '✓' : '⌛'}</span>
            </div>
            <h1 className="mt-4 text-xl font-bold text-navy-800">
              {confirmada ? t('newAppt.successConfirmedTitle') : t('newAppt.successPendingTitle')}
            </h1>
            <p className="mt-2 text-navy-500">
              {confirmada ? t('newAppt.successConfirmedMsg') : t('newAppt.successPendingMsg')}
            </p>
            <div className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-600">
              <p>{formatFechaLarga(exito.fecha)}</p>
              <p className="mt-1 font-semibold">{exito.horaInicio} – {exito.horaFin}</p>
            </div>
            <button
              onClick={() => navigate('/paciente/citas')}
              className="mt-6 w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white transition hover:bg-navy-800"
            >
              {t('newAppt.viewAppts')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <button onClick={() => navigate('/paciente/citas')} className="text-sm font-medium text-navy-500 hover:text-navy-700">
          ← {t('newAppt.backLink')}
        </button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-800">{t('newAppt.title')}</h1>
        {medico && (
          <p className="mt-1 text-sm font-medium text-navy-700">
            {medico.nombre}
            {medico.especialidad ? ` · ${medico.especialidad}` : ''}
          </p>
        )}
        <p className="mt-1 text-sm text-navy-500">
          {esNuevo ? t('newAppt.descNew') : t('newAppt.descReturning')}
        </p>

        {cargandoMedico ? (
          <Spinner />
        ) : errorMedico ? (
          <ErrorMessage
            error={errorMedico.status === 404 ? t('newAppt.noProfessional') : errorMedico}
            onRetry={cargarMedico}
            className="mt-4"
          />
        ) : (
          <>
            {esNuevo && (
              <div className="mt-5">
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('newAppt.descLabel')}</label>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder={t('newAppt.descPlaceholder')} className={inputCls} />
              </div>
            )}

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('newAppt.date')}</label>
              <input type="date" value={fecha} min={hoyISO()} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
            </div>

            {!esNuevo && (
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-navy-200 bg-white p-4">
                <input
                  type="checkbox"
                  checked={doble}
                  onChange={toggleDoble}
                  className="mt-0.5 h-5 w-5 rounded border-navy-300 text-navy-700 focus:ring-navy-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-navy-800">{t('newAppt.doubleLabel')}</span>
                  <span className="mt-0.5 block text-xs text-navy-500">{t('newAppt.doubleNote')}</span>
                </span>
              </label>
            )}

            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-navy-700">{t('newAppt.slots')}</h2>
              {cargandoSlots ? (
                <Spinner label={t('newAppt.searching')} />
              ) : errorSlots ? (
                <ErrorMessage error={errorSlots} onRetry={() => cargarSlots(medico.id, fecha)} />
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-navy-200 bg-white py-10 text-center text-navy-500">
                  {t('newAppt.noSlots')}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => {
                    const key = slotKey(s)
                    const activa = seleccionadas.has(key)
                    return (
                      <button
                        key={key}
                        onClick={() => toggleSlot(s)}
                        className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                          activa
                            ? 'border-navy-700 bg-navy-700 text-white'
                            : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400'
                        }`}
                      >
                        {s.horaInicio}
                      </button>
                    )
                  })}
                </div>
              )}
              {!esNuevo && doble && seleccion.length === 1 && (
                <p className="mt-2 text-xs text-amber-600">{t('newAppt.doubleUnavailable')}</p>
              )}
            </div>

            {/* Tipo de cita: presencial o videoconferencia */}
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-navy-700">{t('appt.appointmentType')}</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'PRESENCIAL', icon: '📍', label: t('appt.inPerson') },
                  { val: 'VIDEOCONFERENCIA', icon: '💻', label: t('appt.videoCall') },
                ].map((o) => (
                  <button
                    key={o.val}
                    type="button"
                    onClick={() => setTipoCita(o.val)}
                    aria-pressed={tipoCita === o.val}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      tipoCita === o.val
                        ? 'border-navy-700 bg-navy-700 text-white'
                        : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400'
                    }`}
                  >
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </div>

            {errorReserva && <ErrorMessage error={errorReserva} className="mt-4" />}

            <div className="mt-6">
              {seleccion.length > 0 && (
                <p className="mb-2 text-sm text-navy-600">
                  {t('newAppt.selected')}{' '}
                  <span className="font-semibold">{seleccion[0].horaInicio} – {seleccion[seleccion.length - 1].horaFin}</span>{' '}
                  {seleccion.length === 2 ? t('newAppt.min90') : t('newAppt.min45')}
                </p>
              )}
              <button
                onClick={reservar}
                disabled={reservando || seleccion.length === 0}
                className="w-full rounded-xl bg-navy-700 py-3.5 font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {reservando ? t('newAppt.reserving') : t('newAppt.reserve')}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

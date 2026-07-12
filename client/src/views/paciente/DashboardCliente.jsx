import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { citasApi, medicosApi, authApi } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Navbar from '../../components/Navbar.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import EstadoBadge from '../../components/EstadoBadge.jsx'
import JoinVideoButton from '../../components/JoinVideoButton.jsx'
import { hoyISO, soloFecha, formatFechaLarga, formatFechaCorta } from '../../lib/format.js'

const esActiva = (c) => ['PENDIENTE', 'CONFIRMADA'].includes(c.estado)

// Dashboard moderno del cliente autenticado.
export default function DashboardCliente() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const langRef = useRef(lang)
  const [langAviso, setLangAviso] = useState(null)
  const [citas, setCitas] = useState([])
  const [medico, setMedico] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [confirmando, setConfirmando] = useState(false) // modal de cancelación
  const [resultado, setResultado] = useState(null) // { costo } tras cancelar

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [cs, m] = await Promise.all([
        citasApi.misCitas(),
        medicosApi.miProfesional().catch(() => null),
      ])
      setCitas(cs)
      setMedico(m)
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  // Al cambiar el idioma en el navbar, el cliente guarda su preferencia para
  // que los recordatorios (email/WhatsApp) lleguen en ese idioma.
  useEffect(() => {
    if (langRef.current === lang) return // sin cambio (o montaje inicial)
    langRef.current = lang
    authApi
      .actualizarIdioma(lang.toUpperCase())
      .then(() => {
        setLangAviso(`${t('clientDash.languageUpdated')} · ${t('clientDash.notificationsNowIn')}`)
        setTimeout(() => setLangAviso(null), 4000)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const hoy = hoyISO()
  // Próxima cita = la más cercana futura y activa.
  const proxima = useMemo(() => {
    return [...citas]
      .filter((c) => soloFecha(c.fecha) >= hoy && esActiva(c))
      .sort((a, b) => (soloFecha(a.fecha) === soloFecha(b.fecha) ? a.horaInicio.localeCompare(b.horaInicio) : soloFecha(a.fecha) < soloFecha(b.fecha) ? -1 : 1))[0]
  }, [citas, hoy])

  // Info de penalización de una cita: fecha límite y coste si cancela ahora.
  function penalizacion(cita) {
    const dias = cita?.diasAnticipacionRequierida ?? 0
    const [y, m, d] = soloFecha(cita.fecha).split('-').map(Number)
    const citaMs = Date.UTC(y, m - 1, d)
    const [hy, hm, hd] = hoy.split('-').map(Number)
    const hoyMs = Date.UTC(hy, hm - 1, hd)
    const diffDias = Math.floor((citaMs - hoyMs) / 86400000)
    const conTiempo = diffDias >= dias
    const fechaLimite = formatFechaCorta(new Date(citaMs - dias * 86400000).toISOString())
    return {
      dias,
      conTiempo,
      fechaLimite,
      costoAhora: conTiempo ? 0 : cita.costoCancelacion || 0,
    }
  }

  async function doCancelar(id) {
    setBusy(true)
    setError(null)
    try {
      const res = await citasApi.cancelarCliente(id)
      setConfirmando(false)
      setResultado({ costo: res.costo ?? 0 })
      await cargar()
    } catch (err) {
      setError(err)
      setConfirmando(false)
    } finally {
      setBusy(false)
    }
  }

  async function recordar(id) {
    setBusy(true)
    setError(null)
    try {
      await citasApi.recordar(id)
      setAviso(t('clientDash.reminderSent'))
      setTimeout(() => setAviso(null), 4000)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  // Color de acento de una cita según categoría.
  function acento(c) {
    if (c.estado === 'ANULADA') return 'border-l-red-400'
    if (soloFecha(c.fecha) >= hoy && esActiva(c)) return 'border-l-blue-500'
    return 'border-l-slate-300'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-800">
          {t('clientDash.welcome')}, {user?.nombre}
        </h1>

        {aviso && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {aviso}
          </div>
        )}
        {langAviso && (
          <div className="mt-4 rounded-xl border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-700">
            {langAviso}
          </div>
        )}
        {resultado && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${resultado.costo > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {t('clientDash.cancelledOk')}
            {resultado.costo > 0 && <> — {t('clientDash.penaltyWillApply', { cost: resultado.costo })}</>}
          </div>
        )}
        {error && <ErrorMessage error={error} className="mt-4" />}

        {cargando ? (
          <Spinner label={t('dashboard.loading')} />
        ) : (
          <>
            {/* Card prominente: próxima cita */}
            <section className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-navy-700 to-navy-800 p-6 text-white shadow-lg shadow-navy-900/20">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-400">{t('clientDash.yourNextAppt')}</p>
              {proxima ? (
                (() => {
                  const pen = penalizacion(proxima)
                  return (
                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-2xl font-bold">{formatFechaLarga(proxima.fecha)}</p>
                        <p className="mt-1 text-lg text-white/90">{proxima.horaInicio} – {proxima.horaFin}</p>
                        {proxima.medico && <p className="mt-1 text-sm text-white/70">{proxima.medico.nombre}{proxima.medico.especialidad ? ` · ${proxima.medico.especialidad}` : ''}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <EstadoBadge estado={proxima.estado} />
                          {proxima.esDoble && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">{t('clientDash.doubleSlot')}</span>}
                          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                            {proxima.tipoCita === 'VIDEOCONFERENCIA' ? `💻 ${t('appt.videoCall')}` : `📍 ${t('appt.inPerson')}`}
                          </span>
                        </div>
                        {proxima.tipoCita === 'VIDEOCONFERENCIA' && (
                          <div className="mt-3">
                            <JoinVideoButton cita={proxima} onDark />
                          </div>
                        )}
                        {/* Aviso de cancelación */}
                        <p className="mt-3 text-sm text-white/70">
                          {t('clientDash.cancelBefore', { date: pen.fechaLimite })}
                        </p>
                        {!pen.conTiempo && pen.costoAhora > 0 && (
                          <p className="mt-1 text-sm font-semibold text-red-300">
                            ⚠️ {t('clientDash.cancellationCost', { cost: pen.costoAhora })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => recordar(proxima.id)} disabled={busy} className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-50">
                          {t('clientDash.notify')}
                        </button>
                        <button onClick={() => setConfirmando(true)} disabled={busy} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                          {t('clientDash.cancel')}
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-lg text-white/80">{t('clientDash.noUpcoming')}</p>
                  <button onClick={() => navigate('/paciente/nueva-cita')} className="w-fit rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-navy-800 transition hover:bg-navy-50">
                    {t('dashboard.newAppt')}
                  </button>
                </div>
              )}
            </section>

            {/* Grid de 3 secciones */}
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* 1. Mis citas */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-1">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-navy-800">{t('clientDash.myAppts')}</h2>
                  <button onClick={() => navigate('/paciente/nueva-cita')} className="rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-800">
                    {t('dashboard.newAppt')}
                  </button>
                </div>
                {citas.length === 0 ? (
                  <p className="py-6 text-center text-sm text-navy-400">{t('dashboard.empty')}</p>
                ) : (
                  <ul className="space-y-2">
                    {citas.map((c) => (
                      <li key={c.id} className={`rounded-xl border border-slate-100 border-l-4 bg-white p-3 ${acento(c)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy-800">{formatFechaCorta(c.fecha)}</p>
                            <p className="text-xs text-navy-500">{c.horaInicio} – {c.horaFin}</p>
                          </div>
                          <EstadoBadge estado={c.estado} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 2. Información del profesional */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-3 font-bold text-navy-800">{t('clientDash.professionalInfo')}</h2>
                {medico ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy-700 text-2xl font-bold text-brand-400">
                      {(medico.nombre?.[0] || '·').toUpperCase()}
                    </div>
                    <p className="mt-3 font-semibold text-navy-800">{medico.nombre}</p>
                    {medico.especialidad && <p className="text-sm text-navy-500">{medico.especialidad}</p>}
                    {medico.correo && (
                      <a href={`mailto:${medico.correo}`} className="mt-2 break-all text-sm text-navy-600 hover:text-brand-600">
                        {medico.correo}
                      </a>
                    )}
                    {medico.telefono && (
                      <a href={`tel:${medico.telefono}`} className="mt-1 text-sm text-navy-600 hover:text-brand-600">
                        {medico.telefono}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-navy-400">—</p>
                )}
              </section>

              {/* 3. Anuncios */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-3 font-bold text-navy-800">{t('clientDash.announcements')}</h2>
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-navy-400">
                  {t('clientDash.noAnnouncements')}
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {/* Modal de confirmación de cancelación */}
      {confirmando && proxima && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-0 sm:items-center sm:p-4" onClick={() => setConfirmando(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 text-center sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-navy-800">{t('clientDash.areYouSure')}</h3>
            {(() => {
              const costo = penalizacion(proxima).costoAhora
              return (
                <p className={`mt-2 text-sm ${costo > 0 ? 'font-semibold text-red-600' : 'text-navy-500'}`}>
                  {costo > 0 ? t('clientDash.cancellationCost', { cost: costo }) : t('clientDash.freeCancellation')}
                </p>
              )
            })()}
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={() => doCancelar(proxima.id)} disabled={busy} className="rounded-xl bg-red-500 py-3 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                {t('clientDash.confirmCancel')}
              </button>
              <button onClick={() => setConfirmando(false)} disabled={busy} className="rounded-xl border border-navy-200 py-3 font-medium text-navy-700 transition hover:bg-navy-50">
                {t('clientDash.noBack')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

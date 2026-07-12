import { useEffect, useMemo, useState } from 'react'
import { citasApi, disponibilidadApi, medicosApi } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import EstadoBadge from '../../components/EstadoBadge.jsx'
import JoinVideoButton from '../../components/JoinVideoButton.jsx'
import { hoyISO, soloFecha } from '../../lib/format.js'

// Dominio público donde vive el enlace de registro que el profesional comparte.
const PUBLIC_ORIGIN = 'https://kohtun.com'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

// Color del "pill" de cita según estado (azul=confirmada, amarillo=pendiente).
function pillCls(estado) {
  switch (estado) {
    case 'CONFIRMADA': return 'bg-blue-100 text-blue-700'
    case 'PENDIENTE': return 'bg-amber-100 text-amber-700'
    case 'COMPLETADA': return 'bg-slate-100 text-slate-500'
    case 'ANULADA': return 'bg-red-100 text-red-500 line-through'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export default function Agenda() {
  const { t, lang } = useLanguage()
  const hoy = hoyISO()
  const [cursor, setCursor] = useState(() => {
    const [y, m] = hoy.split('-').map(Number)
    return { y, m: m - 1 } // m 0-indexed
  })
  const [selectedDay, setSelectedDay] = useState(hoy)
  const [citas, setCitas] = useState([])
  const [dispDias, setDispDias] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)

  const meses = t('calendar.months')
  const semana = t('calendar.weekdays')

  const monthStart = ymd(cursor.y, cursor.m, 1)
  const monthEnd = ymd(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate())

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [cs, disp] = await Promise.all([
        citasApi.agenda({ desde: monthStart, hasta: monthEnd }),
        disponibilidadApi.listar({ desde: monthStart, hasta: monthEnd }),
      ])
      setCitas(cs)
      setDispDias(new Set(disp.map((d) => soloFecha(d.fecha))))
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor])

  // Agrupa citas por día (YYYY-MM-DD).
  const porDia = useMemo(() => {
    const map = {}
    for (const c of citas) {
      const k = soloFecha(c.fecha)
      ;(map[k] ||= []).push(c)
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    return map
  }, [citas])

  const citasDelDia = porDia[selectedDay] || []

  // Construye las celdas del mes (offset lunes-primero).
  const celdas = useMemo(() => {
    const diasMes = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const primerDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7 // 0=Lun
    const arr = Array(primerDow).fill(null)
    for (let d = 1; d <= diasMes; d++) arr.push(d)
    return arr
  }, [cursor])

  function cambiarMes(delta) {
    setCursor((c) => {
      const nm = c.m + delta
      const y = c.y + Math.floor(nm / 12)
      const m = ((nm % 12) + 12) % 12
      return { y, m }
    })
  }

  function formatDayLong(iso) {
    const [y, m, d] = iso.split('-').map(Number)
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
    return `${semana[dow]} ${d} ${meses[m - 1]} ${y}`
  }

  async function accion(fn) {
    try {
      await fn()
      setDetalle(null)
      await cargar()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-navy-800">{t('agenda.title')}</h1>

      <EnlaceReserva />

      {error && <ErrorMessage error={error} onRetry={cargar} className="mb-4" />}

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Calendario */}
        <div className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => cambiarMes(-1)} className="rounded-lg px-3 py-1.5 text-navy-500 hover:bg-navy-50" aria-label="prev">‹</button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-navy-800">{meses[cursor.m]} {cursor.y}</h2>
              <button onClick={() => { const [y, m] = hoy.split('-').map(Number); setCursor({ y, m: m - 1 }); setSelectedDay(hoy) }} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-navy-500 hover:bg-navy-50">
                {t('calendar.today')}
              </button>
            </div>
            <button onClick={() => cambiarMes(1)} className="rounded-lg px-3 py-1.5 text-navy-500 hover:bg-navy-50" aria-label="next">›</button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-navy-400">
            {semana.map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>

          {cargando ? (
            <Spinner label={t('agenda.loading')} />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {celdas.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />
                const iso = ymd(cursor.y, cursor.m, d)
                const lista = porDia[iso] || []
                const esHoy = iso === hoy
                const sel = iso === selectedDay
                const tieneDisp = dispDias.has(iso)
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDay(iso)}
                    className={`flex min-h-[68px] flex-col rounded-lg border p-1 text-left transition ${
                      sel ? 'border-navy-500 ring-2 ring-navy-200' : 'border-slate-100 hover:border-navy-300'
                    } ${tieneDisp ? 'bg-indigo-100' : 'bg-white'}`}
                  >
                    <span className={`mb-0.5 text-xs font-semibold ${esHoy ? 'flex h-5 w-5 items-center justify-center rounded-full bg-navy-700 text-white' : 'text-navy-600'}`}>
                      {d}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      {lista.slice(0, 2).map((c) => (
                        <span key={c.id} className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${pillCls(c.estado)}`}>
                          {c.horaInicio}
                        </span>
                      ))}
                      {lista.length > 2 && <span className="px-1 text-[10px] text-navy-400">+{lista.length - 2}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />{t('calendar.legendConfirmed')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{t('calendar.legendPending')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-100 ring-1 ring-indigo-300" />{t('calendar.legendAvailable')}</span>
          </div>
        </div>

        {/* Panel de citas del día */}
        <div className="w-full shrink-0 lg:w-80">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h3 className="mb-3 text-sm font-semibold text-navy-800">{formatDayLong(selectedDay)}</h3>
            {citasDelDia.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy-400">{t('calendar.noApptsDay')}</p>
            ) : (
              <ul className="space-y-2">
                {citasDelDia.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setDetalle(c)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-navy-300 hover:bg-navy-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-800">{c.horaInicio} – {c.horaFin}</p>
                        {c.paciente && <p className="truncate text-xs text-navy-500">{c.paciente.nombre} {c.paciente.apellido}</p>}
                      </div>
                      <EstadoBadge estado={c.estado} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {detalle && (
        <CitaModal
          cita={detalle}
          onClose={() => setDetalle(null)}
          onAprobar={() => accion(() => citasApi.aprobar(detalle.id))}
          onCompletar={() => accion(() => citasApi.completar(detalle.id))}
          onAnular={(nota) => accion(() => citasApi.anular(detalle.id, nota))}
          formatDay={formatDayLong}
        />
      )}
    </div>
  )
}

// ── Bloque del enlace propio de registro de clientes ─────────────────────────
// Muestra https://kohtun.com/reservar/<slug> con botón para copiarlo y una
// edición única del slug (validada en el backend).
function EnlaceReserva() {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()
  const [copiado, setCopiado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const slug = user?.slug
  if (!slug) return null // profesionales previos sin slug: nada que mostrar

  const enlace = `${PUBLIC_ORIGIN}/reservar/${slug}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError({ message: t('shareLink.copyError') })
    }
  }

  function abrirEdicion() {
    setValor(slug)
    setError(null)
    setEditando(true)
  }

  async function guardar() {
    setError(null)
    setGuardando(true)
    try {
      await medicosApi.editarSlug(valor.trim())
      await refreshUser()
      setEditando(false)
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-lg">🔗</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-navy-800">{t('shareLink.title')}</h2>
          <p className="mt-0.5 text-xs text-navy-500">{t('shareLink.desc')}</p>

          {!editando ? (
            <>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-700">
                  {enlace}
                </code>
                <button
                  onClick={copiar}
                  className="shrink-0 rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
                >
                  {copiado ? t('shareLink.copied') : t('shareLink.copy')}
                </button>
              </div>
              {!user?.slugEditado && (
                <button
                  onClick={abrirEdicion}
                  className="mt-2 text-xs font-medium text-brand-600 hover:underline"
                >
                  {t('shareLink.edit')}
                </button>
              )}
            </>
          ) : (
            <div className="mt-3">
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t('shareLink.editOnceWarning')}
              </p>
              <div className="flex items-stretch gap-2">
                <span className="flex items-center rounded-lg bg-navy-50 px-2 text-xs text-navy-400">
                  {PUBLIC_ORIGIN}/reservar/
                </span>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={t('shareLink.placeholder')}
                  className="min-w-0 flex-1 rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:border-navy-500 focus:ring-2 focus:ring-navy-100 focus:outline-none"
                />
              </div>
              {error && <ErrorMessage error={error} className="mt-2" />}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={guardar}
                  disabled={guardando || !valor.trim()}
                  className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
                >
                  {guardando ? t('shareLink.saving') : t('shareLink.save')}
                </button>
                <button
                  onClick={() => { setEditando(false); setError(null) }}
                  className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal de detalle de cita ─────────────────────────────────────────────────
function CitaModal({ cita, onClose, onAprobar, onCompletar, onAnular, formatDay }) {
  const { t } = useLanguage()
  const [anulando, setAnulando] = useState(false)
  const [nota, setNota] = useState('')
  const p = cita.paciente
  const esPendiente = cita.estado === 'PENDIENTE'
  const esConfirmada = cita.estado === 'CONFIRMADA'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-navy-800">{cita.horaInicio} – {cita.horaFin}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-navy-400 hover:bg-navy-50" aria-label={t('agenda.close')}>✕</button>
        </div>

        <div className="space-y-2 text-sm">
          <Row label={t('agenda.date')} value={formatDay(soloFecha(cita.fecha))} />
          {p && <Row label={t('agenda.client')} value={`${p.nombre} ${p.apellido}`} />}
          {p?.estado && <Row label={t('agenda.type')} value={p.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')} />}
          <div className="flex items-center justify-between">
            <span className="text-navy-400">{t('estado.' + cita.estado)}</span>
            <EstadoBadge estado={cita.estado} />
          </div>
          {cita.motivoConsulta && (
            <div className="rounded-xl bg-navy-50 px-3 py-2 text-navy-600">
              <span className="font-medium text-navy-500">{t('citaCard.description')}:</span> {cita.motivoConsulta}
            </div>
          )}
          <Row
            label={t('appt.appointmentType')}
            value={cita.tipoCita === 'VIDEOCONFERENCIA' ? `💻 ${t('appt.videoCall')}` : `📍 ${t('appt.inPerson')}`}
          />
          {cita.notaAnulacion && <p className="text-red-600">{t('citaCard.cancelled')}: {cita.notaAnulacion}</p>}
        </div>

        {cita.tipoCita === 'VIDEOCONFERENCIA' && (
          <div className="mt-4">
            <JoinVideoButton cita={cita} className="w-full" />
          </div>
        )}

        {(esPendiente || esConfirmada) && !anulando && (
          <div className="mt-5 flex flex-wrap gap-2">
            {esPendiente && (
              <button onClick={onAprobar} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                {t('citaCard.approve')}
              </button>
            )}
            {esConfirmada && (
              <button onClick={onCompletar} className="flex-1 rounded-xl bg-navy-700 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800">
                {t('citaCard.complete')}
              </button>
            )}
            <button onClick={() => setAnulando(true)} className="flex-1 rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
              {t('citaCard.cancel')}
            </button>
          </div>
        )}

        {anulando && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3">
            <label className="mb-1 block text-sm font-medium text-red-700">{t('citaCard.cancelReasonLabel')}</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder={t('citaCard.cancelReasonPlaceholder')} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none" />
            <div className="mt-2 flex gap-2">
              <button disabled={!nota.trim()} onClick={() => onAnular(nota.trim())} className="rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                {t('citaCard.confirmCancel')}
              </button>
              <button onClick={() => { setAnulando(false); setNota('') }} className="rounded-lg border border-navy-200 px-3.5 py-1.5 text-sm font-medium text-navy-600 hover:bg-white">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-400">{label}</span>
      <span className="font-medium text-navy-800">{value}</span>
    </div>
  )
}

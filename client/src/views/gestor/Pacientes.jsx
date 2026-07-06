import { useEffect, useState } from 'react'
import { pacientesApi, citasApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import EstadoBadge from '../../components/EstadoBadge.jsx'
import { formatFechaCorta } from '../../lib/format.js'

// ── Avatar de documento (o placeholder de iniciales) ─────────────────────────
function Foto({ cliente, className }) {
  const iniciales = `${cliente.nombre?.[0] || ''}${cliente.apellido?.[0] || ''}`.toUpperCase()
  if (cliente.fotoIdentidadUrl) {
    return <img src={cliente.fotoIdentidadUrl} alt="" className={`object-cover ${className}`} />
  }
  return (
    <div className={`flex items-center justify-center bg-navy-700 font-bold text-gold-400 ${className}`}>
      {iniciales || '·'}
    </div>
  )
}

// ── Vista principal: lista escalonada de clientes ────────────────────────────
export default function Pacientes() {
  const { t } = useLanguage()
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setClientes(await pacientesApi.listar())
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
      <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('clients.title')}</h1>
      <p className="mt-1 text-sm text-navy-500">{t('clients.subtitle')}</p>

      {error && <ErrorMessage error={error} onRetry={cargar} className="mt-4" />}

      <div className="mt-5">
        {cargando ? (
          <Spinner label={t('clients.loading')} />
        ) : clientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-14 text-center text-navy-500">
            {t('clients.empty')}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {clientes.map((c, i) => (
              <ClienteRow key={c.id} cliente={c} index={i} onExpandir={() => setDetalle(c)} />
            ))}
          </ul>
        )}
      </div>

      {detalle && <ClienteModal cliente={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}

// ── Tarjeta rectangular (colapsada), con indentación escalonada ──────────────
function ClienteRow({ cliente, index, onExpandir }) {
  const { t } = useLanguage()
  const indent = Math.min(index, 6) * 18 // margen izquierdo escalonado (cap)

  return (
    <li style={{ marginLeft: `${indent}px` }} className="w-[92%] max-w-2xl">
      <button
        onClick={onExpandir}
        className="flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-navy-100 transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <Foto cliente={cliente} className="h-[120px] w-[80px] shrink-0" />
        <div className="min-w-0 flex-1 py-3">
          <p className="truncate font-semibold text-navy-800">{cliente.nombre} {cliente.apellido}</p>
          <p className="truncate text-sm text-navy-500">
            {cliente.correo}{cliente.telefono ? ` · ${cliente.telefono}` : ''}
          </p>
          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cliente.estado === 'NUEVO' ? 'bg-gold-100 text-gold-600' : 'bg-navy-100 text-navy-700'}`}>
            {cliente.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')}
          </span>
        </div>
        <span className="shrink-0 pr-4 text-lg text-navy-300">›</span>
      </button>
    </li>
  )
}

// ── Modal expandido: ficha completa + historial ──────────────────────────────
function ClienteModal({ cliente, onClose }) {
  const { t } = useLanguage()
  const [citaNotas, setCitaNotas] = useState(null) // cita cuyo modal de notas está abierto

  const edad = cliente.edad != null ? cliente.edad : t('clients.ageUnknown')
  const desde = cliente.primeraCita ? formatFechaCorta(cliente.primeraCita) : t('clients.noAppts')
  const historial = cliente.historial || []

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="relative shrink-0">
          <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-lg bg-white/80 p-1 text-navy-500 hover:bg-white" aria-label={t('agenda.close')}>✕</button>
          <div className="flex items-center gap-4 border-b border-navy-100 p-5">
            <Foto cliente={cliente} className="h-24 w-20 shrink-0 rounded-xl ring-1 ring-navy-100" />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-navy-800">{cliente.nombre} {cliente.apellido}</h3>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cliente.estado === 'NUEVO' ? 'bg-gold-100 text-gold-600' : 'bg-navy-100 text-navy-700'}`}>
                {cliente.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')}
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Dato label={t('clients.document')} valor={cliente.documentoIdentidad} />
            <Dato label={t('clients.age')} valor={edad} />
            <Dato label={t('common.email')} valor={cliente.correo} className="col-span-2" />
            {cliente.telefono && <Dato label={t('clients.phone')} valor={cliente.telefono} />}
          </dl>

          {/* Estadísticas */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-navy-50 p-3">
              <p className="text-xs text-navy-400">{t('clients.firstAppt')}</p>
              <p className="mt-0.5 font-semibold text-navy-800">{t('clients.since')}: {desde}</p>
            </div>
            <div className="rounded-xl bg-navy-50 p-3">
              <p className="text-xs text-navy-400">{t('clients.totalAppts')}</p>
              <p className="mt-0.5 font-semibold text-navy-800">{cliente.totalCitas ?? 0}</p>
            </div>
          </div>

          {/* Historial de citas */}
          <h4 className="mt-5 mb-2 text-sm font-semibold text-navy-700">{t('clients.apptHistory')}</h4>
          {historial.length === 0 ? (
            <p className="py-3 text-center text-sm text-navy-400">{t('clients.noAppts')}</p>
          ) : (
            <ul className="space-y-2">
              {historial.map((c) => (
                <li key={c.id} className="rounded-xl border border-navy-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-800">{formatFechaCorta(c.fecha)}</p>
                      <p className="text-xs text-navy-500">{c.horaInicio} – {c.horaFin}</p>
                    </div>
                    <EstadoBadge estado={c.estado} />
                  </div>
                  <button
                    onClick={() => setCitaNotas(c)}
                    className="mt-2 text-xs font-semibold text-navy-600 hover:text-gold-600"
                  >
                    {t('clients.notesForAppt')} →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {citaNotas && <CitaNotasModal cita={citaNotas} onClose={() => setCitaNotas(null)} />}
    </div>
  )
}

function Dato({ label, valor, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd className="truncate font-medium text-navy-700">{valor}</dd>
    </div>
  )
}

// ── Modal de notas específicas de una cita ───────────────────────────────────
function CitaNotasModal({ cita, onClose }) {
  const { t } = useLanguage()
  const [notas, setNotas] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setNotas(await citasApi.notasDeCita(cita.id))
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function agregar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const nueva = await pacientesApi.agregarNotaCita(cita.id, texto.trim())
      setNotas((prev) => [nueva, ...(prev || [])])
      setTexto('')
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-navy-800">{t('clients.notesForAppt')}</h3>
            <p className="text-xs text-navy-400">{formatFechaCorta(cita.fecha)} · {cita.horaInicio}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-navy-400 hover:bg-navy-50" aria-label={t('agenda.close')}>✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <form onSubmit={agregar} className="mb-4">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder={t('clients.notePlaceholder')}
              className="w-full rounded-xl border border-navy-200 px-3 py-2 text-sm focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none"
            />
            <button
              type="submit"
              disabled={guardando || !texto.trim()}
              className="mt-2 rounded-lg bg-navy-700 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
            >
              {guardando ? t('clients.savingNote') : t('clients.saveNote')}
            </button>
          </form>

          {error && <ErrorMessage error={error} className="mb-3" />}

          {cargando ? (
            <Spinner label={t('clients.loading')} />
          ) : notas && notas.length > 0 ? (
            <ul className="space-y-2">
              {notas.map((n) => (
                <li key={n.id} className="rounded-xl bg-navy-50 p-3 text-sm ring-1 ring-navy-100">
                  <p className="text-navy-700">{n.texto}</p>
                  <p className="mt-1 text-xs text-navy-400">
                    {formatFechaCorta(n.fecha)}{n.medico ? ` · ${n.medico.nombre}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-center text-sm text-navy-400">{t('clients.noNotes')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

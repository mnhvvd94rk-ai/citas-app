import { useEffect, useState } from 'react'
import { pacientesApi } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import ImportarClientesModal from '../../components/ImportarClientesModal.jsx'
import { formatFechaCorta, formatFechaHora, soloFecha, hoyISO } from '../../lib/format.js'

/** Nombre de archivo seguro: sin acentos, minúsculas, con guiones. */
function slugArchivo(texto) {
  return String(texto || 'cliente')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cliente'
}

/** Construye el contenido .txt del historial del cliente. */
function construirHistorialTxt({ cliente, notas, profesionalNombre }) {
  const nombre = `${cliente.nombre} ${cliente.apellido || ''}`.trim()
  const notasOrden = [...(notas || [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  const lineasNotas = notasOrden.length
    ? notasOrden.map((n) => `[${formatFechaHora(n.fecha)}] ${n.texto}`).join('\n')
    : 'Sin notas registradas.'

  return [
    'HISTORIAL DEL CLIENTE',
    '=====================',
    '',
    `Nombre: ${nombre}`,
    `Teléfono: ${cliente.telefono || '—'}`,
    `Correo: ${cliente.correo || '—'}`,
    `Fecha de registro: ${cliente.fechaRegistro ? formatFechaCorta(cliente.fechaRegistro) : '—'}`,
    '',
    `Citas completadas: ${cliente.totalCitasCompletadas ?? 0}`,
    `Citas anuladas: ${cliente.totalCitasAnuladas ?? 0}`,
    '',
    'NOTAS / COMENTARIOS',
    '-------------------',
    lineasNotas,
    '',
    '---',
    `Generado por: ${profesionalNombre || '—'}`,
    `Fecha de generación: ${formatFechaCorta(new Date().toISOString())}`,
    '',
  ].join('\n')
}

/** Descarga un texto como archivo en el navegador del profesional. */
function descargarTxt(nombreArchivo, contenido) {
  const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const ESTADOS_TRAT = ['ACTIVO', 'COMPLETADO', 'EN_PAUSA']

// Clave de traducción de la etiqueta de cada estado de tratamiento.
const TRAT_KEY = { ACTIVO: 'stActive', COMPLETADO: 'stCompleted', EN_PAUSA: 'stOnHold' }

// Estilos de los botones de estado de tratamiento (colores dinámicos).
const TRAT_STYLE = {
  ACTIVO: { on: 'bg-emerald-500 text-white border-emerald-500', off: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50', dot: 'bg-emerald-500' },
  COMPLETADO: { on: 'bg-gray-400 text-white border-gray-400', off: 'border-gray-300 text-gray-600 hover:bg-gray-50', dot: 'bg-gray-400' },
  EN_PAUSA: { on: 'bg-amber-400 text-white border-amber-400', off: 'border-amber-300 text-amber-700 hover:bg-amber-50', dot: 'bg-amber-400' },
}

// Color del punto de una cita según estado.
function dotEstado(estado) {
  switch (estado) {
    case 'COMPLETADA': return 'bg-emerald-500'
    case 'ANULADA': return 'bg-red-500'
    case 'CONFIRMADA': return 'bg-blue-500'
    case 'PENDIENTE': return 'bg-amber-400'
    default: return 'bg-slate-300'
  }
}

function Foto({ cliente, className }) {
  const ini = `${cliente.nombre?.[0] || ''}${cliente.apellido?.[0] || ''}`.toUpperCase()
  if (cliente.fotoIdentidadUrl) return <img src={cliente.fotoIdentidadUrl} alt="" className={`object-cover ${className}`} />
  return <div className={`flex items-center justify-center bg-navy-700 font-bold text-brand-400 ${className}`}>{ini || '·'}</div>
}

export default function Pacientes() {
  const { t } = useLanguage()
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [importar, setImportar] = useState(false)
  const [aviso, setAviso] = useState(null)

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

  async function handleEliminado(nombre) {
    setAviso(t('clients.clientDeleted', { name: nombre }))
    setTimeout(() => setAviso(null), 4000)
    await cargar()
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('clients.title')}</h1>
          <p className="mt-1 text-sm text-navy-500">{t('clients.subtitle')}</p>
        </div>
        <button
          onClick={() => setImportar(true)}
          className="shrink-0 rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
        >
          {t('clients.import.title')}
        </button>
      </div>

      {importar && (
        <ImportarClientesModal onClose={() => setImportar(false)} onImported={cargar} />
      )}

      {aviso && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {aviso}
        </div>
      )}

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
            {clientes.map((c) => <ClienteCard key={c.id} cliente={c} onEliminado={handleEliminado} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

function ClienteCard({ cliente, onEliminado }) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errorDel, setErrorDel] = useState(null)
  const [descargando, setDescargando] = useState(false)
  const [histAviso, setHistAviso] = useState(false)

  // Estado editable local (se sincroniza con el backend vía PATCH).
  const [edad, setEdad] = useState(cliente.edad)
  const [estadoTrat, setEstadoTrat] = useState(cliente.estadoTratamiento || 'ACTIVO')
  const [finalizadoEn, setFinalizadoEn] = useState(cliente.tratamientoFinalizadoEn)
  const [guardandoTrat, setGuardandoTrat] = useState(false)
  const [editandoEdad, setEditandoEdad] = useState(false)
  const [inputEdad, setInputEdad] = useState(cliente.edad ?? '')
  const [idiomaCli, setIdiomaCli] = useState(cliente.idiomaPreferido || 'ES')
  const [guardandoIdioma, setGuardandoIdioma] = useState(false)

  const historial = cliente.historial || []
  const hoy = hoyISO()
  const restantes = historial.filter(
    (c) => soloFecha(c.fecha) >= hoy && ['PENDIENTE', 'CONFIRMADA'].includes(c.estado),
  ).length

  async function cambiarEstado(nuevo) {
    if (nuevo === estadoTrat || guardandoTrat) return
    setGuardandoTrat(true)
    try {
      const r = await pacientesApi.actualizar(cliente.id, { estadoTratamiento: nuevo })
      setEstadoTrat(r.estadoTratamiento)
      setFinalizadoEn(r.tratamientoFinalizadoEn)
    } catch {
      /* noop: se conserva el estado anterior */
    } finally {
      setGuardandoTrat(false)
    }
  }

  async function guardarEdad() {
    const val = inputEdad === '' ? null : Number(inputEdad)
    try {
      const r = await pacientesApi.actualizar(cliente.id, { edadManual: val })
      setEdad(r.edad)
    } catch {
      /* noop */
    } finally {
      setEditandoEdad(false)
    }
  }

  async function cambiarIdioma(nuevo) {
    const previo = idiomaCli
    setIdiomaCli(nuevo)
    setGuardandoIdioma(true)
    try {
      await pacientesApi.actualizar(cliente.id, { idiomaPreferido: nuevo })
    } catch {
      setIdiomaCli(previo) // revierte si falla
    } finally {
      setGuardandoIdioma(false)
    }
  }

  const nombreCompleto = `${cliente.nombre} ${cliente.apellido || ''}`.trim()

  async function descargarHistorial() {
    setDescargando(true)
    setHistAviso(false)
    try {
      // Trae las notas frescas (orden cronológico se resuelve en el helper).
      const notas = await pacientesApi.notas(cliente.id).catch(() => [])
      const contenido = construirHistorialTxt({
        cliente,
        notas,
        profesionalNombre: user?.nombre,
      })
      const nombreArchivo = `historial-${slugArchivo(nombreCompleto)}-${hoyISO()}.txt`
      descargarTxt(nombreArchivo, contenido)
      setHistAviso(true)
      setTimeout(() => setHistAviso(false), 4000)
    } finally {
      setDescargando(false)
    }
  }

  async function eliminar() {
    setEliminando(true)
    setErrorDel(null)
    try {
      await pacientesApi.eliminar(cliente.id)
      setConfirmando(false)
      onEliminado?.(nombreCompleto)
    } catch (err) {
      // 409: tiene citas pendientes → mensaje claro traducido.
      setErrorDel(
        err?.code === 'CLIENTE_CON_CITAS_PENDIENTES'
          ? t('clients.cannotDeleteHasPendingAppointments')
          : err?.message || t('common.genericError'),
      )
    } finally {
      setEliminando(false)
    }
  }

  return (
    <li className="w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-navy-100">
      {/* Cabecera colapsada: 3 columnas */}
      <button onClick={() => setAbierto((v) => !v)} className="flex w-full items-stretch gap-4 text-left transition hover:bg-navy-50/40">
        <Foto cliente={cliente} className="h-[160px] w-[120px] shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col justify-center py-3">
          <p className="truncate text-lg font-bold text-navy-800">{cliente.nombre} {cliente.apellido}</p>
          <p className="truncate text-sm text-navy-500">{cliente.correo}{cliente.telefono ? ` · ${cliente.telefono}` : ''}</p>
          <span className={`mt-2 inline-block w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${cliente.estado === 'NUEVO' ? 'bg-brand-100 text-brand-600' : 'bg-navy-100 text-navy-700'}`}>
            {cliente.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')}
          </span>
        </div>
        <div className="hidden shrink-0 flex-col justify-center gap-1 py-3 pr-4 text-sm sm:flex">
          <span className="flex items-center gap-1.5 text-emerald-600"><b>✓</b> {cliente.totalCitasCompletadas} {t('clients.completed')}</span>
          <span className="flex items-center gap-1.5 text-red-500"><b>✗</b> {cliente.totalCitasAnuladas} {t('clients.cancelled')}</span>
          <span className="flex items-center gap-1.5 text-blue-500"><b>→</b> {cliente.proximaCita ? formatFechaCorta(cliente.proximaCita.fecha) : '—'}</span>
          <span className={`mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${TRAT_STYLE[estadoTrat].on}`}>
            {t('clients.' + TRAT_KEY[estadoTrat])}
          </span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-navy-100 bg-navy-50/40 px-4 py-4 sm:px-5">
          {/* SECCIÓN 1 — Info */}
          <Section title={t('clients.clientInfo')}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-xs text-navy-400">{t('clients.age')}:</dt>
                {editandoEdad ? (
                  <span className="flex items-center gap-1">
                    <input type="number" min="0" max="150" value={inputEdad} onChange={(e) => setInputEdad(e.target.value)} className="w-16 rounded-lg border border-navy-200 px-2 py-1 text-sm focus:outline-none" />
                    <button onClick={guardarEdad} className="rounded-md bg-navy-700 px-2 py-1 text-xs font-semibold text-white">{t('clients.save')}</button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <dd className="font-medium text-navy-700">{edad ?? t('clients.ageUnknown')}</dd>
                    <button onClick={() => { setInputEdad(edad ?? ''); setEditandoEdad(true) }} className="text-xs font-semibold text-navy-500 hover:text-brand-600">{t('clients.edit')}</button>
                  </span>
                )}
              </div>
              <div>
                <dt className="text-xs text-navy-400">{t('clients.firstAppt')}</dt>
                <dd className="font-medium text-navy-700">{t('clients.since')}: {cliente.primeraCita ? formatFechaCorta(cliente.primeraCita) : t('clients.noAppts')}</dd>
              </div>
            </dl>
            {/* Idioma preferido del cliente (para sus notificaciones). */}
            <div className="mt-3 flex items-center gap-2 border-t border-navy-100 pt-3">
              <label className="text-xs text-navy-400">{t('clients.notificationLanguage')}:</label>
              <select
                value={idiomaCli}
                onChange={(e) => cambiarIdioma(e.target.value)}
                disabled={guardandoIdioma}
                className="rounded-lg border border-navy-200 px-2 py-1 text-sm text-navy-700 focus:outline-none disabled:opacity-60"
              >
                <option value="ES">Español</option>
                <option value="EN">English</option>
                <option value="FR">Français</option>
              </select>
            </div>
          </Section>

          {/* SECCIÓN 2 — Estado del tratamiento */}
          <Section title={t('clients.treatmentStatus')}>
            <div className="flex gap-2">
              {ESTADOS_TRAT.map((e) => (
                <button
                  key={e}
                  onClick={() => cambiarEstado(e)}
                  disabled={guardandoTrat}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${e === estadoTrat ? TRAT_STYLE[e].on : `bg-white ${TRAT_STYLE[e].off}`}`}
                >
                  {t('clients.' + TRAT_KEY[e])}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-navy-500">
              {estadoTrat === 'COMPLETADO' && finalizadoEn
                ? `${t('clients.finishedOn')}: ${formatFechaCorta(finalizadoEn)}`
                : estadoTrat === 'ACTIVO'
                  ? restantes > 0 ? `${t('clients.remaining')}: ${restantes}` : t('clients.inProgress')
                  : ''}
            </p>

            {/* Descargar historial: disponible siempre, resaltado al Completar
                (recordatorio antes de eliminar al cliente). */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={descargarHistorial}
                disabled={descargando}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                  estadoTrat === 'COMPLETADO'
                    ? 'bg-navy-700 text-white shadow-sm hover:bg-navy-800'
                    : 'border border-navy-300 bg-white text-navy-700 hover:bg-navy-50'
                }`}
              >
                ⬇ {t('clients.downloadHistory')}{descargando ? '…' : ''}
              </button>
              {histAviso && <span className="text-sm font-medium text-emerald-600">{t('clients.historyGenerated')}</span>}
            </div>
          </Section>

          {/* SECCIÓN 3 — Resumen de citas */}
          <Section title={t('clients.apptSummary')}>
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip color="bg-emerald-50 text-emerald-700" text={`${cliente.totalCitasCompletadas} ${t('clients.completed')}`} />
              <Chip color="bg-red-50 text-red-600" text={`${cliente.totalCitasAnuladas} ${t('clients.cancelled')}`} />
              <Chip color="bg-blue-50 text-blue-600" text={`${t('clients.upcoming')}: ${cliente.proximaCita ? `${formatFechaCorta(cliente.proximaCita.fecha)} · ${cliente.proximaCita.horaInicio}` : '—'}`} />
            </div>
            {historial.length === 0 ? (
              <p className="text-sm text-navy-400">{t('clients.noAppts')}</p>
            ) : (
              <ul className="space-y-1.5">
                {historial.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotEstado(c.estado)}`} />
                    <span className="font-medium text-navy-700">{formatFechaCorta(c.fecha)}</span>
                    <span className="text-navy-400">{c.horaInicio} – {c.horaFin}</span>
                    <span className="ml-auto text-xs text-navy-400">{t('estado.' + c.estado)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* SECCIÓN 4 — Notas (inline) */}
          <NotasInline cliente={cliente} historial={historial} />

          {/* SECCIÓN 5 — Zona de peligro: eliminar cliente */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => { setErrorDel(null); setConfirmando(true) }}
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              {t('clients.deleteClient')}
            </button>
          </div>
        </div>
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-0 sm:items-center sm:p-4"
          onClick={() => !eliminando && setConfirmando(false)}
        >
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 text-center sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-navy-800">{t('clients.deleteClient')}</h3>
            <p className="mt-2 text-sm text-navy-600">{t('clients.confirmDeleteClient', { name: nombreCompleto })}</p>
            {errorDel && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{errorDel}</p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {eliminando ? t('clients.deleting') : t('clients.deleteClient')}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                disabled={eliminando}
                className="rounded-xl border border-navy-200 py-3 font-medium text-navy-700 transition hover:bg-navy-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-4 rounded-xl bg-white p-4 ring-1 ring-navy-100">
      <h4 className="mb-3 text-sm font-bold text-navy-700">{title}</h4>
      {children}
    </section>
  )
}

function Chip({ color, text }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{text}</span>
}

// ── Sección 4: notas inline (ver + agregar sin salir de la ficha) ────────────
function NotasInline({ cliente, historial }) {
  const { t } = useLanguage()
  const [notas, setNotas] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Mapa citaId -> fecha de la cita, para etiquetar las notas de cita.
  const fechaDeCita = {}
  for (const c of historial) fechaDeCita[c.id] = c.fecha

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setNotas(await pacientesApi.notas(cliente.id))
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
      const nueva = await pacientesApi.agregarNota(cliente.id, texto.trim())
      setNotas((prev) => [nueva, ...(prev || [])])
      setTexto('')
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 ring-1 ring-navy-100">
      <h4 className="mb-3 text-sm font-bold text-navy-700">{t('clients.notesHistory')}</h4>

      {error && <ErrorMessage error={error} className="mb-3" />}

      {cargando ? (
        <Spinner label={t('clients.loading')} />
      ) : notas && notas.length > 0 ? (
        <ul className="space-y-2">
          {notas.map((n) => (
            <li key={n.id} className="rounded-xl bg-navy-50 p-3 text-sm ring-1 ring-navy-100">
              <p className="mb-1 text-xs font-medium text-navy-400">
                {formatFechaHora(n.fecha)}
                {n.citaId && fechaDeCita[n.citaId]
                  ? ` · ${t('clients.noteOfApptFrom')} ${formatFechaCorta(fechaDeCita[n.citaId])}`
                  : ''}
              </p>
              <p className="text-navy-700">{n.texto}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-center text-sm text-navy-400">{t('clients.noNotes')}</p>
      )}

      {/* Agregar nota */}
      <form onSubmit={agregar} className="mt-4 border-t border-navy-100 pt-4">
        <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('clients.addNote')}</label>
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
    </section>
  )
}

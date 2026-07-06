import { useEffect, useState } from 'react'
import { pacientesApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { formatFechaCorta } from '../../lib/format.js'

// Lista de clientes como tarjetas visuales (tipo contacto profesional).
export default function Pacientes() {
  const { t } = useLanguage()
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [notasDe, setNotasDe] = useState(null) // cliente con el modal de notas abierto

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientes.map((c) => (
              <ClienteCard key={c.id} cliente={c} onVerNotas={() => setNotasDe(c)} />
            ))}
          </div>
        )}
      </div>

      {notasDe && <NotasModal cliente={notasDe} onClose={() => setNotasDe(null)} />}
    </div>
  )
}

// ── Tarjeta de cliente ───────────────────────────────────────────────────────
function ClienteCard({ cliente, onVerNotas }) {
  const { t } = useLanguage()
  const iniciales = `${cliente.nombre?.[0] || ''}${cliente.apellido?.[0] || ''}`.toUpperCase()
  const ultima = cliente.ultimaCita
    ? `${formatFechaCorta(cliente.ultimaCita.fecha)} · ${cliente.ultimaCita.horaInicio}`
    : t('clients.noAppts')

  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-100">
      {/* Foto / avatar + nombre */}
      <div className="flex flex-col items-center text-center">
        {cliente.fotoIdentidadUrl ? (
          <img
            src={cliente.fotoIdentidadUrl}
            alt=""
            className="h-24 w-24 rounded-2xl object-cover ring-1 ring-navy-100"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-navy-700 text-2xl font-bold text-gold-400">
            {iniciales || '👤'}
          </div>
        )}
        <p className="mt-3 text-base font-semibold text-navy-800">{cliente.nombre} {cliente.apellido}</p>
        <span className={`mt-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cliente.estado === 'NUEVO' ? 'bg-gold-100 text-gold-600' : 'bg-navy-100 text-navy-700'}`}>
          {cliente.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')}
        </span>
      </div>

      {/* Datos */}
      <dl className="mt-4 space-y-2 border-t border-navy-100 pt-4 text-sm">
        <Campo label={t('clients.document')} valor={cliente.documentoIdentidad} />
        <Campo label={t('common.email')} valor={cliente.correo} />
        {cliente.telefono && <Campo label={t('clients.phone')} valor={cliente.telefono} />}
        <Campo label={t('clients.lastAppt')} valor={ultima} />
      </dl>

      <button
        onClick={onVerNotas}
        className="mt-4 w-full rounded-xl bg-navy-700 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
      >
        {t('clients.viewNotes')}
      </button>
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-navy-400">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-navy-700">{valor}</dd>
    </div>
  )
}

// ── Modal de notas del cliente ───────────────────────────────────────────────
function NotasModal({ cliente, onClose }) {
  const { t } = useLanguage()
  const [notas, setNotas] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargarNotas() {
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
    cargarNotas()
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-navy-800">{cliente.nombre} {cliente.apellido}</h3>
            <p className="text-xs text-navy-400">{t('clients.newNote')}</p>
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

import { useEffect, useState } from 'react'
import { pacientesApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { formatFechaCorta } from '../../lib/format.js'

// Lista de clientes con panel de notas expandible.
export default function Pacientes() {
  const { t } = useLanguage()
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)

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
          <ul className="space-y-2">
            {clientes.map((c) => (
              <ClienteItem
                key={c.id}
                cliente={c}
                abierto={abierto === c.id}
                onToggle={() => setAbierto(abierto === c.id ? null : c.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ClienteItem({ cliente, abierto, onToggle }) {
  const { t } = useLanguage()
  const [notas, setNotas] = useState(null)
  const [cargando, setCargando] = useState(false)
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
    if (abierto && notas === null && !cargando) cargarNotas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

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
    <li className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-navy-100">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-navy-50">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-800">{cliente.nombre} {cliente.apellido}</p>
          <p className="text-xs text-navy-500">{cliente.correo} · {t('citaCard.doc')}: {cliente.documentoIdentidad}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cliente.estado === 'NUEVO' ? 'bg-gold-100 text-gold-600' : 'bg-navy-100 text-navy-700'}`}>
            {cliente.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')}
          </span>
          <span className="text-navy-300">{abierto ? '▲' : '▼'}</span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-navy-100 bg-navy-50 px-5 py-4">
          <form onSubmit={agregar} className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('clients.newNote')}</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder={t('clients.notePlaceholder')}
              className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none"
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
                <li key={n.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-navy-100">
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
      )}
    </li>
  )
}

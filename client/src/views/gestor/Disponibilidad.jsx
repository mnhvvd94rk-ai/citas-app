import { useEffect, useState } from 'react'
import { disponibilidadApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { hoyISO, formatFechaCorta } from '../../lib/format.js'

// CRUD de disponibilidad horaria del profesional.
export default function Disponibilidad() {
  const { t } = useLanguage()
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

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('availability.title')}</h1>
      <p className="mt-1 text-sm text-navy-500">{t('availability.subtitle')}</p>

      <form onSubmit={crear} className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-100">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.date')}</label>
            <input type="date" name="fecha" value={form.fecha} min={hoyISO()} onChange={setCampo} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.start')}</label>
            <input type="time" name="horaInicio" value={form.horaInicio} onChange={setCampo} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.end')}</label>
            <input type="time" name="horaFin" value={form.horaFin} onChange={setCampo} className={inputCls} />
          </div>
        </div>
        {errorForm && <ErrorMessage error={errorForm} className="mt-3" />}
        <button
          type="submit"
          disabled={creando}
          className="mt-3 w-full rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300 sm:w-auto sm:px-6"
        >
          {creando ? t('availability.adding') : t('availability.add')}
        </button>
      </form>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-navy-700">{t('availability.listTitle')}</h2>
      {error && <ErrorMessage error={error} className="mb-3" />}
      {cargando ? (
        <Spinner label={t('availability.loading')} />
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-12 text-center text-navy-500">
          {t('availability.empty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
              <div>
                <p className="font-semibold text-navy-800">{formatFechaCorta(d.fecha)}</p>
                <p className="text-sm text-navy-500">{d.horaInicio} – {d.horaFin}</p>
              </div>
              <button
                disabled={busy === d.id}
                onClick={() => eliminar(d.id)}
                className="rounded-lg border border-red-300 px-3.5 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {busy === d.id ? '…' : t('availability.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

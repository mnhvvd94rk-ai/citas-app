import { useEffect, useMemo, useState } from 'react'
import { disponibilidadApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import { hoyISO, formatFechaCorta } from '../../lib/format.js'

// Días de la semana en orden lunes→domingo con su valor JS (0=domingo…6=sábado).
const DIAS_SEMANA = [
  { valor: 1, key: 'monday' },
  { valor: 2, key: 'tuesday' },
  { valor: 3, key: 'wednesday' },
  { valor: 4, key: 'thursday' },
  { valor: 5, key: 'friday' },
  { valor: 6, key: 'saturday' },
  { valor: 0, key: 'sunday' },
]

const DURACIONES = [30, 45, 50, 55, 60, 90]

/** Suma un número de días a una fecha "YYYY-MM-DD" y devuelve "YYYY-MM-DD". */
function sumarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// CRUD de disponibilidad horaria del profesional.
export default function Disponibilidad() {
  const { t } = useLanguage()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [modo, setModo] = useState('dia') // 'dia' | 'rango'

  // ── Modo "un día" (formulario original) ─────────────────────────────────────
  const [form, setForm] = useState({ fecha: hoyISO(), horaInicio: '09:00', horaFin: '13:00' })
  const [creando, setCreando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [busy, setBusy] = useState(null)

  // ── Modo "rango de fechas" ──────────────────────────────────────────────────
  const [rango, setRango] = useState({
    fechaInicio: hoyISO(),
    fechaFin: sumarDias(hoyISO(), 6),
    dias: [], // valores JS 0-6, desmarcados por defecto
    horaInicio: '09:00',
    horaFin: '13:00',
  })
  const [duracionSel, setDuracionSel] = useState('45') // '30'…'90' | 'custom'
  const [duracionCustom, setDuracionCustom] = useState(45)
  const [generando, setGenerando] = useState(false)
  const [errorRango, setErrorRango] = useState(null)
  const [resultado, setResultado] = useState(null)

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

  // ── Lógica del modo rango ───────────────────────────────────────────────────
  function setCampoRango(e) {
    setResultado(null)
    setRango((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleDia(valor) {
    setResultado(null)
    setRango((prev) => ({
      ...prev,
      dias: prev.dias.includes(valor)
        ? prev.dias.filter((d) => d !== valor)
        : [...prev.dias, valor],
    }))
  }

  const duracion = duracionSel === 'custom' ? Number(duracionCustom) : Number(duracionSel)

  // Nº aproximado de días de agenda: días del rango cuyo día de la semana está elegido.
  const diasAgenda = useMemo(() => {
    const { fechaInicio, fechaFin, dias } = rango
    if (!fechaInicio || !fechaFin || fechaFin < fechaInicio || dias.length === 0) return 0
    const inicio = new Date(`${fechaInicio}T00:00:00.000Z`)
    const fin = new Date(`${fechaFin}T00:00:00.000Z`)
    const MS_DIA = 86400000
    const total = Math.round((fin.getTime() - inicio.getTime()) / MS_DIA)
    let n = 0
    for (let i = 0; i <= total; i++) {
      const d = new Date(inicio.getTime() + i * MS_DIA)
      if (dias.includes(d.getUTCDay())) n++
    }
    return n
  }, [rango])

  // Nombres legibles de los días elegidos, en orden lunes→domingo.
  const diasTexto = DIAS_SEMANA.filter((d) => rango.dias.includes(d.valor))
    .map((d) => t(`availability.${d.key}`))
    .join(', ')

  const rangoValido =
    rango.fechaFin > rango.fechaInicio &&
    rango.dias.length > 0 &&
    rango.horaFin > rango.horaInicio &&
    duracion >= 15 &&
    duracion <= 180

  async function generar(e) {
    e.preventDefault()
    setErrorRango(null)
    setResultado(null)
    if (rango.dias.length === 0) {
      setErrorRango(new Error(t('availability.selectDaysError')))
      return
    }
    setGenerando(true)
    try {
      const res = await disponibilidadApi.crearRango({
        fechaInicio: rango.fechaInicio,
        fechaFin: rango.fechaFin,
        diasSemana: rango.dias,
        horaInicio: rango.horaInicio,
        horaFin: rango.horaFin,
        duracionSlotMinutos: duracion,
      })
      setResultado(res)
      await cargar()
    } catch (err) {
      setErrorRango(err)
    } finally {
      setGenerando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'
  const tabCls = (activa) =>
    `flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
      activa ? 'bg-navy-700 text-white shadow-sm' : 'text-navy-600 hover:bg-navy-100'
    }`

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('availability.title')}</h1>
      <p className="mt-1 text-sm text-navy-500">{t('availability.subtitle')}</p>

      {/* Selector de modo */}
      <div className="mt-4 flex gap-1 rounded-2xl bg-navy-50 p-1 ring-1 ring-navy-100 sm:inline-flex">
        <button type="button" onClick={() => setModo('dia')} className={tabCls(modo === 'dia')}>
          {t('availability.modeSingle')}
        </button>
        <button type="button" onClick={() => setModo('rango')} className={tabCls(modo === 'rango')}>
          {t('availability.dateRange')}
        </button>
      </div>

      {modo === 'dia' ? (
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
      ) : (
        <form onSubmit={generar} className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-100">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.startDate')}</label>
              <input type="date" name="fechaInicio" value={rango.fechaInicio} min={hoyISO()} onChange={setCampoRango} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.endDate')}</label>
              <input type="date" name="fechaFin" value={rango.fechaFin} min={rango.fechaInicio} onChange={setCampoRango} className={inputCls} />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.selectDays')}</label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d, i) => {
                const activa = rango.dias.includes(d.valor)
                const letra = t('availability.dayLetters')[i]
                return (
                  <button
                    key={d.valor}
                    type="button"
                    onClick={() => toggleDia(d.valor)}
                    aria-pressed={activa}
                    title={t(`availability.${d.key}`)}
                    className={`h-11 w-11 rounded-xl border text-sm font-semibold transition ${
                      activa
                        ? 'border-navy-700 bg-navy-700 text-white'
                        : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400'
                    }`}
                  >
                    {letra}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.startTime')}</label>
              <input type="time" name="horaInicio" value={rango.horaInicio} onChange={setCampoRango} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.endTime')}</label>
              <input type="time" name="horaFin" value={rango.horaFin} onChange={setCampoRango} className={inputCls} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.slotDuration')}</label>
              <select
                value={duracionSel}
                onChange={(e) => {
                  setResultado(null)
                  setDuracionSel(e.target.value)
                }}
                className={inputCls}
              >
                {DURACIONES.map((m) => (
                  <option key={m} value={String(m)}>
                    {m} {t('availability.minutes')}
                  </option>
                ))}
                <option value="custom">{t('availability.custom')}</option>
              </select>
            </div>
            {duracionSel === 'custom' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">
                  {t('availability.custom')} ({t('availability.minutes')})
                </label>
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={duracionCustom}
                  onChange={(e) => {
                    setResultado(null)
                    setDuracionCustom(e.target.value)
                  }}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Resumen previo a confirmar */}
          {rangoValido && (
            <div className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-600">
              {t('availability.rangeSummary', {
                dias: diasTexto,
                inicio: formatFechaCorta(rango.fechaInicio),
                fin: formatFechaCorta(rango.fechaFin),
                horaInicio: rango.horaInicio,
                horaFin: rango.horaFin,
                duracion: duracion,
                n: diasAgenda,
              })}
            </div>
          )}

          {errorRango && <ErrorMessage error={errorRango} className="mt-3" />}
          {resultado && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
              {t('availability.availabilityGenerated', {
                dias: resultado.diasCreados,
                slots: resultado.slotsCreados,
              })}
            </div>
          )}

          <button
            type="submit"
            disabled={generando || !rangoValido}
            className="mt-4 w-full rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300 sm:w-auto sm:px-6"
          >
            {generando ? t('availability.generating') : t('availability.generateAvailability')}
          </button>
        </form>
      )}

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

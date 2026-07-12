import { useEffect, useMemo, useRef, useState } from 'react'
import { disponibilidadApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import TimeSelect from '../../components/TimeSelect.jsx'
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

  // ── Selección múltiple (estilo Gmail) para eliminar en lote ─────────────────
  const [sel, setSel] = useState(() => new Set())
  const [confirmandoLote, setConfirmandoLote] = useState(false)
  const [eliminandoLote, setEliminandoLote] = useState(false)
  const [mensajeLote, setMensajeLote] = useState(null) // { eliminadas, conCitas }
  const selectAllRef = useRef(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const l = await disponibilidadApi.listar()
      setLista(l)
      // Poda la selección: descarta ids que ya no existen en la lista.
      setSel((prev) => new Set([...prev].filter((id) => l.some((d) => d.id === id))))
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
      await disponibilidadApi.crear({ ...form, duracionSlotMinutos: duracion })
      await cargar()
    } catch (err) {
      setErrorForm(err)
    } finally {
      setCreando(false)
    }
  }

  // ── Selección múltiple ──────────────────────────────────────────────────────
  const todasSeleccionadas = lista.length > 0 && sel.size === lista.length
  const algunaSeleccionada = sel.size > 0

  // Estado "indeterminado" del checkbox maestro (algunas, pero no todas).
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = algunaSeleccionada && !todasSeleccionadas
    }
  }, [algunaSeleccionada, todasSeleccionadas])

  function toggleSel(id) {
    setMensajeLote(null)
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas() {
    setMensajeLote(null)
    setSel(todasSeleccionadas ? new Set() : new Set(lista.map((d) => d.id)))
  }

  // Elimina en lote las franjas seleccionadas reutilizando DELETE /disponibilidad/:id.
  // Las que devuelven 409 (tienen citas activas) se excluyen y se avisan aparte.
  async function eliminarSeleccionadas() {
    setEliminandoLote(true)
    setError(null)
    let eliminadas = 0
    let conCitas = 0
    for (const id of [...sel]) {
      try {
        await disponibilidadApi.eliminar(id)
        eliminadas++
      } catch (err) {
        if (err?.status === 409) conCitas++
        else setError(err)
      }
    }
    await cargar()
    setSel(new Set())
    setConfirmandoLote(false)
    setEliminandoLote(false)
    setMensajeLote({ eliminadas, conCitas })
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
              <TimeSelect ariaLabel={t('availability.start')} value={form.horaInicio} onChange={(v) => setForm((prev) => ({ ...prev, horaInicio: v }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.end')}</label>
              <TimeSelect ariaLabel={t('availability.end')} value={form.horaFin} onChange={(v) => setForm((prev) => ({ ...prev, horaFin: v }))} />
            </div>
          </div>
          {/* Duración del bloque (mismo selector que el modo rango). */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DuracionField
              sel={duracionSel}
              onChangeSel={setDuracionSel}
              custom={duracionCustom}
              onChangeCustom={setDuracionCustom}
              inputCls={inputCls}
              t={t}
            />
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
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
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
                    className={`flex h-10 w-full items-center justify-center rounded-xl border text-sm font-semibold transition sm:h-11 ${
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

          {/* Horas + duración: 1 col en móvil, 2 en tablet pequeña (sm), 3 en tablet/desktop (md) */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.startTime')}</label>
              <TimeSelect ariaLabel={t('availability.startTime')} value={rango.horaInicio} onChange={(v) => { setResultado(null); setRango((prev) => ({ ...prev, horaInicio: v })) }} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.endTime')}</label>
              <TimeSelect ariaLabel={t('availability.endTime')} value={rango.horaFin} onChange={(v) => { setResultado(null); setRango((prev) => ({ ...prev, horaFin: v })) }} />
            </div>
            <DuracionField
              sel={duracionSel}
              onChangeSel={(v) => { setResultado(null); setDuracionSel(v) }}
              custom={duracionCustom}
              onChangeCustom={(v) => { setResultado(null); setDuracionCustom(v) }}
              inputCls={inputCls}
              t={t}
            />
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

      {/* Resultado del borrado en lote */}
      {mensajeLote && (mensajeLote.eliminadas > 0 || mensajeLote.conCitas > 0) && (
        <div
          className={`mb-3 rounded-xl p-3 text-sm font-medium ring-1 ${
            mensajeLote.conCitas > 0
              ? 'bg-amber-50 text-amber-700 ring-amber-100'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
          }`}
        >
          {mensajeLote.eliminadas > 0 && t('availability.deletedSuccessfully', { n: mensajeLote.eliminadas })}
          {mensajeLote.conCitas > 0 && <> {t('availability.notDeletedHasCitas', { n: mensajeLote.conCitas })}</>}
        </div>
      )}

      {cargando ? (
        <Spinner label={t('availability.loading')} />
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-12 text-center text-navy-500">
          {t('availability.empty')}
        </div>
      ) : (
        <>
          {/* Barra de acciones: aparece cuando hay 1+ seleccionadas */}
          {algunaSeleccionada && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-navy-800 px-4 py-2.5 text-white">
              <span className="text-sm font-medium">{t('availability.selected', { n: sel.size })}</span>
              <button
                onClick={() => setConfirmandoLote(true)}
                className="rounded-lg bg-red-500 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                {t('availability.deleteSelected')}
              </button>
            </div>
          )}

          {/* Seleccionar todas / ninguna */}
          <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 px-1 text-sm text-navy-600">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={todasSeleccionadas}
              onChange={toggleTodas}
              className="h-4 w-4 rounded border-navy-300 text-navy-700 focus:ring-navy-500"
            />
            {t('availability.selectAll')}
          </label>

          <ul className="space-y-2">
            {lista.map((d) => {
              const marcada = sel.has(d.id)
              return (
                <li key={d.id}>
                  {/* Toda la fila es clickeable (label) → mejor UX táctil en tablet/móvil */}
                  <label
                    className={`flex cursor-pointer items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 transition ${
                      marcada ? 'ring-2 ring-navy-400' : 'ring-navy-100 hover:ring-navy-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => toggleSel(d.id)}
                      aria-label={`${formatFechaCorta(d.fecha)} ${d.horaInicio}-${d.horaFin}`}
                      className="h-5 w-5 shrink-0 rounded border-navy-300 text-navy-700 focus:ring-navy-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy-800">{formatFechaCorta(d.fecha)}</p>
                      <p className="text-sm text-navy-500">
                        {d.horaInicio} – {d.horaFin}
                        {d.duracionMinutos ? ` · ${d.duracionMinutos} ${t('availability.minutes')}` : ''}
                      </p>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* Modal de confirmación de borrado en lote */}
      {confirmandoLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-navy-800">{t('availability.confirmTitle')}</h3>
            <p className="mt-2 text-sm text-navy-600">{t('availability.confirmDeleteMultiple', { n: sel.size })}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmandoLote(false)}
                disabled={eliminandoLote}
                className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
              >
                {t('availability.cancel')}
              </button>
              <button
                onClick={eliminarSeleccionadas}
                disabled={eliminandoLote}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {eliminandoLote ? '…' : t('availability.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Selector de "Duración del bloque" compartido por los modos "Un día" y "Rango".
// Renderiza el dropdown de duraciones + el input personalizado ("custom").
function DuracionField({ sel, onChangeSel, custom, onChangeCustom, inputCls, t }) {
  return (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('availability.slotDuration')}</label>
        <select value={sel} onChange={(e) => onChangeSel(e.target.value)} className={inputCls}>
          {DURACIONES.map((m) => (
            <option key={m} value={String(m)}>
              {m} {t('availability.minutes')}
            </option>
          ))}
          <option value="custom">{t('availability.custom')}</option>
        </select>
      </div>
      {sel === 'custom' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-700">
            {t('availability.custom')} ({t('availability.minutes')})
          </label>
          <input
            type="number"
            min={15}
            max={180}
            value={custom}
            onChange={(e) => onChangeCustom(e.target.value)}
            className={inputCls}
          />
        </div>
      )}
    </>
  )
}

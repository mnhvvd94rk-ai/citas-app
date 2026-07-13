import { useEffect, useMemo, useState } from 'react'
import { citasApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { hoyISO } from '../lib/format.js'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

/**
 * Calendario mensual para que el cliente elija un día con disponibilidad.
 * - Resalta los días con al menos un slot libre (clicables).
 * - Atenúa/deshabilita días pasados y sin disponibilidad.
 * Props: value (YYYY-MM-DD seleccionado), onSelect(fecha).
 */
export default function CalendarioDisponibilidad({ value, onSelect }) {
  const { t } = useLanguage()
  const hoy = hoyISO()
  const [hoyY, hoyM] = hoy.split('-').map(Number)

  const [cursor, setCursor] = useState({ y: hoyY, m: hoyM - 1 }) // m 0-indexado
  const [dias, setDias] = useState(() => new Set()) // fechas disponibles del mes
  const [cargando, setCargando] = useState(true)

  const meses = t('calendar.months')
  const semana = t('calendar.weekdays') // lunes-primero

  const mesParam = `${cursor.y}-${pad(cursor.m + 1)}`

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    citasApi
      .diasDisponibles(mesParam)
      .then((res) => {
        if (cancelado) return
        setDias(new Set(res?.dias || []))
      })
      .catch(() => {
        if (!cancelado) setDias(new Set())
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [mesParam])

  // Celdas del mes con offset lunes-primero.
  const celdas = useMemo(() => {
    const diasMes = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const primerDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7 // 0 = Lun
    const arr = Array(primerDow).fill(null)
    for (let d = 1; d <= diasMes; d++) arr.push(d)
    return arr
  }, [cursor])

  // No se permite retroceder a meses completamente pasados.
  const esMesActual = cursor.y === hoyY && cursor.m === hoyM - 1
  const puedeRetroceder = cursor.y > hoyY || (cursor.y === hoyY && cursor.m > hoyM - 1)

  function cambiarMes(delta) {
    setCursor((c) => {
      const nm = c.m + delta
      const y = c.y + Math.floor(nm / 12)
      const m = ((nm % 12) + 12) % 12
      return { y, m }
    })
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-navy-100 sm:p-4">
      {/* Cabecera: navegación de mes */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => cambiarMes(-1)}
          disabled={!puedeRetroceder}
          aria-label="prev"
          className="rounded-lg px-3 py-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-30"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold text-navy-800 sm:text-base">
          {meses[cursor.m]} {cursor.y}
        </h3>
        <button
          type="button"
          onClick={() => cambiarMes(1)}
          aria-label="next"
          className="rounded-lg px-3 py-1.5 text-navy-500 hover:bg-navy-50"
        >
          ›
        </button>
      </div>

      {/* Encabezado de días de la semana */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-navy-400 sm:text-xs">
        {semana.map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Rejilla del mes */}
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="aspect-square" />
          const iso = ymd(cursor.y, cursor.m, d)
          const esHoy = iso === hoy
          const esPasado = iso < hoy
          const disponible = dias.has(iso)
          const seleccionado = iso === value
          const clicable = disponible && !esPasado

          let cls =
            'flex aspect-square items-center justify-center rounded-lg text-sm font-semibold transition '
          if (seleccionado) {
            cls += 'bg-brand-600 text-white ring-2 ring-brand-300'
          } else if (clicable) {
            cls += 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100'
          } else {
            // Pasado o sin disponibilidad: atenuado y no clicable.
            cls += 'text-navy-300'
          }
          if (esHoy && !seleccionado) cls += ' ring-1 ring-navy-300'

          return (
            <button
              key={iso}
              type="button"
              disabled={!clicable}
              onClick={() => clicable && onSelect(iso)}
              aria-pressed={seleccionado}
              aria-disabled={!clicable}
              className={cls}
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-navy-500 sm:text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand-50 ring-1 ring-brand-200" />
          {t('newAppt.legendAvailable')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-white ring-1 ring-navy-200" />
          {t('newAppt.legendUnavailable')}
        </span>
        {cargando && <span className="text-navy-400">{t('newAppt.searching')}</span>}
      </div>
    </div>
  )
}

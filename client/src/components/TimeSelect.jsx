// Selector de hora consistente en todos los dispositivos.
// Reemplaza a <input type="time">, cuya UI nativa varía mucho (spinner en
// desktop, rueda en iOS…). Aquí usamos dos <select> nativos (hora + minutos)
// que se ven y comportan igual en Chrome, Safari, iPad e iPhone.
//
// Props:
//   value:    string "HH:MM"
//   onChange: (nuevoValor: "HH:MM") => void

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
// Incrementos de 5 minutos (00, 05, 10 … 55) — buena precisión sin listas enormes.
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const selectCls =
  'w-full rounded-xl border border-navy-200 px-3 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

export default function TimeSelect({ value = '00:00', onChange, className = '', ariaLabel }) {
  const [hhRaw = '00', mmRaw = '00'] = String(value || '').split(':')
  const hh = hhRaw.padStart(2, '0')
  const mm = mmRaw.padStart(2, '0')

  // Si el minuto actual no cae en la rejilla de 5, se añade como opción para
  // que el <select> controlado muestre el valor correcto.
  const opcionesMin = MINUTOS.includes(mm) ? MINUTOS : [mm, ...MINUTOS]

  const emitir = (nuevaHh, nuevoMm) => onChange?.(`${nuevaHh}:${nuevoMm}`)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        aria-label={ariaLabel ? `${ariaLabel} — hora` : 'Hora'}
        value={hh}
        onChange={(e) => emitir(e.target.value, mm)}
        className={selectCls}
      >
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="font-semibold text-navy-400">:</span>
      <select
        aria-label={ariaLabel ? `${ariaLabel} — minutos` : 'Minutos'}
        value={mm}
        onChange={(e) => emitir(hh, e.target.value)}
        className={selectCls}
      >
        {opcionesMin.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}

// Selector de "Duración del bloque" compartido (modos de Disponibilidad y el
// modal de "Agendar cita" manual). Dropdown de duraciones + opción personalizada.

export const DURACIONES = [30, 45, 50, 55, 60, 90, 120]

export default function DuracionField({ sel, onChangeSel, custom, onChangeCustom, inputCls, t }) {
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

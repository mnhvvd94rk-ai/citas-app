import { useLanguage } from '../context/LanguageContext.jsx'

// Tarjeta de plan reutilizable: se usa en la pantalla de elección del registro
// (Parte 2: Básica + Pro) y en la pantalla "Actualizar a Pro" del menú (Parte 3:
// solo Pro). Presentacional: no decide nada, solo muestra el plan y avisa por
// `onSelect`. `selected` la resalta; `badge`/`note` son las cintas superiores.
export default function PlanCard({ plan, selected = false, onSelect, badge, note }) {
  const { t } = useLanguage()
  const esPro = plan === 'pro'

  const nombre = esPro ? t('plans.proName') : t('plans.basicName')
  const tagline = esPro ? t('plans.proTagline') : t('plans.basicTagline')
  const features = esPro
    ? [t('plans.proF1'), t('plans.proF2'), t('plans.proF3')]
    : [t('plans.basicF1'), t('plans.basicF2'), t('plans.basicF3')]

  const clickable = typeof onSelect === 'function'
  const base =
    'relative flex w-full flex-col rounded-2xl border bg-white p-5 text-left transition'
  const estado = selected
    ? 'border-brand-500 ring-2 ring-brand-500 shadow-lg shadow-navy-900/5'
    : 'border-navy-200 hover:border-navy-300'

  const Wrapper = clickable ? 'button' : 'div'

  return (
    <Wrapper
      type={clickable ? 'button' : undefined}
      onClick={clickable ? () => onSelect(plan) : undefined}
      className={`${base} ${estado}`}
    >
      {(badge || note) && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center">
          {badge && (
            <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white shadow">
              {badge}
            </span>
          )}
          {note && !badge && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              {note}
            </span>
          )}
        </div>
      )}

      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-lg font-bold text-navy-800">{nombre}</span>
        {selected && <span className="text-brand-600" aria-hidden>✓</span>}
      </div>
      <p className="mt-1 text-sm text-navy-500">{tagline}</p>
      {badge && note && (
        <p className="mt-2 text-xs font-semibold text-emerald-700">{note}</p>
      )}

      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-navy-700">
            <span className="mt-0.5 text-emerald-500" aria-hidden>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Wrapper>
  )
}

import { useLanguage } from '../context/LanguageContext.jsx'

// Badge de estado de cita con color semántico.
const ESTILOS = {
  CONFIRMADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  ANULADA: 'bg-red-50 text-red-700 border-red-200',
  COMPLETADA: 'bg-navy-100 text-navy-700 border-navy-200',
}

export default function EstadoBadge({ estado }) {
  const { t } = useLanguage()
  const estilo = ESTILOS[estado] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estilo}`}
    >
      {t(`estado.${estado}`)}
    </span>
  )
}

// Badge de estado de cita con color semántico.
// verde=confirmada, amarillo=pendiente, rojo=anulada, gris=completada.
const ESTILOS = {
  CONFIRMADA: 'bg-green-100 text-green-800 border-green-200',
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-200',
  ANULADA: 'bg-red-100 text-red-800 border-red-200',
  COMPLETADA: 'bg-slate-200 text-slate-700 border-slate-300',
}

const ETIQUETAS = {
  CONFIRMADA: 'Confirmada',
  PENDIENTE: 'Pendiente',
  ANULADA: 'Anulada',
  COMPLETADA: 'Completada',
}

export default function EstadoBadge({ estado }) {
  const estilo = ESTILOS[estado] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${estilo}`}
    >
      {ETIQUETAS[estado] || estado}
    </span>
  )
}

// Spinner de carga reutilizable.
export default function Spinner({ label = 'Cargando…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-slate-500 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

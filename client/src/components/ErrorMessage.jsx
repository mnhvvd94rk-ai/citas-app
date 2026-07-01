// Mensaje de error consistente. Acepta string o Error.
export default function ErrorMessage({ error, onRetry, className = '' }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : error.message || 'Ocurrió un error.'
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}
    >
      <span aria-hidden className="mt-0.5">⚠️</span>
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

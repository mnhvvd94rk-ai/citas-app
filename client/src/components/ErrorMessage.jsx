import { useLanguage } from '../context/LanguageContext.jsx'

// Mensaje de error consistente. Acepta string o Error.
export default function ErrorMessage({ error, onRetry, className = '' }) {
  const { t } = useLanguage()
  if (!error) return null
  const message =
    typeof error === 'string' ? error : error.message || t('common.genericError')
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}
    >
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

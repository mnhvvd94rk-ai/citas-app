import { useLanguage } from '../context/LanguageContext.jsx'

// Spinner de carga reutilizable.
export default function Spinner({ label, className = '' }) {
  const { t } = useLanguage()
  const text = label === undefined ? t('common.loading') : label
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-navy-400 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-100 border-t-navy-700" />
      {text && <p className="text-sm">{text}</p>}
    </div>
  )
}

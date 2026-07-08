// Logo de Ikatun: versión simplificada del ícono fuego+teal, optimizada para
// tamaños pequeños (navbar/landing) — formas grandes y nítidas a 28-32px.
// El ikatun-logo.svg detallado de public/ (favicon/PWA) se mantiene sin cambios.
// variant: 'horizontal' (marca + wordmark) | 'mark' (solo icono).
function Mark({ cls }) {
  return (
    <svg viewBox="0 0 100 100" className={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ikatun-fire-simple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8823A"/>
          <stop offset="100%" stopColor="#100D0B"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#ikatun-fire-simple)"/>
      <circle cx="68" cy="32" r="14" fill="#2C7C79"/>
      <circle cx="32" cy="68" r="12" fill="#2C7C79"/>
      <path d="M 50 20 Q 60 50 40 80" stroke="#2C7C79" strokeWidth="7" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

export default function Logo({ variant = 'horizontal', onDark = false, className = '' }) {
  if (variant === 'mark') {
    return <Mark cls={`h-8 w-8 rounded-lg ${className}`} />
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark cls="h-7 w-7 rounded-md shrink-0" />
      <span className={`text-xl font-bold ${onDark ? 'text-white' : 'text-navy-800'}`}>
        Ikatun
      </span>
    </span>
  )
}

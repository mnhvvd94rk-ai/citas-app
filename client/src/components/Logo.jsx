// Logo de Ikatun. Marca minimalista: dos círculos (dos personas que se
// encuentran) dentro de un anillo, en azul profundo + acento verde.
// variant: 'horizontal' (marca + wordmark) | 'mark' (solo icono).
// onDark: true para fondos oscuros (usa blanco en vez de azul).

function Mark({ cls, onDark }) {
  const ring = onDark ? '#ffffff' : '#1e3a5f'
  const dot1 = onDark ? '#ffffff' : '#1e3a5f'
  const dot2 = '#10b981'
  return (
    <svg viewBox="0 0 40 40" className={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="none" stroke={ring} strokeWidth="2.4" />
      <circle cx="15.5" cy="20" r="6.6" fill={dot1} />
      <circle cx="24.5" cy="20" r="6.6" fill={dot2} fillOpacity="0.95" />
    </svg>
  )
}

export default function Logo({ variant = 'horizontal', onDark = false, className = '' }) {
  if (variant === 'mark') {
    return <Mark cls={`h-8 w-8 ${className}`} onDark={onDark} />
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark cls="h-7 w-7 shrink-0" onDark={onDark} />
      <span className={`text-xl font-extrabold tracking-tight ${onDark ? 'text-white' : 'text-navy-800'}`}>
        Ikatun
      </span>
    </span>
  )
}

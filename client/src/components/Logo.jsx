// Logo de Ikatun: mismo diseño fuego+teal usado como favicon/PWA icon.
// variant: 'horizontal' (marca + wordmark) | 'mark' (solo icono).
function Mark({ cls }) {
  return (
    <svg viewBox="0 0 512 512" className={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ikatun-fire" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8823A"/>
          <stop offset="45%" stopColor="#B5451F"/>
          <stop offset="100%" stopColor="#100D0B"/>
        </linearGradient>
        <clipPath id="ikatun-rounded">
          <rect x="0" y="0" width="512" height="512" rx="112"/>
        </clipPath>
      </defs>
      <g clipPath="url(#ikatun-rounded)" transform="rotate(270 256 256) scale(-1,1) translate(-512,0)">
        <rect x="0" y="0" width="512" height="512" fill="url(#ikatun-fire)"/>
        <path d="M 200 40 C 230 110, 175 150, 210 205 C 235 245, 300 260, 285 320 C 272 370, 210 400, 235 460"
              fill="none" stroke="#2C7C79" strokeWidth="20" strokeLinecap="round"/>
        <circle cx="350" cy="220" r="46" fill="#2C7C79"/>
        <circle cx="150" cy="290" r="42" fill="#2C7C79"/>
      </g>
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

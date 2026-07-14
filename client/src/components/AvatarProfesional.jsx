// Avatar del profesional: muestra la foto de perfil si existe, o la inicial del
// nombre como fallback genérico (el mismo comportamiento que había antes de que
// existiera la foto). El tamaño/forma se controla con `className` desde quien lo usa.
export default function AvatarProfesional({ src, nombre, className = '' }) {
  if (src) {
    return <img src={src} alt={nombre || ''} className={`object-cover ${className}`} />
  }
  return (
    <div className={`flex items-center justify-center bg-navy-700 font-bold text-brand-400 ${className}`}>
      {(nombre?.[0] || '·').toUpperCase()}
    </div>
  )
}

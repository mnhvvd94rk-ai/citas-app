// Normaliza el código escrito a mano al mismo formato que el backend guarda como
// slug (minúsculas, sin acentos, guiones). Es idempotente sobre un slug ya válido,
// así que tolera que el cliente escriba "Nombre Profesional" o "nombre-profesional".
// También acepta que peguen el enlace completo (…/reservar/<slug>): en ese caso se
// queda solo con la parte del slug.
export function normalizarCodigo(texto) {
  let s = String(texto || '').trim()
  // ¿Pegaron la URL completa del enlace? Quédate con lo que va después de
  // "/reservar/" y hasta la siguiente barra, query (?) o ancla (#).
  const marca = s.toLowerCase().indexOf('/reservar/')
  if (marca !== -1) {
    s = s.slice(marca + '/reservar/'.length).split(/[/?#]/)[0]
  }
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos/tildes (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

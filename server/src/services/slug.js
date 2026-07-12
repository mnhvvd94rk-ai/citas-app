// Generación de "slugs" para el enlace público de registro de cada profesional
// (https://kohtun.com/reservar/<slug>). Un slug es una versión del nombre apta
// para URL: minúsculas, sin acentos, con guiones en lugar de espacios.

/**
 * Convierte un texto libre en un slug base apto para URL.
 * "My Agenda" → "my-agenda"; "José & Cía." → "jose-cia".
 * Si el texto no deja ningún carácter válido, devuelve "".
 */
export function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, tildes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // todo lo no alfanumérico → guion
    .replace(/^-+|-+$/g, '') // sin guiones al inicio/fin
    .slice(0, 60)
}

/**
 * Genera un slug único a partir de `nombre`, comprobando duplicados con
 * `existe(slug) => Promise<boolean>`. Si el slug ya existe, prueba con sufijos
 * numéricos: base, base-2, base-3, … El primero libre se devuelve.
 *
 * Si `nombre` no produce un slug válido, parte de "profesional".
 */
export async function generarSlugUnico(nombre, existe) {
  const base = slugify(nombre) || 'profesional'
  let candidato = base
  let n = 2
  // Bucle acotado por seguridad; en la práctica termina en las primeras vueltas.
  while (await existe(candidato)) {
    candidato = `${base}-${n}`
    n++
  }
  return candidato
}

// Selector de zona horaria del negocio. Lista curada de las zonas más habituales
// (Europa y América/México), suficiente para los profesionales actuales y futuros
// sin abrumar con las ~400 zonas IANA. Si el valor actual no está en la lista, se
// añade arriba para no perderlo.
const ZONAS = [
  { tz: 'Europe/Brussels', label: 'Bruselas (Bélgica)' },
  { tz: 'Europe/Paris', label: 'París (Francia)' },
  { tz: 'Europe/Madrid', label: 'Madrid (España)' },
  { tz: 'Europe/London', label: 'Londres (Reino Unido)' },
  { tz: 'America/Mexico_City', label: 'Ciudad de México' },
  { tz: 'America/Cancun', label: 'Cancún (México)' },
  { tz: 'America/Tijuana', label: 'Tijuana (México)' },
  { tz: 'America/New_York', label: 'Nueva York (EE. UU. Este)' },
  { tz: 'America/Bogota', label: 'Bogotá (Colombia)' },
  { tz: 'America/Lima', label: 'Lima (Perú)' },
  { tz: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (Argentina)' },
  { tz: 'America/Santiago', label: 'Santiago (Chile)' },
  { tz: 'America/Sao_Paulo', label: 'São Paulo (Brasil)' },
  { tz: 'UTC', label: 'UTC' },
]

/** Zona horaria que el navegador cree que usa el usuario (para un default útil). */
export function zonaHorariaDelNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels'
  } catch {
    return 'Europe/Brussels'
  }
}

export default function TimezoneSelect({ value, onChange, id, className = '' }) {
  const enLista = ZONAS.some((z) => z.tz === value)
  return (
    <select
      id={id}
      value={value || 'Europe/Brussels'}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {!enLista && value && <option value={value}>{value}</option>}
      {ZONAS.map((z) => (
        <option key={z.tz} value={z.tz}>
          {z.label} — {z.tz}
        </option>
      ))}
    </select>
  )
}

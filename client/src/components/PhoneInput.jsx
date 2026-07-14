import { useState } from 'react'

// Selector de código de país + número. Guarda el teléfono COMPLETO con el código
// incluido, en formato E.164 (p.ej. "+523312345678"), compatible con lo que ya se
// almacenaba (texto con el código) y con notificaciones tipo WhatsApp/Twilio.
export const PAISES = [
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: '+34', flag: '🇪🇸', name: 'España' },
  { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+49', flag: '🇩🇪', name: 'Deutschland' },
  { code: '+39', flag: '🇮🇹', name: 'Italia' },
  { code: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
]

// Separa un valor guardado ("+523312…") en { code, nacional }. Prueba los códigos
// más largos primero para no confundir, p.ej., "+1" con "+52". Si no reconoce
// ningún código, deja los dígitos como número nacional y el código por defecto.
function separar(value) {
  const v = String(value || '').trim()
  const porLongitud = [...PAISES].sort((a, b) => b.code.length - a.code.length)
  const pais = porLongitud.find((p) => v.startsWith(p.code))
  if (pais) return { code: pais.code, nacional: v.slice(pais.code.length).replace(/\D/g, '') }
  return { code: PAISES[0].code, nacional: v.replace(/\D/g, '') }
}

export default function PhoneInput({ value, onChange, name, inputClassName = '', placeholder }) {
  const [code, setCode] = useState(() => separar(value).code)
  const [nacional, setNacional] = useState(() => separar(value).nacional)

  function actualizar(nuevoCode, nuevoNacional) {
    const digitos = String(nuevoNacional).replace(/\D/g, '')
    setCode(nuevoCode)
    setNacional(digitos)
    // Sin dígitos no guardamos un código suelto: se trata como vacío (para que la
    // validación de "teléfono requerido" siga funcionando).
    onChange(digitos ? `${nuevoCode}${digitos}` : '')
  }

  const selectCls =
    'shrink-0 rounded-xl border border-navy-200 bg-white px-2 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div className="flex gap-2">
      <select
        aria-label="Código de país"
        value={code}
        onChange={(e) => actualizar(e.target.value, nacional)}
        className={selectCls}
      >
        {PAISES.map((p) => (
          <option key={p.code} value={p.code}>
            {p.flag} {p.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        name={name}
        value={nacional}
        onChange={(e) => actualizar(code, e.target.value)}
        className={`flex-1 ${inputClassName}`}
        placeholder={placeholder}
      />
    </div>
  )
}

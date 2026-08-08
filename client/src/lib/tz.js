// Zona horaria IANA que el dispositivo/navegador cree que usa el usuario. Es la
// misma API estándar en cualquier celular/computadora moderna. La app la usa para
// mantener `medico.zonaHoraria` "en vivo" (como el reloj del teléfono) y para
// anclar la zona de lo que se crea. Fallback seguro si el navegador no la expone.
export function zonaHorariaDelNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels'
  } catch {
    return 'Europe/Brussels'
  }
}

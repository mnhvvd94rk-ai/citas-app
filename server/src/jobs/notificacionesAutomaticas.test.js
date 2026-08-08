import { describe, it, expect } from 'vitest'
import { instanteCita } from './notificacionesAutomaticas.js'

// Protección "Google Calendar" (punto 3): el instante de una cita se calcula
// SIEMPRE con la zona anclada en la cita al agendarse, NUNCA con la zona actual del
// profesional. Aunque el profesional viaje (cambie medico.zonaHoraria), la cita ya
// agendada no se mueve de hora.
describe('instanteCita — ancla de zona horaria', () => {
  const cita = (extra) => ({ fecha: new Date('2026-12-15T00:00:00.000Z'), horaInicio: '10:00', ...extra })

  it('usa zonaHorariaCreacion de la cita, no la zona actual del médico', () => {
    // Agendada en Bruselas (diciembre = CET, UTC+1) → 10:00 Bruselas = 09:00 UTC.
    // El médico AHORA está en China (medico.zonaHoraria cambió), pero NO debe influir.
    const inst = instanteCita(cita({ zonaHorariaCreacion: 'Europe/Brussels', medico: { zonaHoraria: 'Asia/Shanghai' } }))
    expect(inst.toISOString()).toBe('2026-12-15T09:00:00.000Z')
  })

  it('la MISMA cita daría otra hora si (mal) usara la zona actual — demuestra la protección', () => {
    const anclada = instanteCita(cita({ zonaHorariaCreacion: 'Europe/Brussels', medico: { zonaHoraria: 'Asia/Shanghai' } }))
    const siUsaraActual = instanteCita(cita({ zonaHorariaCreacion: 'Asia/Shanghai', medico: { zonaHoraria: 'Asia/Shanghai' } }))
    expect(anclada.toISOString()).not.toBe(siUsaraActual.toISOString()) // se movería 7h si no hubiera ancla
  })

  it('Montreal en verano (EDT, UTC-4): ancla con DST correcto de la fecha', () => {
    // Cita de julio agendada en Montreal: 10:00 EDT = 14:00 UTC.
    const inst = instanteCita({ fecha: new Date('2026-07-10T00:00:00.000Z'), horaInicio: '10:00', zonaHorariaCreacion: 'America/Toronto', medico: { zonaHoraria: 'America/Toronto' } })
    expect(inst.toISOString()).toBe('2026-07-10T14:00:00.000Z')
  })

  it('fallback: cita sin zona anclada usa la zona del médico', () => {
    const inst = instanteCita(cita({ zonaHorariaCreacion: null, medico: { zonaHoraria: 'America/Mexico_City' } }))
    // 10:00 México (UTC-6) = 16:00 UTC.
    expect(inst.toISOString()).toBe('2026-12-15T16:00:00.000Z')
  })

  it('fallback final: sin zona anclada ni médico usa el default (Europe/Brussels)', () => {
    const inst = instanteCita(cita({ zonaHorariaCreacion: null, medico: null }))
    expect(inst.toISOString()).toBe('2026-12-15T09:00:00.000Z') // CET
  })
})

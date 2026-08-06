import { describe, it, expect } from 'vitest'
import { wallTimeToInstant, esZonaHorariaValida, ZONA_HORARIA_DEFAULT } from './timezone.js'

describe('wallTimeToInstant', () => {
  it('Bruselas en verano (CEST, UTC+2): 10:45 local → 08:45 UTC', () => {
    const inst = wallTimeToInstant('2026-08-06', '10:45', 'Europe/Brussels')
    expect(inst.toISOString()).toBe('2026-08-06T08:45:00.000Z')
  })

  it('Bruselas en invierno (CET, UTC+1): 10:00 local → 09:00 UTC', () => {
    const inst = wallTimeToInstant('2026-01-15', '10:00', 'Europe/Brussels')
    expect(inst.toISOString()).toBe('2026-01-15T09:00:00.000Z')
  })

  it('Ciudad de México (UTC-6, sin DST): 10:45 local → 16:45 UTC', () => {
    const inst = wallTimeToInstant('2026-08-06', '10:45', 'America/Mexico_City')
    expect(inst.toISOString()).toBe('2026-08-06T16:45:00.000Z')
  })

  it('UTC explícito: la hora de pared es el propio instante UTC', () => {
    const inst = wallTimeToInstant('2026-08-06', '10:45', 'UTC')
    expect(inst.toISOString()).toBe('2026-08-06T10:45:00.000Z')
  })

  it('zona inválida → cae al default (Bruselas) sin lanzar', () => {
    const inst = wallTimeToInstant('2026-08-06', '10:45', 'No/Existe')
    expect(inst.toISOString()).toBe('2026-08-06T08:45:00.000Z')
  })

  it('el tiempo restante real corregido coincide con el reporte (3h→~1h)', () => {
    // Cita 10:45 Bruselas; el job "3h" se disparó a las 07:40 UTC.
    const inst = wallTimeToInstant('2026-08-06', '10:45', 'Europe/Brussels')
    const envio = new Date('2026-08-06T07:40:00.000Z')
    const restanteMin = Math.round((inst - envio) / 60000)
    expect(restanteMin).toBe(65) // ~1 hora, no 3
  })
})

describe('esZonaHorariaValida', () => {
  it('acepta zonas IANA reales', () => {
    expect(esZonaHorariaValida('Europe/Brussels')).toBe(true)
    expect(esZonaHorariaValida('America/Mexico_City')).toBe(true)
    expect(esZonaHorariaValida('UTC')).toBe(true)
  })
  it('rechaza cadenas inválidas', () => {
    expect(esZonaHorariaValida('No/Existe')).toBe(false)
    expect(esZonaHorariaValida('')).toBe(false)
    expect(esZonaHorariaValida(null)).toBe(false)
  })
  it('exporta un default sensato', () => {
    expect(ZONA_HORARIA_DEFAULT).toBe('Europe/Brussels')
  })
})

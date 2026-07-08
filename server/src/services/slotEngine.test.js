import { describe, it, expect } from 'vitest'
import { generarSlots, slotsDisponibles, validarReserva } from './slotEngine.js'

const FECHA = '2026-07-01'

describe('generarSlots', () => {
  it('rango exacto de 90 min genera 2 slots correctos', () => {
    const slots = generarSlots({ fecha: FECHA, horaInicio: '09:00', horaFin: '10:30' })
    expect(slots).toEqual([
      { horaInicio: '09:00', horaFin: '09:45' },
      { horaInicio: '09:45', horaFin: '10:30' },
    ])
  })

  it('rango de 100 min genera solo 2 slots (descarta el sobrante de 10 min)', () => {
    // 09:00 -> 10:40 = 100 min. Caben 2 slots (90 min); los 10 restantes se descartan.
    const slots = generarSlots({ fecha: FECHA, horaInicio: '09:00', horaFin: '10:40' })
    expect(slots).toEqual([
      { horaInicio: '09:00', horaFin: '09:45' },
      { horaInicio: '09:45', horaFin: '10:30' },
    ])
  })

  it('respeta la duración de la franja (duracionMinutos: 60 → bloques de 60 min)', () => {
    // 10:00 -> 12:00 con franja de 60 min: 2 bloques completos, NO 45+resto.
    const slots = generarSlots({
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '12:00',
      duracionMinutos: 60,
    })
    expect(slots).toEqual([
      { horaInicio: '10:00', horaFin: '11:00' },
      { horaInicio: '11:00', horaFin: '12:00' },
    ])
  })

  it('un bloque de exactamente 60 min NO se fragmenta en 45 + 15', () => {
    const slots = generarSlots({
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '11:00',
      duracionMinutos: 60,
    })
    expect(slots).toEqual([{ horaInicio: '10:00', horaFin: '11:00' }])
  })
})

describe('duración personalizada al reservar', () => {
  it('slotsDisponibles usa la duración real de cada franja (60 min)', () => {
    const disponibilidades = [
      { fecha: FECHA, horaInicio: '10:00', horaFin: '11:00', duracionMinutos: 60 },
    ]
    const libres = slotsDisponibles(disponibilidades, [], FECHA)
    expect(libres).toEqual([{ horaInicio: '10:00', horaFin: '11:00' }])
  })

  it('reservar un bloque de 60 min se valida como un único slot completo', () => {
    const disponibilidades = [
      { fecha: FECHA, horaInicio: '10:00', horaFin: '12:00', duracionMinutos: 60 },
    ]
    const libres = slotsDisponibles(disponibilidades, [], FECHA)
    // El paciente elige el bloque completo de 60 min tal como lo ve.
    const res = validarReserva({
      tipoPaciente: 'NUEVO',
      slotsElegidos: [{ horaInicio: '10:00', horaFin: '11:00' }],
      slotsDisponibles: libres,
    })
    expect(res).toEqual({ valido: true })
  })

  it('una cita de 60 min bloquea exactamente su bloque, no un slot de 45', () => {
    const disponibilidades = [
      { fecha: FECHA, horaInicio: '10:00', horaFin: '12:00', duracionMinutos: 60 },
    ]
    const citas = [
      { fecha: FECHA, horaInicio: '10:00', horaFin: '11:00', estado: 'CONFIRMADA' },
    ]
    const libres = slotsDisponibles(disponibilidades, citas, FECHA)
    expect(libres).toEqual([{ horaInicio: '11:00', horaFin: '12:00' }])
  })
})

describe('slotsDisponibles', () => {
  const disponibilidades = [
    { fecha: FECHA, horaInicio: '09:00', horaFin: '10:30' }, // 2 slots
  ]

  it('excluye un slot ocupado por una cita CONFIRMADA', () => {
    const citas = [
      { fecha: FECHA, horaInicio: '09:00', horaFin: '09:45', estado: 'CONFIRMADA' },
    ]
    const libres = slotsDisponibles(disponibilidades, citas, FECHA)
    expect(libres).toEqual([{ horaInicio: '09:45', horaFin: '10:30' }])
  })

  it('NO excluye un slot de una cita ANULADA', () => {
    const citas = [
      { fecha: FECHA, horaInicio: '09:00', horaFin: '09:45', estado: 'ANULADA' },
    ]
    const libres = slotsDisponibles(disponibilidades, citas, FECHA)
    expect(libres).toEqual([
      { horaInicio: '09:00', horaFin: '09:45' },
      { horaInicio: '09:45', horaFin: '10:30' },
    ])
  })
})

describe('validarReserva', () => {
  // Conjunto de slots libres usado en las validaciones.
  const disponibles = [
    { horaInicio: '09:00', horaFin: '09:45' },
    { horaInicio: '09:45', horaFin: '10:30' },
    { horaInicio: '11:00', horaFin: '11:45' }, // separado (no consecutivo con los anteriores)
  ]

  it('rechaza a un paciente NUEVO que intenta 2 slots', () => {
    const res = validarReserva({
      tipoPaciente: 'NUEVO',
      slotsElegidos: [disponibles[0], disponibles[1]],
      slotsDisponibles: disponibles,
    })
    expect(res.valido).toBe(false)
    expect(res.error).toMatch(/nuevo/i)
  })

  it('acepta a un paciente CONTINUIDAD con 2 slots consecutivos', () => {
    const res = validarReserva({
      tipoPaciente: 'CONTINUIDAD',
      slotsElegidos: [disponibles[0], disponibles[1]],
      slotsDisponibles: disponibles,
    })
    expect(res).toEqual({ valido: true })
  })

  it('rechaza a un paciente CONTINUIDAD con 2 slots NO consecutivos', () => {
    const res = validarReserva({
      tipoPaciente: 'CONTINUIDAD',
      slotsElegidos: [disponibles[0], disponibles[2]], // 09:00-09:45 y 11:00-11:45
      slotsDisponibles: disponibles,
    })
    expect(res.valido).toBe(false)
    expect(res.error).toMatch(/consecutiv/i)
  })

  it('rechaza si algún slot elegido no está en slotsDisponibles', () => {
    const res = validarReserva({
      tipoPaciente: 'NUEVO',
      slotsElegidos: [{ horaInicio: '14:00', horaFin: '14:45' }], // inexistente
      slotsDisponibles: disponibles,
    })
    expect(res.valido).toBe(false)
    expect(res.error).toMatch(/no está disponible/i)
  })
})

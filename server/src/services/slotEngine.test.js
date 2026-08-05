import { describe, it, expect } from 'vitest'
import {
  generarSlots,
  slotsDisponibles,
  validarReserva,
  slotsCombinados,
  asignarEmpleado,
} from './slotEngine.js'

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

// ── Modo NEGOCIO PRO: disponibilidad combinada del equipo ─────────────────────
describe('slotsCombinados', () => {
  const disp = (horaInicio, horaFin) => ({ fecha: FECHA, horaInicio, horaFin, duracionMinutos: 45 })

  it('une slots de dos empleados sin duplicar y sin perder ninguno', () => {
    // Empleado 1: 09:00-10:30 (2 slots). Empleado 2: 09:45-11:15 (2 slots).
    // El slot 09:45-10:30 lo ofrecen ambos → debe aparecer UNA sola vez.
    const empleadosData = [
      { empleadoId: 1, disponibilidades: [disp('09:00', '10:30')], citas: [] },
      { empleadoId: 2, disponibilidades: [disp('09:45', '11:15')], citas: [] },
    ]
    const combinados = slotsCombinados(empleadosData, FECHA)
    expect(combinados.map((s) => `${s.horaInicio}-${s.horaFin}`)).toEqual([
      '09:00-09:45',
      '09:45-10:30',
      '10:30-11:15',
    ])
    // El solapado lleva a los dos empleados; los otros a uno solo.
    const solapado = combinados.find((s) => s.horaInicio === '09:45')
    expect(solapado.empleadosLibres.sort()).toEqual([1, 2])
    expect(combinados.find((s) => s.horaInicio === '09:00').empleadosLibres).toEqual([1])
    expect(combinados.find((s) => s.horaInicio === '10:30').empleadosLibres).toEqual([2])
  })

  it('un slot sigue ofreciéndose si al menos un empleado está libre (el otro ocupado)', () => {
    // Ambos ofrecen 09:00-09:45; el empleado 1 lo tiene ocupado por una cita.
    const empleadosData = [
      {
        empleadoId: 1,
        disponibilidades: [disp('09:00', '09:45')],
        citas: [{ fecha: FECHA, horaInicio: '09:00', horaFin: '09:45', estado: 'CONFIRMADA' }],
      },
      { empleadoId: 2, disponibilidades: [disp('09:00', '09:45')], citas: [] },
    ]
    const combinados = slotsCombinados(empleadosData, FECHA)
    expect(combinados).toHaveLength(1)
    expect(combinados[0].empleadosLibres).toEqual([2]) // solo el 2 queda libre
  })

  it('un slot desaparece solo si TODOS los empleados lo tienen ocupado', () => {
    const empleadosData = [
      {
        empleadoId: 1,
        disponibilidades: [disp('09:00', '09:45')],
        citas: [{ fecha: FECHA, horaInicio: '09:00', horaFin: '09:45', estado: 'CONFIRMADA' }],
      },
      {
        empleadoId: 2,
        disponibilidades: [disp('09:00', '09:45')],
        citas: [{ fecha: FECHA, horaInicio: '09:00', horaFin: '09:45', estado: 'PENDIENTE' }],
      },
    ]
    expect(slotsCombinados(empleadosData, FECHA)).toEqual([])
  })
})

describe('asignarEmpleado', () => {
  const disp = (horaInicio, horaFin) => ({ fecha: FECHA, horaInicio, horaFin, duracionMinutos: 45 })
  const cita = (horaInicio, horaFin, estado = 'CONFIRMADA') => ({ fecha: FECHA, horaInicio, horaFin, estado })

  it('asigna el único empleado libre para el slot elegido', () => {
    const empleadosData = [
      { empleadoId: 1, disponibilidades: [disp('09:00', '09:45')], citas: [cita('09:00', '09:45')] },
      { empleadoId: 2, disponibilidades: [disp('09:00', '09:45')], citas: [] },
    ]
    const id = asignarEmpleado(empleadosData, [{ horaInicio: '09:00', horaFin: '09:45' }], FECHA)
    expect(id).toBe(2)
  })

  it('desempata por menos citas ese día', () => {
    // Ambos libres a las 10:00; el empleado 1 ya tiene una cita ese día, el 2 no.
    const empleadosData = [
      { empleadoId: 1, disponibilidades: [disp('09:00', '11:00')], citas: [cita('09:00', '09:45')] },
      { empleadoId: 2, disponibilidades: [disp('10:00', '11:00')], citas: [] },
    ]
    const id = asignarEmpleado(empleadosData, [{ horaInicio: '10:00', horaFin: '10:45' }], FECHA)
    expect(id).toBe(2) // menos carga
  })

  it('en empate total de carga, elige el de menor id (determinista)', () => {
    const empleadosData = [
      { empleadoId: 5, disponibilidades: [disp('09:00', '09:45')], citas: [] },
      { empleadoId: 3, disponibilidades: [disp('09:00', '09:45')], citas: [] },
    ]
    const id = asignarEmpleado(empleadosData, [{ horaInicio: '09:00', horaFin: '09:45' }], FECHA)
    expect(id).toBe(3)
  })

  it('cita doble: exige un mismo empleado libre en AMBOS bloques', () => {
    // Empleado 1 libre solo 09:00-09:45; empleado 2 libre solo 09:45-10:30.
    // Nadie cubre los dos bloques → no hay asignación posible.
    const empleadosData = [
      { empleadoId: 1, disponibilidades: [disp('09:00', '09:45')], citas: [] },
      { empleadoId: 2, disponibilidades: [disp('09:45', '10:30')], citas: [] },
    ]
    const elegidos = [
      { horaInicio: '09:00', horaFin: '09:45' },
      { horaInicio: '09:45', horaFin: '10:30' },
    ]
    expect(asignarEmpleado(empleadosData, elegidos, FECHA)).toBeNull()

    // Si el empleado 3 cubre ambos bloques, se le asigna a él.
    const conCobertura = [
      ...empleadosData,
      { empleadoId: 3, disponibilidades: [disp('09:00', '10:30')], citas: [] },
    ]
    expect(asignarEmpleado(conCobertura, elegidos, FECHA)).toBe(3)
  })

  it('devuelve null si ningún empleado está libre en el slot', () => {
    const empleadosData = [
      { empleadoId: 1, disponibilidades: [disp('09:00', '09:45')], citas: [cita('09:00', '09:45')] },
    ]
    expect(asignarEmpleado(empleadosData, [{ horaInicio: '09:00', horaFin: '09:45' }], FECHA)).toBeNull()
  })
})

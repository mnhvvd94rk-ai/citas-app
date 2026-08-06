import { describe, it, expect } from 'vitest'
import { construirMensaje } from './notificationService.js'

const base = { hora: '10:45', fechaLocal: '2026-08-06', profesional: 'Silski rachel' }

describe('RECORDATORIO_CITA — texto dinámico', () => {
  it('marca "3h" real (185 min) → "~3 horas" y hora exacta (ES)', () => {
    const m = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 185 }, 'ES')
    expect(m.texto).toContain('aproximadamente 3 horas')
    expect(m.texto).toContain('a las 10:45')
    expect(m.texto).toContain('2026-08-06')
  })

  it('cuando en realidad falta ~1h (65 min) NO dice "3 horas" (el bug reportado)', () => {
    const m = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 65 }, 'ES')
    expect(m.texto).toContain('aproximadamente 1 hora')
    expect(m.texto).not.toContain('3 horas')
  })

  it('marca "24h" (1440 min) → "mañana" (ES)', () => {
    const m = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 1440 }, 'ES')
    expect(m.texto).toContain('mañana')
  })

  it('marca "48h" (2885 min) → "2 días" (ES)', () => {
    const m = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 2885 }, 'ES')
    expect(m.texto).toContain('2 días')
  })

  it('respeta el idioma del cliente (FR)', () => {
    const m = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 185 }, 'FR')
    expect(m.texto).toContain('rendez-vous')
    expect(m.texto).toContain('environ 3 heures')
    expect(m.asunto).toContain('Rappel')
  })

  it('cita cercana → "Llega 10 minutos antes"; lejana → texto de cancelar', () => {
    const cerca = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 185 }, 'ES')
    expect(cerca.texto).toContain('Llega 10 minutos antes')
    const lejos = construirMensaje('RECORDATORIO_CITA', { ...base, minutosRestantes: 2885 }, 'ES')
    expect(lejos.texto).toContain('cancelar con antelación')
  })

  it('adjunta el enlace de videoconferencia si aplica', () => {
    const m = construirMensaje(
      'RECORDATORIO_CITA',
      { ...base, minutosRestantes: 185, enlaceVideoconferencia: 'https://meet.jit.si/x' },
      'ES',
    )
    expect(m.texto).toContain('https://meet.jit.si/x')
  })
})

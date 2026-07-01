// Módulo centralizado de llamadas HTTP al backend.
// - Base URL desde VITE_API_URL (fallback http://localhost:3001).
// - Adjunta Authorization: Bearer <token> desde localStorage automáticamente.
// - Manejo de errores consistente: lanza ApiError con .status y .message.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const TOKEN_KEY = 'citas_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status, detalles) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detalles = detalles
  }
}

/**
 * Realiza una petición al backend.
 * @param {string} path  ej. "/citas/mis-citas"
 * @param {{ method?: string, body?: any, auth?: boolean }} [opts]
 */
async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = getToken()
  if (auth && token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Fallo de red / servidor caído.
    throw new ApiError('No se pudo conectar con el servidor. ¿Está el backend activo?', 0)
  }

  // 204 sin cuerpo.
  if (res.status === 204) return null

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && data.error) ||
      (typeof data === 'string' && data) ||
      `Error ${res.status}`
    throw new ApiError(message, res.status, data && data.detalles)
  }

  return data
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  registroPaciente: (payload) =>
    request('/auth/registro-paciente', { method: 'POST', body: payload, auth: false }),
  loginPaciente: (correo, password) =>
    request('/auth/login-paciente', { method: 'POST', body: { correo, password }, auth: false }),
  loginMedico: (correo, password) =>
    request('/auth/login-medico', { method: 'POST', body: { correo, password }, auth: false }),
  me: () => request('/auth/me'),
}

// ── Citas ────────────────────────────────────────────────────────────────────
export const citasApi = {
  slotsDisponibles: (medicoId, fecha) =>
    request(`/citas/slots-disponibles?medicoId=${medicoId}&fecha=${fecha}`),
  reservar: (payload) => request('/citas/reservar', { method: 'POST', body: payload }),
  misCitas: () => request('/citas/mis-citas'),
  agenda: ({ fecha, estado } = {}) => {
    const qs = new URLSearchParams()
    if (fecha) qs.set('fecha', fecha)
    if (estado) qs.set('estado', estado)
    const q = qs.toString()
    return request(`/citas/agenda${q ? `?${q}` : ''}`)
  },
  aprobar: (id) => request(`/citas/${id}/aprobar`, { method: 'PATCH' }),
  anular: (id, notaAnulacion) =>
    request(`/citas/${id}/anular`, { method: 'PATCH', body: { notaAnulacion } }),
  completar: (id) => request(`/citas/${id}/completar`, { method: 'PATCH' }),
}

// ── Disponibilidad ───────────────────────────────────────────────────────────
export const disponibilidadApi = {
  listar: (fecha) => request(`/disponibilidad${fecha ? `?fecha=${fecha}` : ''}`),
  crear: (payload) => request('/disponibilidad', { method: 'POST', body: payload }),
  eliminar: (id) => request(`/disponibilidad/${id}`, { method: 'DELETE' }),
}

// ── Pacientes / notas ────────────────────────────────────────────────────────
export const pacientesApi = {
  listar: () => request('/pacientes'),
  notas: (pacienteId) => request(`/pacientes/${pacienteId}/notas`),
  agregarNota: (pacienteId, texto) =>
    request(`/pacientes/${pacienteId}/notas`, { method: 'POST', body: { texto } }),
}

export { BASE_URL }

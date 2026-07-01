import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi, getToken, setToken as persistToken } from '../services/api.js'

const AuthContext = createContext(null)

/** Normaliza la respuesta de /auth/me o de login a { tipo, user }. */
function normalize(payload) {
  if (!payload) return { tipo: null, user: null }
  const tipo = payload.tipo || (payload.usuario ? 'PACIENTE' : payload.medico ? 'MEDICO' : null)
  const user = payload.usuario || payload.medico || null
  return { tipo, user }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken())
  const [user, setUser] = useState(null)
  const [tipo, setTipo] = useState(null)
  const [loading, setLoading] = useState(true) // validando token al montar

  // Al montar (o si cambia el token) valida contra /auth/me.
  useEffect(() => {
    let cancelado = false
    async function validar() {
      if (!token) {
        setUser(null)
        setTipo(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const me = await authApi.me()
        if (cancelado) return
        const { tipo, user } = normalize(me)
        setUser(user)
        setTipo(tipo)
      } catch {
        // Token inválido/expirado: limpiar sesión.
        if (cancelado) return
        persistToken(null)
        setTokenState(null)
        setUser(null)
        setTipo(null)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    validar()
    return () => {
      cancelado = true
    }
  }, [token])

  const login = useCallback((newToken, payload) => {
    persistToken(newToken)
    const { tipo, user } = normalize(payload)
    setTokenState(newToken)
    setUser(user)
    setTipo(tipo)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    persistToken(null)
    setTokenState(null)
    setUser(null)
    setTipo(null)
  }, [])

  // Re-lee el usuario desde el backend (p.ej. tras cambiar de estado).
  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      const { tipo, user } = normalize(me)
      setUser(user)
      setTipo(tipo)
      return user
    } catch {
      return null
    }
  }, [])

  const value = {
    token,
    user,
    tipo,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!token && !!user,
    isPaciente: tipo === 'PACIENTE',
    isMedico: tipo === 'MEDICO',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

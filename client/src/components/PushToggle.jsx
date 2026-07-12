import { useEffect, useState } from 'react'
import { pushApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// Convierte la clave pública VAPID (base64url) al Uint8Array que exige
// pushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

const soportado =
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

// iOS/iPadOS: Safari solo permite Web Push cuando la app está instalada en la
// pantalla de inicio (standalone). En una pestaña normal, subscribe() falla (o
// PushManager ni existe en iOS < 16.4). Detectamos ese caso para mostrar una
// guía en vez de fallar. iPadOS moderno se reporta como "MacIntel" con touch.
const esIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** ¿La app corre instalada (standalone), no en una pestaña del navegador? */
function esStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true // iOS (Safari legacy)
  )
}

// Toggle "Activar notificaciones" reutilizable para el panel del cliente y del
// profesional. Refleja el estado real de la suscripción al cargar.
export default function PushToggle({ className = '' }) {
  const { t } = useLanguage()
  // estado: 'cargando' | 'activo' | 'inactivo' | 'bloqueado' | 'ios-no-instalado' | 'no-soportado'
  const [estado, setEstado] = useState(() => {
    if (esIOS && !esStandalone()) return 'ios-no-instalado'
    if (!soportado || !VAPID_PUBLIC_KEY) return 'no-soportado'
    return 'cargando'
  })
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // iOS sin instalar: no se intenta suscribir; se muestra la guía de instalación.
    if (esIOS && !esStandalone()) {
      setEstado('ios-no-instalado')
      return
    }
    if (!soportado || !VAPID_PUBLIC_KEY) {
      setEstado('no-soportado')
      return
    }
    let cancelado = false
    ;(async () => {
      try {
        if (Notification.permission === 'denied') {
          if (!cancelado) setEstado('bloqueado')
          return
        }
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelado) setEstado(sub ? 'activo' : 'inactivo')
      } catch {
        if (!cancelado) setEstado('inactivo')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  async function activar() {
    setError(null)
    setProcesando(true)
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'inactivo')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await pushApi.subscribe(sub.toJSON())
      setEstado('activo')
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setProcesando(false)
    }
  }

  async function desactivar() {
    setError(null)
    setProcesando(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { endpoint } = sub
        await sub.unsubscribe()
        await pushApi.unsubscribe(endpoint)
      }
      setEstado('inactivo')
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setProcesando(false)
    }
  }

  if (estado === 'no-soportado') return null

  // iOS/iPadOS en pestaña normal: hay que instalar la app antes de poder activar push.
  if (estado === 'ios-no-instalado') {
    return <p className={`text-xs text-navy-500 ${className}`}>📲 {t('push.iosInstall')}</p>
  }

  const base =
    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60'

  return (
    <div className={className}>
      {estado === 'bloqueado' ? (
        <p className="text-xs text-navy-500">🔕 {t('push.blocked')}</p>
      ) : estado === 'activo' ? (
        <button
          onClick={desactivar}
          disabled={procesando}
          className={`${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100`}
        >
          🔔 {procesando ? t('push.working') : t('push.enabled')}
        </button>
      ) : (
        <button
          onClick={activar}
          disabled={procesando || estado === 'cargando'}
          className={`${base} bg-navy-50 text-navy-700 ring-1 ring-navy-200 hover:bg-navy-100`}
        >
          🔔 {procesando ? t('push.working') : t('push.enable')}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

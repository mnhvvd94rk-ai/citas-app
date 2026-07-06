import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'

// Captura de foto del documento con la cámara (getUserMedia).
// Fallback: <input type="file" capture="environment"> para móviles sin soporte.
// Downscala a máx 1000px y exporta JPEG (q=0.7) para no exceder el body del POST.
export default function CameraCapture({ value, onCapture }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [activo, setActivo] = useState(false)
  const [error, setError] = useState(null)

  function detener() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setActivo(false)
  }

  useEffect(() => detener, [])

  async function abrirCamara() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('camera.errUnsupported'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setActivo(true)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch {
      setError(t('camera.errAccess'))
    }
  }

  function reducirYExportar(source, w, h) {
    const maxLado = 1000
    const escala = Math.min(1, maxLado / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * escala)
    canvas.height = Math.round(h * escala)
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  }

  function tomarFoto() {
    const video = videoRef.current
    if (!video) return
    onCapture(reducirYExportar(video, video.videoWidth, video.videoHeight))
    detener()
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => onCapture(reducirYExportar(img, img.width, img.height))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const primary =
    'w-full rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800'
  const secondary =
    'w-full rounded-xl border border-navy-200 py-3 text-sm font-medium text-navy-700 transition hover:bg-navy-50'

  return (
    <div className="space-y-3">
      {value ? (
        <div className="space-y-3">
          <img src={value} alt="" className="mx-auto max-h-64 rounded-xl border border-navy-100 object-contain" />
          <button type="button" onClick={() => onCapture(null)} className={secondary}>
            {t('camera.recapture')}
          </button>
        </div>
      ) : activo ? (
        <div className="space-y-3">
          <video ref={videoRef} playsInline muted className="w-full rounded-xl border border-navy-100 bg-black" />
          <div className="flex gap-2">
            <button type="button" onClick={tomarFoto} className={primary}>
              {t('camera.take')}
            </button>
            <button type="button" onClick={detener} className="rounded-xl border border-navy-200 px-4 text-sm font-medium text-navy-700 hover:bg-navy-50">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-navy-200 bg-navy-50 py-12 text-navy-300">
            <p className="text-sm">{t('camera.noPhoto')}</p>
          </div>
          <button type="button" onClick={abrirCamara} className={primary}>
            {t('camera.open')}
          </button>
          <label className="block w-full cursor-pointer rounded-xl border border-navy-200 py-3 text-center text-sm font-medium text-navy-700 transition hover:bg-navy-50">
            {t('camera.upload')}
            <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
          </label>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

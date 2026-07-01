import { useEffect, useRef, useState } from 'react'

// Captura de foto del documento con la cámara (getUserMedia).
// Fallback: <input type="file" capture="environment"> para móviles sin soporte.
// Downscala a máx 1000px y exporta JPEG (q=0.7) para no exceder el body del POST.
export default function CameraCapture({ value, onCapture }) {
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

  useEffect(() => detener, []) // limpia el stream al desmontar

  async function abrirCamara() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este dispositivo no soporta cámara en el navegador. Usa "Subir imagen".')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setActivo(true)
      // El <video> se monta al pasar `activo` a true.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch {
      setError('No se pudo acceder a la cámara. Revisa permisos o usa "Subir imagen".')
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
    const dataUrl = reducirYExportar(video, video.videoWidth, video.videoHeight)
    onCapture(dataUrl)
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

  return (
    <div className="space-y-3">
      {value ? (
        <div className="space-y-3">
          <img
            src={value}
            alt="Documento capturado"
            className="mx-auto max-h-64 rounded-lg border border-slate-200 object-contain"
          />
          <button
            type="button"
            onClick={() => onCapture(null)}
            className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Volver a capturar
          </button>
        </div>
      ) : activo ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full rounded-lg border border-slate-200 bg-black"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={tomarFoto}
              className="flex-1 rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700"
            >
              📸 Tomar foto
            </button>
            <button
              type="button"
              onClick={detener}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-slate-400">
            <span className="text-4xl">🪪</span>
            <p className="mt-2 text-sm">Sin foto todavía</p>
          </div>
          <button
            type="button"
            onClick={abrirCamara}
            className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700"
          >
            📷 Abrir cámara
          </button>
          <label className="block w-full cursor-pointer rounded-lg border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
            Subir imagen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="hidden"
            />
          </label>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

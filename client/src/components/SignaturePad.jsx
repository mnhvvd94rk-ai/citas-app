import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'

// Firma digital en canvas (táctil o mouse). Exporta PNG con "Confirmar firma".
export default function SignaturePad({ value, onConfirm }) {
  const { t } = useLanguage()
  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  const [vacio, setVacio] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#101f33'
  }, [])

  function posicion(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const punto = e.touches ? e.touches[0] : e
    return { x: punto.clientX - rect.left, y: punto.clientY - rect.top }
  }

  function empezar(e) {
    e.preventDefault()
    dibujando.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = posicion(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function mover(e) {
    if (!dibujando.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = posicion(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (vacio) setVacio(false)
  }

  function terminar() {
    dibujando.current = false
  }

  function limpiar() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
    onConfirm(null)
  }

  function confirmar() {
    if (vacio) return
    onConfirm(canvasRef.current.toDataURL('image/png'))
  }

  if (value) {
    return (
      <div className="space-y-3">
        <img src={value} alt="" className="mx-auto h-40 w-full rounded-xl border border-navy-100 bg-white object-contain" />
        <button
          type="button"
          onClick={() => onConfirm(null)}
          className="w-full rounded-xl border border-navy-200 py-3 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
        >
          {t('signature.resign')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-navy-200 bg-white"
        onMouseDown={empezar}
        onMouseMove={mover}
        onMouseUp={terminar}
        onMouseLeave={terminar}
        onTouchStart={empezar}
        onTouchMove={mover}
        onTouchEnd={terminar}
      />
      <p className="text-center text-xs text-navy-400">{t('signature.hint')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          className="flex-1 rounded-xl border border-navy-200 py-3 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
        >
          {t('signature.clear')}
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={vacio}
          className="flex-1 rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-200"
        >
          {t('signature.confirm')}
        </button>
      </div>
    </div>
  )
}

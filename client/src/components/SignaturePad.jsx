import { useEffect, useRef, useState } from 'react'

// Firma digital en canvas (táctil o mouse). Exporta PNG con "Confirmar firma".
export default function SignaturePad({ value, onConfirm }) {
  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  const [vacio, setVacio] = useState(true)

  // Prepara el canvas al montar (resolución acorde al tamaño en pantalla).
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
    ctx.strokeStyle = '#0f172a'
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
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
    onConfirm(null)
  }

  function confirmar() {
    if (vacio) return
    onConfirm(canvasRef.current.toDataURL('image/png'))
  }

  // Si ya hay una firma confirmada, muéstrala como preview.
  if (value) {
    return (
      <div className="space-y-3">
        <img
          src={value}
          alt="Firma"
          className="mx-auto h-40 w-full rounded-lg border border-slate-200 bg-white object-contain"
        />
        <button
          type="button"
          onClick={() => onConfirm(null)}
          className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Volver a firmar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
        onMouseDown={empezar}
        onMouseMove={mover}
        onMouseUp={terminar}
        onMouseLeave={terminar}
        onTouchStart={empezar}
        onTouchMove={mover}
        onTouchEnd={terminar}
      />
      <p className="text-center text-xs text-slate-400">Firma con el dedo o el ratón</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={vacio}
          className="flex-1 rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Confirmar firma
        </button>
      </div>
    </div>
  )
}

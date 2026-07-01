import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import CameraCapture from '../components/CameraCapture.jsx'
import SignaturePad from '../components/SignaturePad.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

const PASOS = ['Documento', 'Datos', 'Firma', 'Cuenta', 'Términos', 'Resumen']

const TERMINOS = `Al crear tu cuenta aceptas el tratamiento de tus datos personales y de \
salud con la finalidad de gestionar tus citas médicas. Tus datos (documento de \
identidad, firma y contacto) se almacenan de forma segura y no se comparten con \
terceros salvo obligación legal. Puedes solicitar su rectificación o eliminación \
en cualquier momento. Este es un texto de ejemplo para el entorno de desarrollo.`

export default function RegistroPaciente() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [paso, setPaso] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const [foto, setFoto] = useState(null)
  const [firma, setFirma] = useState(null)
  const [datos, setDatos] = useState({ nombre: '', apellido: '', documentoIdentidad: '', telefono: '' })
  const [cuenta, setCuenta] = useState({ correo: '', password: '', confirmar: '' })
  const [acepta, setAcepta] = useState(false)

  function setCampo(setter) {
    return (e) => setter((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Validación por paso: devuelve mensaje de error o null.
  function validarPaso() {
    switch (paso) {
      case 0:
        return foto ? null : 'Captura o sube una foto del documento para continuar.'
      case 1:
        if (!datos.nombre.trim()) return 'El nombre es obligatorio.'
        if (!datos.apellido.trim()) return 'El apellido es obligatorio.'
        if (!datos.documentoIdentidad.trim()) return 'El documento de identidad es obligatorio.'
        if (!datos.telefono.trim()) return 'El teléfono es obligatorio.'
        return null
      case 2:
        return firma ? null : 'Firma y confirma para continuar.'
      case 3:
        if (!/^\S+@\S+\.\S+$/.test(cuenta.correo)) return 'Ingresa un correo válido.'
        if (cuenta.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
        if (cuenta.password !== cuenta.confirmar) return 'Las contraseñas no coinciden.'
        return null
      case 4:
        return acepta ? null : 'Debes aceptar los términos y condiciones.'
      default:
        return null
    }
  }

  function avanzar() {
    const err = validarPaso()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setPaso((p) => Math.min(p + 1, PASOS.length - 1))
  }

  function retroceder() {
    setError(null)
    setPaso((p) => Math.max(p - 1, 0))
  }

  async function crearCuenta() {
    setError(null)
    setEnviando(true)
    try {
      const payload = {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        documentoIdentidad: datos.documentoIdentidad.trim(),
        telefono: datos.telefono.trim(),
        correo: cuenta.correo.trim(),
        password: cuenta.password,
        fotoIdentidadUrl: foto || undefined,
        firmaUrl: firma || undefined,
      }
      const res = await authApi.registroPaciente(payload)
      login(res.token, res)
      navigate('/paciente/citas', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-teal-700 bg-teal-600 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link to="/" className="text-sm text-teal-100 hover:underline">← Salir</Link>
          <span className="font-semibold">Registro de paciente</span>
          <span className="text-sm text-teal-100">{paso + 1}/{PASOS.length}</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4">
        {/* Indicador de progreso */}
        <div className="my-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm font-medium text-slate-600">
            Paso {paso + 1}: {PASOS[paso]}
          </p>
        </div>

        {error && <ErrorMessage error={error} className="mb-4" />}

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {paso === 0 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-slate-800">Documento de identidad</h2>
              <p className="mb-4 text-sm text-slate-500">
                Toma una foto de tu documento. El autorrelleno por OCR llegará más adelante; por
                ahora escribirás los datos en el siguiente paso.
              </p>
              <CameraCapture value={foto} onCapture={setFoto} />
            </div>
          )}

          {paso === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Tus datos</h2>
              {[
                { name: 'nombre', label: 'Nombre', placeholder: 'María' },
                { name: 'apellido', label: 'Apellido', placeholder: 'García' },
                { name: 'documentoIdentidad', label: 'Documento de identidad', placeholder: '12345678A' },
                { name: 'telefono', label: 'Teléfono', placeholder: '+34 600 000 000', type: 'tel' },
              ].map((f) => (
                <div key={f.name}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{f.label}</label>
                  <input
                    name={f.name}
                    type={f.type || 'text'}
                    value={datos[f.name]}
                    onChange={setCampo(setDatos)}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {paso === 2 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-slate-800">Firma digital</h2>
              <p className="mb-4 text-sm text-slate-500">Firma en el recuadro y confirma.</p>
              <SignaturePad value={firma} onConfirm={setFirma} />
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Datos de acceso</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Correo electrónico</label>
                <input
                  name="correo"
                  type="email"
                  value={cuenta.correo}
                  onChange={setCampo(setCuenta)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  value={cuenta.password}
                  onChange={setCampo(setCuenta)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Confirmar contraseña</label>
                <input
                  name="confirmar"
                  type="password"
                  value={cuenta.confirmar}
                  onChange={setCampo(setCuenta)}
                  placeholder="Repite la contraseña"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                />
              </div>
            </div>
          )}

          {paso === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Términos y condiciones</h2>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {TERMINOS}
              </div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acepta}
                  onChange={(e) => setAcepta(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700">
                  He leído y acepto los términos y condiciones y la política de privacidad.
                </span>
              </label>
            </div>
          )}

          {paso === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Revisa tus datos</h2>
              <div className="grid grid-cols-2 gap-3">
                <Resumen label="Documento (foto)" valor={foto ? '✅ Capturada' : '—'} />
                <Resumen label="Firma" valor={firma ? '✅ Registrada' : '—'} />
                <Resumen label="Nombre" valor={datos.nombre} />
                <Resumen label="Apellido" valor={datos.apellido} />
                <Resumen label="Documento" valor={datos.documentoIdentidad} />
                <Resumen label="Teléfono" valor={datos.telefono} />
                <Resumen label="Correo" valor={cuenta.correo} className="col-span-2" />
              </div>
              {foto && (
                <img src={foto} alt="Documento" className="mx-auto max-h-40 rounded-lg border border-slate-200" />
              )}
              <button
                onClick={crearCuenta}
                disabled={enviando}
                className="w-full rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
              >
                {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </div>
          )}
        </div>

        {/* Navegación */}
        <div className="mt-5 flex gap-3">
          {paso > 0 && (
            <button
              onClick={retroceder}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Atrás
            </button>
          )}
          {paso < PASOS.length - 1 && (
            <button
              onClick={avanzar}
              className="flex-1 rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Resumen({ label, valor, className = '' }) {
  return (
    <div className={`rounded-lg bg-slate-50 px-3 py-2 ${className}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="truncate text-sm font-medium text-slate-800">{valor || '—'}</p>
    </div>
  )
}

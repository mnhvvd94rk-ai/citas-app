import { useEffect, useRef, useState } from 'react'
import { empleadosApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import Disponibilidad from './Disponibilidad.jsx'

// Reduce la imagen elegida a un cuadrado máx. 512px y la exporta como JPEG base64
// (mismo criterio que la foto de perfil del profesional; el backend limita igual).
function archivoADataUrl(file, maxLado = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Avatar de empleado: foto si hay, si no la inicial del nombre.
function AvatarEmpleado({ empleado, size = 'h-12 w-12' }) {
  if (empleado.fotoUrl) {
    return <img src={empleado.fotoUrl} alt={empleado.nombre} className={`${size} rounded-full object-cover`} />
  }
  const inicial = (empleado.nombre || '?').trim().charAt(0).toUpperCase()
  return (
    <div className={`${size} flex items-center justify-center rounded-full bg-navy-100 font-bold text-navy-600`}>
      {inicial}
    </div>
  )
}

// Panel "Mi Equipo" (solo cuentas de negocio Pro). Lista de personas del negocio,
// alta/edición/activación, y disponibilidad por persona (reutiliza el componente
// Disponibilidad acotado por empleadoId).
export default function Equipo() {
  const { t } = useLanguage()
  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  // Formulario de alta/edición. `editando` = empleado en edición | 'nuevo' | null.
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', bio: '', fotoUrl: null })
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const fileRef = useRef(null)

  // Empleado cuya disponibilidad se está configurando (null = lista).
  const [gestionando, setGestionando] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setLista(await empleadosApi.listar())
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirNuevo() {
    setForm({ nombre: '', bio: '', fotoUrl: null })
    setErrorForm(null)
    setEditando('nuevo')
  }

  function abrirEdicion(emp) {
    setForm({ nombre: emp.nombre, bio: emp.bio || '', fotoUrl: emp.fotoUrl || null })
    setErrorForm(null)
    setEditando(emp)
  }

  async function elegirFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await archivoADataUrl(file)
      setForm((f) => ({ ...f, fotoUrl: dataUrl }))
    } catch {
      setErrorForm(new Error(t('common.genericError')))
    }
  }

  async function guardar() {
    setErrorForm(null)
    if (!form.nombre.trim()) return setErrorForm(new Error(t('team.nameRequired')))
    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        bio: form.bio.trim() || null,
        fotoUrl: form.fotoUrl || null,
      }
      if (editando === 'nuevo') await empleadosApi.crear(payload)
      else await empleadosApi.actualizar(editando.id, payload)
      setEditando(null)
      await cargar()
    } catch (err) {
      setErrorForm(err)
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(emp) {
    if (emp.activo && !window.confirm(t('team.confirmDeactivate', { name: emp.nombre }))) return
    try {
      if (emp.activo) await empleadosApi.eliminar(emp.id)
      else await empleadosApi.actualizar(emp.id, { activo: true })
      await cargar()
    } catch (err) {
      setError(err)
    }
  }

  // ── Vista de disponibilidad de una persona ──────────────────────────────────
  if (gestionando) {
    return (
      <div>
        <button
          onClick={() => setGestionando(null)}
          className="text-sm font-medium text-navy-500 hover:text-navy-700"
        >
          {t('team.backToTeam')}
        </button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-800">
          {t('team.availabilityFor', { name: gestionando.nombre })}
        </h1>
        <div className="mt-4">
          {/* key fuerza el remontaje al cambiar de persona: recarga su disponibilidad. */}
          <Disponibilidad key={gestionando.id} empleadoId={gestionando.id} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('team.title')}</h1>
          <p className="mt-1 text-sm text-navy-500">{t('team.subtitle')}</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="shrink-0 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
        >
          {t('team.addMember')}
        </button>
      </div>

      {error && <ErrorMessage error={error} onRetry={cargar} className="mt-4" />}

      {cargando ? (
        <Spinner />
      ) : lista.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-navy-200 bg-white py-10 text-center text-navy-500">
          {t('team.empty')}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {lista.map((emp) => (
            <li
              key={emp.id}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm ${
                emp.activo ? 'border-navy-100' : 'border-navy-100 opacity-60'
              }`}
            >
              <AvatarEmpleado empleado={emp} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-800">{emp.nombre}</p>
                {emp.bio && <p className="mt-0.5 truncate text-sm text-navy-500">{emp.bio}</p>}
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    emp.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-navy-100 text-navy-500'
                  }`}
                >
                  {emp.activo ? t('team.active') : t('team.inactive')}
                </span>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                {emp.activo && (
                  <button
                    onClick={() => setGestionando(emp)}
                    className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-100"
                  >
                    {t('team.manageAvailability')}
                  </button>
                )}
                <button
                  onClick={() => abrirEdicion(emp)}
                  className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-100"
                >
                  {t('team.edit')}
                </button>
                <button
                  onClick={() => toggleActivo(emp)}
                  className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-100"
                >
                  {emp.activo ? t('team.deactivate') : t('team.activate')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de alta/edición */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy-800">
              {editando === 'nuevo' ? t('team.newMember') : t('team.editMember')}
            </h2>

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <AvatarEmpleado empleado={{ nombre: form.nombre, fotoUrl: form.fotoUrl }} size="h-16 w-16" />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-100"
                  >
                    {t('team.photo')}
                  </button>
                  {form.fotoUrl && (
                    <button
                      onClick={() => setForm((f) => ({ ...f, fotoUrl: null }))}
                      className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-500 transition hover:bg-navy-100"
                    >
                      {t('team.removePhoto')}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={elegirFoto} className="hidden" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('team.name')}</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('team.bio')}</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={2}
                  placeholder={t('team.bioPlaceholder')}
                  className={inputCls}
                />
              </div>

              {errorForm && <ErrorMessage error={errorForm} />}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setEditando(null)}
                className="flex-1 rounded-xl bg-navy-50 py-3 font-semibold text-navy-700 transition hover:bg-navy-100"
              >
                {t('team.cancel')}
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex-1 rounded-xl bg-navy-700 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {guardando ? t('team.saving') : t('team.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

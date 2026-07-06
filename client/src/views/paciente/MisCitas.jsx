import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { citasApi } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import Navbar from '../../components/Navbar.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorMessage from '../../components/ErrorMessage.jsx'
import EstadoBadge from '../../components/EstadoBadge.jsx'
import { formatFechaLarga } from '../../lib/format.js'

// Panel del cliente: lista de sus citas + acceso a reservar.
export default function MisCitas() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setCitas(await citasApi.misCitas())
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  return (
    <div className="min-h-screen bg-navy-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-navy-800">{t('dashboard.title')}</h1>
          <button
            onClick={() => navigate('/paciente/nueva-cita')}
            className="rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-900/15 transition hover:bg-navy-800"
          >
            {t('dashboard.newAppt')}
          </button>
        </div>

        {cargando ? (
          <Spinner label={t('dashboard.loading')} />
        ) : error ? (
          <ErrorMessage error={error} onRetry={cargar} />
        ) : citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-16 text-center">
            <p className="text-navy-500">{t('dashboard.empty')}</p>
            <button
              onClick={() => navigate('/paciente/nueva-cita')}
              className="mt-4 rounded-xl bg-navy-700 px-5 py-2.5 font-semibold text-white transition hover:bg-navy-800"
            >
              {t('dashboard.bookFirst')}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {citas.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy-800">{formatFechaLarga(c.fecha)}</p>
                    <p className="mt-1 text-sm text-navy-500">{c.horaInicio} – {c.horaFin}</p>
                    {c.medico && (
                      <p className="mt-1.5 text-sm font-medium text-navy-700">
                        {c.medico.nombre}
                        {c.medico.especialidad ? ` · ${c.medico.especialidad}` : ''}
                      </p>
                    )}
                    {c.notaAnulacion && (
                      <p className="mt-1.5 text-sm text-red-600">{t('dashboard.cancelReason')} {c.notaAnulacion}</p>
                    )}
                  </div>
                  <EstadoBadge estado={c.estado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

import { useState } from 'react'
import EstadoBadge from './EstadoBadge.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

// Card de cita para el profesional, con acciones según estado.
export default function CitaCard({ cita, onAprobar, onAnular, onCompletar, busy, mostrarMotivo }) {
  const { t } = useLanguage()
  const [anulando, setAnulando] = useState(false)
  const [nota, setNota] = useState('')
  const p = cita.paciente
  const esPendiente = cita.estado === 'PENDIENTE'
  const esConfirmada = cita.estado === 'CONFIRMADA'
  const bloqueado = busy === cita.id

  function confirmarAnulacion() {
    if (!nota.trim()) return
    onAnular(cita.id, nota.trim())
    setAnulando(false)
    setNota('')
  }

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy-800">{cita.horaInicio} – {cita.horaFin}</p>
          {p && <p className="mt-0.5 truncate text-sm text-navy-700">{p.nombre} {p.apellido}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {p?.estado && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.estado === 'NUEVO' ? 'bg-brand-100 text-brand-600' : 'bg-navy-100 text-navy-700'}`}>
                {p.estado === 'NUEVO' ? t('citaCard.newClient') : t('citaCard.returning')}
              </span>
            )}
            {p?.documentoIdentidad && (
              <span className="text-xs text-navy-400">{t('citaCard.doc')}: {p.documentoIdentidad}</span>
            )}
          </div>
          {mostrarMotivo && cita.motivoConsulta && (
            <p className="mt-2 rounded-xl bg-navy-50 px-3 py-2 text-sm text-navy-600">
              <span className="font-medium text-navy-500">{t('citaCard.description')}:</span> {cita.motivoConsulta}
            </p>
          )}
          {cita.notaAnulacion && (
            <p className="mt-1.5 text-sm text-red-600">{t('citaCard.cancelled')}: {cita.notaAnulacion}</p>
          )}
        </div>
        <EstadoBadge estado={cita.estado} />
      </div>

      {(esPendiente || esConfirmada) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-100 pt-3">
          {esPendiente && (
            <button disabled={bloqueado} onClick={() => onAprobar(cita.id)} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {t('citaCard.approve')}
            </button>
          )}
          {esConfirmada && (
            <button disabled={bloqueado} onClick={() => onCompletar(cita.id)} className="rounded-lg bg-navy-700 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50">
              {t('citaCard.complete')}
            </button>
          )}
          <button disabled={bloqueado} onClick={() => setAnulando((v) => !v)} className="rounded-lg border border-red-300 px-3.5 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50">
            {t('citaCard.cancel')}
          </button>
        </div>
      )}

      {anulando && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <label className="mb-1 block text-sm font-medium text-red-700">{t('citaCard.cancelReasonLabel')}</label>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder={t('citaCard.cancelReasonPlaceholder')} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none" />
          <div className="mt-2 flex gap-2">
            <button disabled={!nota.trim() || bloqueado} onClick={confirmarAnulacion} className="rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
              {t('citaCard.confirmCancel')}
            </button>
            <button onClick={() => { setAnulando(false); setNota('') }} className="rounded-lg border border-navy-200 px-3.5 py-1.5 text-sm font-medium text-navy-600 transition hover:bg-white">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

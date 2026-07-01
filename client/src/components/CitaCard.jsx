import { useState } from 'react'
import EstadoBadge from './EstadoBadge.jsx'

// Card de cita para el gestor, con acciones según estado.
// callbacks: onAprobar(id), onAnular(id, nota), onCompletar(id).
export default function CitaCard({ cita, onAprobar, onAnular, onCompletar, busy, mostrarMotivo }) {
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
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">
            🕒 {cita.horaInicio} – {cita.horaFin}
          </p>
          {p && (
            <p className="mt-0.5 truncate text-sm text-slate-700">
              {p.nombre} {p.apellido}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {p?.estado && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.estado === 'NUEVO' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
                }`}
              >
                {p.estado === 'NUEVO' ? 'Paciente nuevo' : 'Continuidad'}
              </span>
            )}
            {p?.documentoIdentidad && (
              <span className="text-xs text-slate-400">Doc: {p.documentoIdentidad}</span>
            )}
          </div>
          {mostrarMotivo && cita.motivoConsulta && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-500">Motivo:</span> {cita.motivoConsulta}
            </p>
          )}
          {cita.notaAnulacion && (
            <p className="mt-1 text-sm text-red-600">Anulación: {cita.notaAnulacion}</p>
          )}
        </div>
        <EstadoBadge estado={cita.estado} />
      </div>

      {(esPendiente || esConfirmada) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {esPendiente && (
            <button
              disabled={bloqueado}
              onClick={() => onAprobar(cita.id)}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Aprobar
            </button>
          )}
          {esConfirmada && (
            <button
              disabled={bloqueado}
              onClick={() => onCompletar(cita.id)}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Completar
            </button>
          )}
          <button
            disabled={bloqueado}
            onClick={() => setAnulando((v) => !v)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Anular
          </button>
        </div>
      )}

      {anulando && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="mb-1 block text-sm font-medium text-red-700">Motivo de la anulación</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Se enviará una notificación al paciente…"
            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-200 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={!nota.trim() || bloqueado}
              onClick={confirmarAnulacion}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar anulación
            </button>
            <button
              onClick={() => { setAnulando(false); setNota('') }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

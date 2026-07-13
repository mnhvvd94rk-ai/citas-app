import { useState } from 'react'
import { pacientesApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import Spinner from './Spinner.jsx'
import ErrorMessage from './ErrorMessage.jsx'

// Campos destino a los que el profesional mapea las columnas del archivo.
// `idioma` es opcional: si el archivo trae una columna de idioma por cliente.
const CAMPOS = ['nombre', 'apellido', 'telefono', 'correo', 'idioma']

// Variantes de encabezado para la columna de idioma (en cualquier idioma).
const IDIOMA_HEADERS = ['idioma', 'language', 'langue', 'lang']

// Diccionarios EXACTOS por idioma (encabezados normalizados → campo destino).
// No hay fuzzy matching: el encabezado normalizado debe coincidir literalmente
// con alguna de las variantes listadas. "OTRO" no autodetecta nada.
const DICCIONARIOS = {
  ES: {
    nombre: ['nombre'],
    apellido: ['apellido'],
    telefono: ['telefono'],
    correo: ['correo', 'email'],
    idioma: IDIOMA_HEADERS,
  },
  EN: {
    nombre: ['first name', 'name'],
    apellido: ['last name', 'surname'],
    telefono: ['phone', 'telephone'],
    correo: ['email'],
    idioma: IDIOMA_HEADERS,
  },
  FR: {
    nombre: ['prenom'],
    apellido: ['nom'],
    telefono: ['telephone'],
    correo: ['email', 'e-mail'],
    idioma: IDIOMA_HEADERS,
  },
}

// Normaliza el VALOR de una celda de idioma a ES/EN/FR (o null si no se reconoce).
function parseIdioma(v) {
  const n = String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  if (['es', 'esp', 'espanol', 'spanish', 'espagnol'].includes(n)) return 'ES'
  if (['en', 'eng', 'ingles', 'english', 'anglais'].includes(n)) return 'EN'
  if (['fr', 'fra', 'frances', 'francais', 'french'].includes(n)) return 'FR'
  return null
}

const IDIOMAS = [
  { code: 'ES', key: 'spanish' },
  { code: 'EN', key: 'english' },
  { code: 'FR', key: 'french' },
  { code: 'OTRO', key: 'other' },
]

// Normaliza un encabezado para la comparación exacta: minúsculas, sin acentos,
// sin espacios sobrantes.
function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Sugiere el mapeo campo→índice de columna con el diccionario exacto del idioma.
// Para "OTRO" devuelve todo vacío (mapeo manual).
function sugerirMapeo(headers, idioma) {
  const vacio = { nombre: '', apellido: '', telefono: '', correo: '', idioma: '' }
  const dict = DICCIONARIOS[idioma]
  if (!dict) return vacio
  const normHeaders = headers.map(norm)
  const mapeo = { ...vacio }
  for (const campo of CAMPOS) {
    const idx = normHeaders.findIndex((h) => h && dict[campo].includes(h))
    if (idx !== -1) mapeo[campo] = idx
  }
  return mapeo
}

// Parsea el archivo a { headers: string[], rows: string[][] }.
async function parseArchivo(file) {
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith('.csv') || file.type === 'text/csv') {
    const { default: Papa } = await import('papaparse')
    const text = await file.text()
    const { data } = Papa.parse(text, { skipEmptyLines: true })
    const headers = (data[0] || []).map((h) => String(h ?? '').trim())
    return { headers, rows: data.slice(1) }
  }
  // Excel (.xlsx / .xls)
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
  const headers = (aoa[0] || []).map((h) => String(h ?? '').trim())
  return { headers, rows: aoa.slice(1) }
}

export default function ImportarClientesModal({ onClose, onImported }) {
  const { t } = useLanguage()
  const [paso, setPaso] = useState('upload') // upload | lang | preview | result
  const [datos, setDatos] = useState(null) // { headers, rows }
  const [idioma, setIdioma] = useState(null)
  const [mapeo, setMapeo] = useState({ nombre: '', apellido: '', telefono: '', correo: '', idioma: '' })
  const [idiomaLote, setIdiomaLote] = useState('') // idioma preferido del lote (obligatorio)
  const [error, setError] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const parsed = await parseArchivo(file)
      if (!parsed.headers.length) {
        setError({ message: t('clients.import.noColumns') })
        return
      }
      setDatos(parsed)
      setPaso('lang')
    } catch {
      setError({ message: t('clients.import.parseError') })
    }
  }

  function elegirIdioma(code) {
    setIdioma(code)
    setMapeo(sugerirMapeo(datos.headers, code))
    setPaso('preview')
  }

  function setCampo(campo, valor) {
    setMapeo((prev) => ({ ...prev, [campo]: valor === '' ? '' : Number(valor) }))
  }

  async function confirmar() {
    if (mapeo.nombre === '' || !idiomaLote) return
    setImportando(true)
    setError(null)
    try {
      const clientes = []
      for (const row of datos.rows) {
        const valor = (campo) => (mapeo[campo] === '' ? '' : String(row[mapeo[campo]] ?? '').trim())
        const nombre = valor('nombre')
        if (!nombre) continue // el nombre es el mínimo obligatorio
        // Idioma: si hay columna de idioma y su valor se reconoce, se usa por
        // fila; si no, se aplica el idioma de lote elegido por el profesional.
        const idiomaFila = mapeo.idioma !== '' ? parseIdioma(row[mapeo.idioma]) : null
        clientes.push({
          nombre,
          apellido: valor('apellido'),
          telefono: valor('telefono'),
          correo: valor('correo'),
          idiomaPreferido: idiomaFila || idiomaLote,
        })
      }
      if (clientes.length === 0) {
        setError({ message: t('clients.import.noRows') })
        setImportando(false)
        return
      }
      const r = await pacientesApi.importar(clientes)
      setResultado(r)
      setPaso('result')
    } catch (err) {
      setError(err)
    } finally {
      setImportando(false)
    }
  }

  const nombreSinMapear = mapeo.nombre === ''
  const sinContacto = mapeo.telefono === '' && mapeo.correo === ''
  const preview = datos ? datos.rows.slice(0, 5) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold text-navy-800">{t('clients.import.title')}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-navy-400 hover:text-navy-700">×</button>
        </div>

        {error && <ErrorMessage error={error} className="mb-4" />}

        {/* ── Paso: subir archivo ─────────────────────────────────────────── */}
        {paso === 'upload' && (
          <div>
            <p className="mb-4 text-sm text-navy-500">{t('clients.import.uploadHint')}</p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-navy-200 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
              <span className="font-semibold text-navy-700">{t('clients.import.chooseFile')}</span>
              <span className="mt-1 text-xs text-navy-400">CSV · XLSX</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" />
            </label>
          </div>
        )}

        {/* ── Paso 1: idioma del archivo ───────────────────────────────────── */}
        {paso === 'lang' && (
          <div>
            <p className="mb-4 font-medium text-navy-700">{t('clients.selectFileLanguage')}</p>
            <div className="grid grid-cols-2 gap-3">
              {IDIOMAS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => elegirIdioma(l.code)}
                  className="rounded-xl border-2 border-navy-200 py-4 text-sm font-semibold text-navy-700 transition hover:border-brand-400 hover:bg-brand-50"
                >
                  {t('clients.' + l.key)}
                  {l.code === 'OTRO' && (
                    <span className="mt-0.5 block text-xs font-normal text-navy-400">
                      {t('clients.mapManually')}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-start">
              <button onClick={() => setPaso('upload')} className="text-sm font-semibold text-navy-500 hover:text-navy-800">
                ← {t('clients.import.back')}
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: vista previa + mapeo editable ────────────────────────── */}
        {paso === 'preview' && datos && (
          <div>
            <p className="font-medium text-navy-700">{t('clients.previewMapping')}</p>
            <p className="mb-4 text-sm text-navy-500">{t('clients.correctIfNeeded')}</p>

            <div className="overflow-x-auto rounded-xl ring-1 ring-navy-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-navy-50">
                    {CAMPOS.map((campo) => (
                      <th key={campo} className="p-2 align-top">
                        <div className="mb-1 text-xs font-bold text-navy-700">
                          {t('clients.import.field_' + campo)}
                          {campo === 'nombre' && <span className="text-red-500"> *</span>}
                        </div>
                        <select
                          value={mapeo[campo]}
                          onChange={(e) => setCampo(campo, e.target.value)}
                          className="w-full rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-xs focus:border-navy-500 focus:outline-none"
                        >
                          <option value="">{t('clients.import.noColumn')}</option>
                          {datos.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `#${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, ri) => (
                    <tr key={ri} className="border-t border-navy-100">
                      {CAMPOS.map((campo) => (
                        <td key={campo} className="p-2 text-navy-700">
                          {mapeo[campo] === '' ? <span className="text-navy-300">—</span> : String(row[mapeo[campo]] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-navy-400">
              {t('clients.import.totalRows', { n: datos.rows.length })}
            </p>

            {/* Avisos de validación */}
            {nombreSinMapear && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {t('clients.import.nameRequired')}
              </p>
            )}
            {!nombreSinMapear && sinContacto && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {t('clients.import.contactRecommended')}
              </p>
            )}

            {/* Idioma preferido de este lote (obligatorio). Si hay columna de
                idioma mapeada, se usa por fila y este valor es el respaldo. */}
            <div className="mt-4 rounded-xl border border-navy-100 bg-navy-50/50 p-3">
              <p className="mb-1 text-sm font-semibold text-navy-700">
                {t('clients.import.batchLanguage')} <span className="text-red-500">*</span>
              </p>
              <p className="mb-2 text-xs text-navy-500">
                {mapeo.idioma !== ''
                  ? t('clients.import.batchLanguageColumnNote')
                  : t('clients.import.batchLanguageHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                {[['ES', 'spanish'], ['EN', 'english'], ['FR', 'french']].map(([code, key]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setIdiomaLote(code)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                      idiomaLote === code
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-navy-200 text-navy-600 hover:border-brand-300'
                    }`}
                  >
                    {t('clients.' + key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setPaso('lang')} className="text-sm font-semibold text-navy-500 hover:text-navy-800">
                ← {t('clients.import.back')}
              </button>
              <button
                onClick={confirmar}
                disabled={nombreSinMapear || !idiomaLote || importando}
                className="rounded-lg bg-navy-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:bg-navy-300"
              >
                {importando ? t('clients.import.importing') : t('clients.import.confirm')}
              </button>
            </div>
            {importando && <Spinner label={t('clients.import.importing')} className="mt-3" />}
          </div>
        )}

        {/* ── Paso: resultado ──────────────────────────────────────────────── */}
        {paso === 'result' && resultado && (
          <div>
            <p className="mb-4 font-medium text-navy-700">{t('clients.import.doneTitle')}</p>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                <span>{t('clients.import.created')}</span> <b>{resultado.creados}</b>
              </li>
              {resultado.duplicados > 0 && (
                <li className="flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                  <span>{t('clients.import.duplicates')}</span> <b>{resultado.duplicados}</b>
                </li>
              )}
              {resultado.errores > 0 && (
                <li className="flex justify-between rounded-lg bg-red-50 px-3 py-2 text-red-600">
                  <span>{t('clients.import.errors')}</span> <b>{resultado.errores}</b>
                </li>
              )}
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => {
                  onImported?.()
                  onClose()
                }}
                className="rounded-lg bg-navy-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
              >
                {t('clients.import.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import EntrarConCodigo from '../components/EntrarConCodigo.jsx'

// Ruta /login-cliente (y su alias /login-paciente).
//
// El login real de cliente ocurre DENTRO del enlace de su profesional
// (/reservar/:slug), porque las cuentas son exclusivas por profesional y no es
// un marketplace: un login genérico no puede saber a qué profesional pertenece
// la cuenta (más aún si el identificador es un teléfono, que no es único global).
// Por eso esta pantalla no pide credenciales: solo explica que hay que usar el
// enlace del profesional.
export default function LoginPaciente() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-screen flex-col bg-navy-50 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-700">
          ← {t('common.back')}
        </Link>
        <LanguageSelector />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl shadow-navy-900/5 ring-1 ring-navy-100">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">
            🔗
          </div>
          <h1 className="mb-2 text-xl font-bold text-navy-800">{t('loginClient.needLinkTitle')}</h1>
          <p className="text-sm text-navy-500">{t('loginClient.needLinkMsg')}</p>

          {/* Salida real: si el cliente tiene el código de su profesional, lo
              escribe aquí y continúa hacia el enlace, en vez de quedarse atascado. */}
          <EntrarConCodigo />
        </div>
      </div>
    </div>
  )
}

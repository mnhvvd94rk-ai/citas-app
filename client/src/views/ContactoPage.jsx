import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { contactoApi } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import Logo from '../components/Logo.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

export default function ContactoPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', email: '', asunto: '', mensaje: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  const setCampo = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const valido =
    form.nombre.trim() && /^\S+@\S+\.\S+$/.test(form.email) && form.asunto.trim() && form.mensaje.trim()

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!valido) return setError(t('contact.required'))
    setEnviando(true)
    try {
      await contactoApi.enviar({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        asunto: form.asunto.trim(),
        mensaje: form.mensaje.trim(),
      })
      setOk(true)
    } catch {
      setError(t('contact.error'))
    } finally {
      setEnviando(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 transition focus:border-navy-500 focus:ring-4 focus:ring-navy-100 focus:outline-none'

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <button onClick={() => navigate('/landing')} aria-label="Ikatun"><Logo /></button>
          <LanguageSelector />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">{t('contact.title')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('contact.subtitle')}</p>

        {ok ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white">✓</div>
            <p className="mt-3 font-semibold text-emerald-700">{t('contact.success')}</p>
            <Link to="/landing" className="mt-4 inline-block text-sm font-semibold text-navy-700 hover:text-brand-600">
              {t('legal.backHome')}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error && <ErrorMessage error={error} />}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('contact.name')}</label>
              <input name="nombre" value={form.nombre} onChange={setCampo} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('contact.email')}</label>
              <input name="email" type="email" value={form.email} onChange={setCampo} className={inputCls} placeholder="tu@correo.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('contact.subject')}</label>
              <input name="asunto" value={form.asunto} onChange={setCampo} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700">{t('contact.message')}</label>
              <textarea name="mensaje" rows={5} value={form.mensaje} onChange={setCampo} className={inputCls} />
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-brand-500 py-3.5 font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-600 disabled:bg-navy-300"
            >
              {enviando ? t('contact.sending') : t('contact.send')}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

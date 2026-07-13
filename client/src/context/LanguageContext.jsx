import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import translations, { DEFAULT_LANG, LANGS } from '../i18n/translations.js'
import { setFormatLang } from '../lib/format.js'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'kohtun_lang'

/** Resuelve una ruta "a.b.c" dentro de un objeto. */
function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGS.some((l) => l.code === saved) ? saved : DEFAULT_LANG
  })

  // Mantiene el formateo de fechas (lib/format.js) en el mismo idioma que la UI.
  // Se hace en el cuerpo (no solo en efecto) para que ya esté aplicado en el
  // primer render y no aparezca la fecha en español un instante.
  setFormatLang(lang)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((code) => {
    if (LANGS.some((l) => l.code === code)) setLangState(code)
  }, [])

  /**
   * Traduce una clave "namespace.key". Cae a español y, si no existe, a la
   * propia clave. Soporta interpolación de {vars} en strings.
   */
  const t = useCallback(
    (key, vars) => {
      let value = resolve(translations[lang], key)
      if (value === undefined) value = resolve(translations[DEFAULT_LANG], key)
      if (value === undefined) return key
      if (typeof value === 'string' && vars) {
        return value.replace(/\{(\w+)\}/g, (_, v) => (vars[v] != null ? vars[v] : `{${v}}`))
      }
      return value
    },
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, langs: LANGS }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>')
  return ctx
}

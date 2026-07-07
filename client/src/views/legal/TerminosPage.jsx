import { useLanguage } from '../../context/LanguageContext.jsx'
import LegalDoc from './LegalDoc.jsx'

export default function TerminosPage() {
  const { t } = useLanguage()
  return <LegalDoc title={t('legal.termsTitle')} sections={t('legal.terms')} />
}

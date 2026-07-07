import { useLanguage } from '../../context/LanguageContext.jsx'
import LegalDoc from './LegalDoc.jsx'

export default function PrivacyPage() {
  const { t } = useLanguage()
  return <LegalDoc title={t('legal.privacyTitle')} sections={t('legal.privacy')} />
}

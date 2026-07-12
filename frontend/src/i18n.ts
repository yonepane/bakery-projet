import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export type Language = 'en' | 'fr' | 'ar';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) => import(`./locales/${language}.json`)))
  .init({
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'bakery_lang'
    },
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;

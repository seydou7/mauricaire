import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationFR from './locales/fr/translation.json';
import translationAR from './locales/ar/translation.json';

const resources = {
  fr: {
    translation: translationFR,
  },
  ar: {
    translation: translationAR,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'ar'],
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export function getNormalizedLanguage(lng?: string): 'ar' | 'fr' {
  const code = (lng || i18n.language || 'fr').toLowerCase();
  return code.startsWith('ar') ? 'ar' : 'fr';
}

export function syncDocumentDirection(lng?: string): void {
  const norm = getNormalizedLanguage(lng);
  const dir = norm === 'ar' ? 'rtl' : 'ltr';
  if (typeof document !== 'undefined') {
    document.documentElement.dir = dir;
    document.documentElement.lang = norm;
    try {
      localStorage.setItem('i18nextLng', norm);
    } catch {
      // ignore
    }
  }
}

// Update the `dir` and `lang` attributes on the html element whenever the language changes
i18n.on('languageChanged', (lng) => {
  syncDocumentDirection(lng);
});

// Set initial direction
syncDocumentDirection(i18n.language);

export default i18n;

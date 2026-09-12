import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(newLang);
  };

  return (
    <Button variant="outline" size="sm" onClick={toggleLanguage} className="mx-2">
      {i18n.language === 'fr' ? 'عربي' : 'Français'}
    </Button>
  );
}

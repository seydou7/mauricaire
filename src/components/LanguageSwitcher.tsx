import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { getNormalizedLanguage } from "@/i18n";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
}

export function LanguageSwitcher({
  className = "",
  variant = "outline",
  size = "sm",
  showIcon = true,
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const currentLang = getNormalizedLanguage(i18n.language);

  const toggleLanguage = () => {
    const nextLang = currentLang === "fr" ? "ar" : "fr";
    i18n.changeLanguage(nextLang);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleLanguage}
      className={`font-semibold rounded-xl transition-all gap-1.5 border border-border/50 hover:bg-primary/5 hover:border-primary/30 shrink-0 ${className}`}
      title={currentLang === "fr" ? "التبديل إلى العربية" : "Passer en Français"}
    >
      {showIcon && <Globe className="h-3.5 w-3.5 text-primary shrink-0" />}
      <span>{currentLang === "fr" ? "عربي" : "Français"}</span>
    </Button>
  );
}

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Sparkles, Mic } from "lucide-react";
import { VoiceAssistantModal } from "./VoiceAssistantModal";
import { Id } from "../../convex/_generated/dataModel";

interface VoiceAssistantFloatingButtonProps {
  onNavigateToSection?: (section: string, payload?: any) => void;
  activePatientId?: Id<"users"> | string | null;
  currentSection?: string;
}

export const VoiceAssistantFloatingButton: React.FC<VoiceAssistantFloatingButtonProps> = ({
  onNavigateToSection,
  activePatientId,
  currentSection,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-13 px-4 rounded-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white shadow-xl shadow-teal-700/25 border-2 border-white/80 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 group"
          title={t("voice_ai.btn_open_assistant", "Assistant Vocal & Écrit")}
        >
          <div className="relative">
            <Mic className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          </div>

          <span className="font-semibold text-xs tracking-wide hidden sm:inline">
            Voice AI
          </span>
        </Button>
      </div>

      <VoiceAssistantModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigateToSection={onNavigateToSection}
        activePatientId={(activePatientId || undefined) as Id<"users"> | undefined}
        currentSection={currentSection}
      />
    </>
  );
};

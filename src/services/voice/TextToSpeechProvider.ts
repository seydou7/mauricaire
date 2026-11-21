/**
 * MauriCare Voice AI — Text-to-Speech Provider Abstraction
 * Spoken response is strictly complementary: text always remains visible on screen.
 */

export interface TextToSpeechProvider {
  isSupported(): boolean;
  speak(
    text: string,
    language?: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): void;
  stop(): void;
}

export class WebSpeechTTSProvider implements TextToSpeechProvider {
  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(
    text: string,
    language: string = "fr-FR",
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): void {
    if (!this.isSupported()) {
      if (onError) onError("La synthèse vocale n'est pas supportée sur cet appareil.");
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stoppe toute lecture en cours

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "ar" ? "ar-SA" : "fr-FR";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Sélection d'une voix appropriée si disponible
      const voices = window.speechSynthesis.getVoices();
      const targetLang = language === "ar" ? "ar" : "fr";
      const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      if (onStart) utterance.onstart = onStart;
      if (onEnd) utterance.onend = onEnd;
      if (onError) utterance.onerror = (e) => onError(e.error);

      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      if (onError) onError(err?.message || "Erreur de synthèse vocale.");
    }
  }

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

// Instance singleton
export const defaultTTSProvider = new WebSpeechTTSProvider();

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Globe,
  PhoneOff,
  Keyboard,
  X,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Radio,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  defaultSTTManager,
  STTErrorDetails,
} from "../../services/voice/SpeechToTextProvider";
import { defaultTTSProvider } from "../../services/voice/TextToSpeechProvider";
import { ActionConfirmationCard } from "./ActionConfirmationCard";

type SessionState =
  | "idle"
  | "listening"
  | "transcribing"
  | "processing"
  | "speaking"
  | "error";

interface MessageItem {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: number;
  actionPreview?: any;
  actionPayload?: any;
  intent?: string;
  status?: string;
  interactionId?: Id<"assistantInteractions">;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSection?: (section: string, payload?: any) => void;
  activePatientId?: Id<"users">;
  currentSection?: string;
}

// Compteur déterministe pour les identifiants de messages
let messageCounter = 0;
function createMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}_${Date.now()}_${messageCounter}`;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigateToSection,
  activePatientId,
  currentSection,
}) => {
  const { t, i18n } = useTranslation();
  const language = (i18n.language && i18n.language.startsWith("ar")) ? "ar" : "fr";
  const isRtl = language === "ar";

  // Mutations, Requêtes & Actions Convex
  const processCommand = useMutation(api.voiceAssistant.processAssistantCommand);
  const executeAction = useMutation(api.voiceAssistant.executeConfirmedAssistantAction);
  const suggestions = useQuery(api.voiceAssistant.getAssistantSuggestions) || [];
  const sttCapabilities = useQuery(api.voiceAssistant.getVoiceSTTCapabilities);
  const transcribeAudioAction = useAction(api.voiceAssistant.transcribeRecordedAudio);

  const hasServerSTT = Boolean(sttCapabilities?.configured && sttCapabilities?.hasFallbackAudio);

  // États du cycle de vie de l'appel vocal immersif
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionProvider, setSessionProvider] = useState<"auto" | "browser" | "recorded">("auto");
  const [sttError, setSttError] = useState<STTErrorDetails | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isTextDrawerOpen, setIsTextDrawerOpen] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [sessionContext, setSessionContext] = useState<any>({});

  const textInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Liaison de l'action de transcription serveur avec le STT Provider d'enregistrement
  useEffect(() => {
    defaultSTTManager.setTranscribeDelegate(async ({ audioBase64, mimeType, language }) => {
      return await transcribeAudioAction({ audioBase64, mimeType, language });
    });
  }, [transcribeAudioAction]);

  // Synchronisation proactive de la capacité STT serveur : dès que le serveur est configuré (Groq),
  // recorded_audio devient le moteur vocal principal sans passer par le navigateur
  useEffect(() => {
    if (sttCapabilities !== undefined) {
      const isConfigured = Boolean(sttCapabilities?.configured && sttCapabilities?.hasFallbackAudio);
      defaultSTTManager.setServerSTTConfigured(isConfigured);
      if (isConfigured) {
        setSessionProvider("recorded");
      }
    }
  }, [sttCapabilities]);

  // Réinitialisation de la session STT lors de l'ouverture d'un nouvel appel
  useEffect(() => {
    if (isOpen) {
      const isConfigured = Boolean(sttCapabilities?.configured && sttCapabilities?.hasFallbackAudio);
      defaultSTTManager.resetSession(isConfigured);
      setSessionProvider(isConfigured ? "recorded" : "auto");
      setSessionContext({});
      setSttError(null);
    }
  }, [isOpen, sttCapabilities]);

  // Auto-scroll doux lors de l'arrivée de nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript, sessionState]);

  // Message d'accueil vocal initial lors de l'ouverture
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText =
        language === "ar"
          ? "مرحباً بكم في موري كير. أنا مساعدكم الصوتي الذكي لتنسيق مواعيدكم ومتابعة مؤشراتكم الصحية. كيف يمكنني مساعدتكم اليوم؟"
          : "Bonjour ! Je suis l'assistant vocal MauriCare. Comment puis-je vous aider pour vos rendez-vous, vos constantes ou vos demandes de soins ?";

      setMessages([
        {
          id: "welcome",
          sender: "assistant",
          text: welcomeText,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [isOpen, language, messages.length]);

  // Synchronisation avec l'arrêt de la modale
  const handleEndCall = useCallback(() => {
    const isConfigured = Boolean(sttCapabilities?.configured && sttCapabilities?.hasFallbackAudio);
    defaultSTTManager.abort();
    defaultSTTManager.resetSession(isConfigured);
    defaultTTSProvider.stop();
    setSessionState("idle");
    setSessionProvider(isConfigured ? "recorded" : "auto");
    setSessionContext({});
    setLiveTranscript("");
    setSttError(null);
    onClose();
  }, [onClose, sttCapabilities, setSessionProvider]);

  // Envoi de la commande vers le serveur Convex
  const handleSendCommand = async (textToSend?: string, modeOverride?: "voice" | "text") => {
    const raw = (textToSend || inputText || liveTranscript).trim();
    if (!raw) return;

    // Arrêt de la reconnaissance vocale si en cours
    defaultSTTManager.stop();
    setLiveTranscript("");
    setSttError(null);
    setSessionState("processing");

    // Ajout message utilisateur
    const userMsg: MessageItem = {
      id: createMessageId("usr"),
      sender: "user",
      text: raw,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    try {
      const res = await processCommand({
        text: raw,
        inputMode: modeOverride || (sessionState === "listening" ? "voice" : "text"),
        language,
        activePatientId,
        currentSection,
        sessionContext,
      });

      if (res.sessionContext) {
        setSessionContext(res.sessionContext);
      }

      const assistantMsg: MessageItem = {
        id: createMessageId("ast"),
        sender: "assistant",
        text: res.responseMessage || "Demande traitée.",
        timestamp: Date.now(),
        actionPreview: res.actionPreview,
        actionPayload: res.actionPayload,
        intent: res.intent,
        status: res.status,
        interactionId: res.interactionId,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Synthèse vocale si activée
      if (ttsEnabled && res.responseMessage) {
        setSessionState("speaking");
        defaultTTSProvider.speak(
          res.responseMessage,
          language,
          () => setSessionState("speaking"),
          () => setSessionState("idle"),
          () => setSessionState("idle")
        );
      } else {
        setSessionState("idle");
      }

      // Redirection immédiate si action de lecture directe (ex: ouvrir onglet)
      if (res.status === "EXECUTE_DIRECT" && res.actionPreview?.type === "open_tab" && res.actionPreview.tab) {
        if (onNavigateToSection) {
          const targetTab = res.actionPreview.tab;
          const preview = res.actionPreview;
          setTimeout(() => {
            onNavigateToSection(targetTab, preview);
            handleEndCall();
          }, 1400);
        }
      }
    } catch (err: any) {
      console.error("Erreur traitement commande vocale:", err);
      setSessionState("idle");
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId("err"),
          sender: "assistant",
          text:
            language === "ar"
              ? "عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مجدداً."
              : "Désolé, une difficulté est survenue lors du traitement. Veuillez réessayer.",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // Démarrage de la reconnaissance vocale (Session-Aware & Sticky)
  const startVoiceInput = useCallback(
    (forceProvider?: "browser" | "recorded") => {
      defaultTTSProvider.stop();
      setSttError(null);
      setLiveTranscript("");
      setSessionState("listening");

      const isServerSTT = hasServerSTT || defaultSTTManager.isServerSTTConfigured();
      const providerToUse =
        forceProvider ||
        (isServerSTT || sessionProvider === "recorded" || defaultSTTManager.isBrowserUnavailableForSession()
          ? "recorded"
          : undefined);

      if (providerToUse === "recorded" && sessionProvider !== "recorded") {
        setSessionProvider("recorded");
        defaultSTTManager.setProviderMode("recorded");
      }

      defaultSTTManager.start(
        {
          onPartialTranscript: (transcript) => {
            setLiveTranscript(transcript);
          },
          onFinalTranscript: (transcript) => {
            setLiveTranscript("");
            handleSendCommand(transcript, "voice");
          },
          onStateChange: (state) => {
            if (state === "transcribing") {
              setSessionState("transcribing");
            } else if (state === "listening") {
              setSessionState("listening");
            } else if (state === "idle") {
              setSessionState((prev) =>
                prev === "listening" || prev === "transcribing" ? "idle" : prev
              );
            }
          },
          onError: (errorDetails: STTErrorDetails) => {
            setSttError(errorDetails);
            setSessionState("error");
          },
        },
        language,
        providerToUse
      );
    },
    [language, sessionProvider, hasServerSTT]
  );

  const stopVoiceInput = useCallback(() => {
    if (liveTranscript.trim() && defaultSTTManager.getActiveProviderName() === "browser") {
      defaultSTTManager.stop();
      handleSendCommand(liveTranscript, "voice");
    } else {
      defaultSTTManager.stop();
      if (defaultSTTManager.getActiveProviderName() === "recorded") {
        setSessionState("transcribing");
      }
    }
  }, [liveTranscript]);

  // Confirmation de l'action préparée
  const handleConfirmAction = async (msg: MessageItem) => {
    if (!msg.interactionId || !msg.actionPayload) return;

    setIsExecutingAction(true);
    try {
      const res = await executeAction({
        interactionId: msg.interactionId,
        actionType: msg.actionPayload.type,
        actionPayload: msg.actionPayload,
        confirmed: true,
      });

      toast.success(res.message || t("voice_ai.action_confirmed", "Action confirmée et exécutée."));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                status: "COMPLETED",
                text:
                  language === "ar"
                    ? `✅ تم تأكيد وتنفيذ العملية بنجاح.`
                    : `✅ Action validée et enregistrée avec succès.`,
              }
            : m
        )
      );

      if (ttsEnabled) {
        setSessionState("speaking");
        defaultTTSProvider.speak(
          language === "ar" ? "تم تأكيد وتنفيذ العملية بنجاح." : "Action confirmée et enregistrée avec succès.",
          language,
          () => setSessionState("speaking"),
          () => setSessionState("idle"),
          () => setSessionState("idle")
        );
      }
    } catch (err: any) {
      console.error("Erreur exécution action:", err);
      toast.error(err?.message || "Erreur lors de l'exécution de l'action.");
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Annulation de l'action préparée
  const handleCancelAction = async (msg: MessageItem) => {
    if (!msg.interactionId) return;

    try {
      await executeAction({
        interactionId: msg.interactionId,
        actionType: msg.actionPayload?.type || "CANCEL",
        actionPayload: {},
        confirmed: false,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                status: "CANCELLED",
                text: language === "ar" ? "تم إلغاء الإجراء." : "Action annulée.",
              }
            : m
        )
      );

      toast.info(t("voice_ai.action_cancelled", "Action annulée."));
    } catch (err) {
      console.error(err);
    }
  };

  // Réinitialisation complète de la session
  const handleResetSession = () => {
    const isConfigured = Boolean(sttCapabilities?.configured && sttCapabilities?.hasFallbackAudio);
    defaultSTTManager.abort();
    defaultSTTManager.resetSession(isConfigured);
    defaultTTSProvider.stop();
    setSessionState("idle");
    setSessionProvider(isConfigured ? "recorded" : "auto");
    setSessionContext({});
    setLiveTranscript("");
    setSttError(null);
    setMessages([]);
    setInputText("");
  };

  // Basculement vers le mode texte avec focus automatique
  const handleSwitchToTextMode = () => {
    setIsTextDrawerOpen(true);
    setSttError(null);
    if (sessionState === "error" || sessionState === "listening" || sessionState === "transcribing") {
      defaultSTTManager.stop();
      setSessionState("idle");
    }
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 150);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent
        dir={isRtl ? "rtl" : "ltr"}
        showCloseButton={false}
        className="w-[94vw] max-w-4xl h-[88vh] max-h-[760px] p-0 flex flex-col bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl shadow-teal-950/40 overflow-hidden"
      >
        {/* ======================================================== */}
        {/* 1. HEADER DU CALL VOCAL : Statut, Langue, Haut-parleur   */}
        {/* ======================================================== */}
        <header className="px-5 py-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between shrink-0 z-20">
          {/* Logo & Indicateur de statut */}
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-bold text-white tracking-wide">
                  MauriCare Voice AI
                </DialogTitle>
                <Badge className="bg-teal-500/15 text-teal-300 border-teal-500/30 text-[10px] px-2 py-0.5 font-medium">
                  {sessionProvider === "recorded"
                    ? language === "ar"
                      ? "وضع صوتي آمن"
                      : "Mode vocal sécurisé"
                    : language === "ar"
                    ? "اتصال آمن"
                    : "Appel Sécurisé"}
                </Badge>
              </div>

              {/* Status Pill Dynamique */}
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                {sessionState === "listening" && (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {language === "ar" ? "استماع نشط..." : "Écoute active..."}
                  </span>
                )}
                {sessionState === "transcribing" && (
                  <span className="flex items-center gap-1 text-cyan-300 font-medium">
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    {language === "ar" ? "جاري تحويل الصوت إلى نص..." : "Transcription en cours..."}
                  </span>
                )}
                {sessionState === "processing" && (
                  <span className="flex items-center gap-1 text-cyan-300 font-medium">
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    {language === "ar" ? "جاري معالجة الطلب..." : "Traitement en cours..."}
                  </span>
                )}
                {sessionState === "speaking" && (
                  <span className="flex items-center gap-1 text-teal-300 font-medium">
                    <Radio className="h-3 w-3 text-teal-400 animate-pulse" />
                    {language === "ar" ? "موري كير يتحدث..." : "MauriCare vous répond..."}
                  </span>
                )}
                {sessionState === "error" && (
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <AlertCircle className="h-3 w-3 text-amber-400" />
                    {language === "ar" ? "تنبيه الاتصال الصوتي" : "Connexion vocale"}
                  </span>
                )}
                {sessionState === "idle" && (
                  <span className="text-slate-400">
                    {language === "ar" ? "جاهز للتحدث أو الكتابة" : "Prêt pour vos commandes"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contrôles supérieurs */}
          <div className="flex items-center gap-1.5">
            {/* Langue toggle FR / AR (Synchronisation globale de l'application) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const nextLang = language === "fr" ? "ar" : "fr";
                i18n.changeLanguage(nextLang);
              }}
              className="text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2.5 rounded-lg border border-slate-700/60"
              title={language === "fr" ? "التبديل إلى العربية" : "Passer en Français"}
            >
              <Globe className="h-3.5 w-3.5 mr-1 rtl:mr-0 rtl:ml-1 text-teal-400" />
              {language.toUpperCase()}
            </Button>

            {/* Haut-parleur / Synthèse vocale toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                if (!next) defaultTTSProvider.stop();
              }}
              className={`h-8 w-8 p-0 rounded-lg border border-slate-700/60 transition-colors ${
                ttsEnabled ? "text-teal-400 bg-teal-500/10 hover:bg-teal-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              title={ttsEnabled ? "Désactiver la voix de réponse" : "Activer la voix de réponse"}
            >
              {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            {/* Reset session */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetSession}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-700/60"
              title={t("voice_ai.clear_session", "Effacer la session")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            {/* Bouton de fermeture d'appel (croix discrète) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndCall}
              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-700/60"
              title="Fermer l'appel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* 2. ESPACE CENTRAL : ORBE VOCAL DYNAMIQUE MAURICARE      */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-hidden flex flex-col justify-between relative bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950 px-6 py-4">
          {/* Halos de lumière ambiante en arrière-plan */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
            <div className="w-[450px] h-[450px] rounded-full bg-teal-600/10 blur-[100px] animate-pulse" />
            <div className="w-[300px] h-[300px] rounded-full bg-cyan-600/10 blur-[80px]" />
          </div>

          {/* Section Haute : L'Orbe Vocal */}
          <div className="flex flex-col items-center justify-center my-auto relative z-10">
            <div className="relative flex items-center justify-center">
              {/* Cercle d'onde extérieure pulsante en écoute */}
              {sessionState === "listening" && (
                <>
                  <motion.div
                    className="absolute rounded-full border-2 border-emerald-400/40 bg-emerald-500/10 pointer-events-none"
                    initial={{ width: 140, height: 140, opacity: 0.8 }}
                    animate={{ width: [140, 240], height: [140, 240], opacity: [0.8, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute rounded-full border border-teal-400/30 bg-teal-500/5 pointer-events-none"
                    initial={{ width: 140, height: 140, opacity: 0.6 }}
                    animate={{ width: [140, 200], height: [140, 200], opacity: [0.6, 0] }}
                    transition={{ duration: 1.8, delay: 0.4, repeat: Infinity, ease: "easeOut" }}
                  />
                </>
              )}

              {/* Halo rotatif lors de la transcription ou du traitement */}
              {(sessionState === "transcribing" || sessionState === "processing") && (
                <motion.div
                  className="absolute w-44 h-44 rounded-full border-2 border-dashed border-cyan-400/50 pointer-events-none"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              )}

              {/* L'Orbe Principal MauriCare */}
              <motion.button
                onClick={sessionState === "listening" ? stopVoiceInput : () => startVoiceInput()}
                disabled={sessionState === "processing" || sessionState === "transcribing"}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`relative w-36 h-36 sm:w-40 sm:h-40 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl ${
                  sessionState === "listening"
                    ? "bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 border-4 border-emerald-300/80 shadow-emerald-500/40"
                    : sessionState === "transcribing"
                    ? "bg-gradient-to-tr from-cyan-700 via-teal-600 to-slate-900 border-4 border-cyan-300/80 shadow-cyan-500/40"
                    : sessionState === "processing"
                    ? "bg-gradient-to-tr from-cyan-800 via-teal-700 to-slate-900 border-4 border-cyan-400/60 shadow-cyan-500/30"
                    : sessionState === "speaking"
                    ? "bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 border-4 border-teal-300 shadow-teal-500/40"
                    : sessionState === "error"
                    ? "bg-gradient-to-tr from-amber-700 via-amber-600 to-slate-900 border-4 border-amber-400/80 shadow-amber-500/30"
                    : "bg-gradient-to-tr from-teal-900 via-slate-900 to-slate-950 border-4 border-teal-500/40 shadow-teal-700/20 hover:border-teal-400"
                }`}
                title={sessionState === "listening" ? (language === "ar" ? "إيقاف الاستماع" : "Arrêter l'écoute") : (language === "ar" ? "بدء الصوت" : "Démarrer la voix")}
              >
                {/* Visualisation interne de l'orbe selon l'état */}
                {sessionState === "speaking" ? (
                  // Barres d'égaliseur audio animées
                  <div className="flex items-center gap-1.5 h-12">
                    {[0.6, 1.2, 0.8, 1.4, 0.9].map((mult, idx) => (
                      <motion.div
                        key={idx}
                        className="w-2 bg-white rounded-full"
                        animate={{ height: [12 * mult, 36 * mult, 10 * mult] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: idx * 0.12,
                        }}
                      />
                    ))}
                  </div>
                ) : sessionState === "listening" ? (
                  // Icône micro actif en écoute
                  <div className="flex flex-col items-center text-white">
                    <Mic className="h-10 w-10 animate-bounce" />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1 opacity-90">
                      {language === "ar" ? "استماع" : "Écoute"}
                    </span>
                  </div>
                ) : sessionState === "transcribing" ? (
                  // Onde de transcription
                  <div className="flex flex-col items-center text-cyan-200">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1 opacity-90">
                      {language === "ar" ? "تحويل" : "Transcription"}
                    </span>
                  </div>
                ) : sessionState === "processing" ? (
                  // Loader rotatif d'analyse
                  <div className="flex flex-col items-center text-cyan-200">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1 opacity-90">
                      {language === "ar" ? "معالجة" : "Analyse"}
                    </span>
                  </div>
                ) : sessionState === "error" ? (
                  // Alerte non bloquante
                  <div className="flex flex-col items-center text-amber-200">
                    <AlertCircle className="h-10 w-10" />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1 opacity-90">
                      {language === "ar" ? "شبكة" : "Réseau"}
                    </span>
                  </div>
                ) : (
                  // État IDLE / Prêt
                  <div className="flex flex-col items-center text-teal-300">
                    <Mic className="h-10 w-10" />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1 opacity-80">
                      {language === "ar" ? "تحدث" : "Parler"}
                    </span>
                  </div>
                )}
              </motion.button>
            </div>

            {/* Légende textuelle et transcription en direct */}
            <div className="mt-4 text-center max-w-lg min-h-[50px] flex flex-col items-center justify-center">
              {sessionState === "listening" && (
                <div className="space-y-1">
                  <p className="text-xs text-emerald-400 font-semibold tracking-wide flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {language === "ar" ? "تفضل بالتحدث..." : "Je vous écoute…"}
                  </p>
                  <p className="text-sm font-medium text-white italic px-4 line-clamp-2">
                    {liveTranscript ? `« ${liveTranscript} »` : "..."}
                  </p>
                </div>
              )}

              {sessionState === "transcribing" && (
                <p className="text-xs text-cyan-300 font-medium animate-pulse flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                  {language === "ar"
                    ? "جاري تحويل التسجيل الصوتي إلى نص..."
                    : "Transcription en cours…"}
                </p>
              )}

              {sessionState === "processing" && (
                <p className="text-xs text-cyan-300 font-medium animate-pulse">
                  {language === "ar"
                    ? "جاري معالجة طلبكم..."
                    : "Je traite votre demande…"}
                </p>
              )}

              {sessionState === "speaking" && (
                <p className="text-xs text-teal-300 font-medium">
                  {language === "ar"
                    ? "موري كير يتحدث الآن..."
                    : "MauriCare vous répond"}
                </p>
              )}

              {sessionState === "idle" && (
                <p className="text-xs text-slate-400">
                  {language === "ar"
                    ? "اضغط على الدائرة للتحدث، أو استخدم لوحة المفاتيح في الأسفل."
                    : "Touchez l'orbe pour parler, ou utilisez le mode texte ci-dessous."}
                </p>
              )}
            </div>

            {/* ======================================================== */}
            {/* 3. CARTE COMPACTE DE STATUT / ERREUR VOCALE             */}
            {/* ======================================================== */}
            <AnimatePresence>
              {sttError && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className={`w-full max-w-md mt-2 px-3.5 py-2.5 rounded-xl border backdrop-blur-md shadow-lg text-left z-20 ${
                    sttError.code === "not-allowed"
                      ? "bg-rose-950/80 border-rose-500/40 text-rose-200"
                      : "bg-slate-900/90 border-amber-500/40 text-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0">
                      <AlertCircle className={`h-4 w-4 ${sttError.code === "not-allowed" ? "text-rose-400" : "text-amber-400"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold tracking-tight truncate">
                          {language === "ar" ? sttError.titleAr : sttError.titleFr}
                        </span>
                        <button
                          onClick={() => setSttError(null)}
                          className="text-slate-400 hover:text-white p-0.5 shrink-0"
                          title={language === "ar" ? "إغلاق التنبيه" : "Fermer l'alerte"}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-tight">
                        {language === "ar" ? sttError.messageAr : sttError.messageFr}
                      </p>
                    </div>
                  </div>

                  {/* Actions compactes alignées */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80 justify-end">
                    {sttError.code === "not-allowed" ? (
                      <Button
                        size="sm"
                        onClick={handleSwitchToTextMode}
                        className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-2.5"
                      >
                        <Keyboard className="h-3 w-3 mr-1" />
                        {language === "ar" ? "وضع الكتابة" : "Mode texte"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSttError(null);
                            startVoiceInput(hasServerSTT ? "recorded" : undefined);
                          }}
                          className="h-7 text-xs bg-teal-600 hover:bg-teal-500 text-white rounded-lg px-2.5 font-medium"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {language === "ar" ? "إعادة المحاولة" : "Réessayer"}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSwitchToTextMode}
                          className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg px-2"
                        >
                          <Keyboard className="h-3 w-3 mr-1" />
                          {language === "ar" ? "وضع الكتابة" : "Mode texte"}
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ======================================================== */}
          {/* 4. FIL DE CONVERSATION & ACTIONS EN ATTENTE             */}
          {/* ======================================================== */}
          <div className="w-full max-h-[220px] overflow-y-auto px-4 py-3 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl space-y-3 z-10 shadow-inner">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser
                      ? isRtl
                        ? "items-start"
                        : "items-end"
                      : isRtl
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                      isUser
                        ? "bg-teal-600 text-white rounded-tr-sm"
                        : "bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Carte d'action si confirmation requise */}
                  {msg.sender === "assistant" &&
                    msg.status === "READY_FOR_CONFIRMATION" &&
                    msg.actionPreview && (
                      <div className="w-full max-w-[95%] text-slate-900">
                        <ActionConfirmationCard
                          intent={msg.intent || "UNKNOWN"}
                          actionPreview={msg.actionPreview}
                          onConfirm={() => handleConfirmAction(msg)}
                          onModify={() => {
                            setInputText(
                              msg.actionPreview.service ||
                                msg.actionPreview.valueFormatted ||
                                ""
                            );
                            handleSwitchToTextMode();
                          }}
                          onCancel={() => handleCancelAction(msg)}
                          isExecuting={isExecutingAction}
                        />
                      </div>
                    )}

                  <span className="text-[9px] text-slate-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ======================================================== */}
        {/* 5. TIROIR COLLAPSIBLE DE SAISIE TEXTE                   */}
        {/* ======================================================== */}
        <AnimatePresence>
          {isTextDrawerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-900 border-t border-slate-800 px-5 py-3 space-y-2.5 shrink-0 z-20"
            >
              {/* Suggestions rapides */}
              {suggestions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {language === "ar" ? "اقتراحات :" : "Suggestions :"}
                  </span>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        handleSendCommand(
                          language === "ar" ? s.labelAr : s.labelFr,
                          "text"
                        )
                      }
                      className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] whitespace-nowrap border border-slate-700/80 transition-colors"
                    >
                      {language === "ar" ? s.labelAr : s.labelFr}
                    </button>
                  ))}
                </div>
              )}

              {/* Formulaire de saisie texte */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCommand(undefined, "text");
                }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={textInputRef}
                  type="text"
                  placeholder={
                    language === "ar"
                      ? "اكتب رسالتك للمساعد الصوتي هنا..."
                      : "Écrivez votre message à l'assistant..."
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="text-xs bg-slate-950 border-slate-800 text-white placeholder-slate-500 h-10 focus:border-teal-500 rounded-xl"
                />

                <Button
                  type="submit"
                  disabled={!inputText.trim() || sessionState === "processing" || sessionState === "transcribing"}
                  className="h-10 px-4 bg-teal-600 hover:bg-teal-500 text-white shrink-0 rounded-xl font-semibold shadow-sm shadow-teal-600/30"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {language === "ar" ? "إرسال" : "Envoyer"}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* 6. BARRE INFÉRIEURE DE CONTRÔLES D'APPEL                */}
        {/* ======================================================== */}
        <footer className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md flex flex-col gap-2.5 shrink-0 z-20">
          <div className="flex items-center justify-between">
            {/* Bouton Mode Texte (clavier) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTextDrawerOpen((prev) => !prev)}
              className={`h-11 px-3.5 rounded-2xl border transition-all ${
                isTextDrawerOpen
                  ? "bg-teal-500/15 border-teal-500/40 text-teal-300"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Keyboard className="h-4 w-4 mr-2 text-teal-400" />
              <span className="text-xs font-semibold">
                {language === "ar" ? "وضع الكتابة" : "Mode texte"}
              </span>
              {isTextDrawerOpen ? (
                <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-60" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 ml-1.5 opacity-60" />
              )}
            </Button>

            {/* Gros Bouton Micro Central d'Appel */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={sessionState === "listening" ? stopVoiceInput : () => startVoiceInput()}
                disabled={sessionState === "processing" || sessionState === "transcribing"}
                className={`h-14 w-14 rounded-full p-0 transition-all shadow-xl flex items-center justify-center ${
                  sessionState === "listening"
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40 ring-4 ring-rose-500/30 scale-105"
                    : sessionState === "transcribing" || sessionState === "processing"
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30 ring-4 ring-teal-500/20 hover:scale-105"
                }`}
                title={sessionState === "listening" ? (language === "ar" ? "إيقاف الاستماع" : "Arrêter l'écoute") : (language === "ar" ? "بدء الصوت" : "Démarrer la voix")}
              >
                {sessionState === "listening" ? (
                  <MicOff className="h-6 w-6" />
                ) : sessionState === "transcribing" || sessionState === "processing" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>
            </div>

            {/* Bouton Raccrocher / Terminer Appel */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndCall}
              className="h-11 px-4 rounded-2xl bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
              title={language === "ar" ? "إنهاء وإغلاق" : "Raccrocher et fermer"}
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              <span className="text-xs font-bold">
                {language === "ar" ? "إنهاء المكالمة" : "Terminer"}
              </span>
            </Button>
          </div>

          {/* Mentions légales & Sécurité Déontologique conforme aux exigences */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-teal-400 shrink-0" />
              {language === "ar"
                ? "موري كير لا يحتفظ بأي تسجيلات صوتية خام. معالجة الصوت قد تعتمد على متصفحك أو مزود النسخ الصوتي المُعد."
                : "MauriCare ne conserve pas intentionnellement d'audio brut. Le traitement vocal peut dépendre du service vocal de votre navigateur ou du fournisseur de transcription configuré."}
            </span>
            <span className="hidden sm:inline italic">
              {language === "ar"
                ? "تنسيق رعاية فقط — لا تشخيص طبي ولا وصفات"
                : "Coordination de parcours — aucun diagnostic médical ni prescription"}
            </span>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

/**
/**
 * MauriCare Voice AI — Extensible Multi-Provider STT Architecture
 * - Fast path: Browser SpeechRecognition (Web Speech API).
 * - Robust fallback: MediaRecorder audio capture + Server-side transcription action.
 * - Symmetrical text fallback is always accessible.
 * - Privacy guarantee: MauriCare does not intentionally retain raw voice audio.
 */

export type STTErrorCode =
  | "network"
  | "not-allowed"
  | "audio-capture"
  | "no-speech"
  | "aborted"
  | "service-not-allowed"
  | "not-supported"
  | "not-configured"
  | "provider-error"
  | "unknown";

export interface STTErrorDetails {
  code: STTErrorCode;
  titleFr: string;
  titleAr: string;
  messageFr: string;
  messageAr: string;
  suggestionFr: string;
  suggestionAr: string;
  rawError?: string;
  isRecoverable: boolean;
  suggestTextFallback: boolean;
  suggestRecordedFallback?: boolean;
}

export type STTProviderState =
  | "idle"
  | "listening"
  | "transcribing"
  | "error";

export interface STTCallbacks {
  onPartialTranscript?: (transcript: string) => void;
  onFinalTranscript?: (transcript: string) => void;
  onStateChange?: (state: STTProviderState) => void;
  onError?: (error: STTErrorDetails) => void;
}

export interface SpeechToTextProvider {
  readonly name: string;
  isSupported(): boolean;
  start(callbacks: STTCallbacks, language?: string): Promise<void> | void;
  stop(): Promise<void> | void;
  abort(): void;
  getState(): STTProviderState;
}

// Déclaration typée de l'API Web Speech du navigateur
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function mapWebSpeechError(rawError: string): STTErrorDetails {
  switch (rawError) {
    case "network":
      return {
        code: "network",
        titleFr: "Connexion vocale interrompue",
        titleAr: "انقطاع الاتصال الصوتي",
        messageFr: "Le service de reconnaissance vocale du navigateur n'est pas joignable (erreur réseau).",
        messageAr: "خدمة التعرف على الصوت للمتصفح غير متاحة حالياً بسبب مشكلة في الاتصال بالشبكة.",
        suggestionFr: "Vous pouvez continuer en vocal avec le mode audio ou passer en mode texte.",
        suggestionAr: "يمكنكم المتابعة صوتياً عبر وضع التسجيل أو الانتقال لوضع الكتابة.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: true,
        suggestRecordedFallback: true,
      };

    case "not-allowed":
    case "permission-denied":
      return {
        code: "not-allowed",
        titleFr: "Microphone indisponible",
        titleAr: "الميكروفون غير متاح",
        messageFr: "Autorisez l'accès au microphone pour utiliser Voice AI.",
        messageAr: "يرجى السماح بالوصول إلى الميكروفون لاستخدام المساعد الصوتي.",
        suggestionFr: "Activez l'accès au micro dans les paramètres du navigateur ou passez en mode texte.",
        suggestionAr: "يرجى السماح بالوصول إلى الميكروفون في إعدادات المتصفح أو الانتقال لوضع الكتابة.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: true,
        suggestRecordedFallback: false,
      };

    case "audio-capture":
      return {
        code: "audio-capture",
        titleFr: "Microphone introuvable",
        titleAr: "تعذر العثور على ميكروفون",
        messageFr: "Aucun périphérique d'enregistrement audio n'a été détecté.",
        messageAr: "لم يتم العثور على جهاز إدخال صوتي على هذا الجهاز.",
        suggestionFr: "Vérifiez que votre microphone est branché et activé.",
        suggestionAr: "تأكد من توصيل الميكروفون وتفعيله بشكل صحيح.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: true,
        suggestRecordedFallback: false,
      };

    case "no-speech":
      return {
        code: "no-speech",
        titleFr: "Aucune voix détectée",
        titleAr: "لم يتم رصد أي صوت",
        messageFr: "Le microphone n'a capté aucune parole. Parlez clairement ou rapprochez-vous du micro.",
        messageAr: "لم يتم التقاط أي صوت. تحدث بوضوح أو اقترب من الميكروفون.",
        suggestionFr: "Cliquez sur le micro pour parler à nouveau.",
        suggestionAr: "اضغط على الميكروفون للتحدث مجدداً.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: false,
        suggestRecordedFallback: false,
      };

    case "service-not-allowed":
      return {
        code: "service-not-allowed",
        titleFr: "Service vocal restreint",
        titleAr: "الخدمة الصوتية محظورة",
        messageFr: "Le service vocal direct est restreint par les règles de votre navigateur ou de votre réseau.",
        messageAr: "خدمة التعرف على الصوت محظورة في هذا المتصفح أو بيئة الشبكة.",
        suggestionFr: "Vous pouvez basculer sur l'audio enregistré ou le mode texte.",
        suggestionAr: "يمكنكم استخدام وضع التسجيل المباشر أو وضع الكتابة.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: true,
        suggestRecordedFallback: true,
      };

    case "not-supported":
      return {
        code: "not-supported",
        titleFr: "Reconnaissance vocale non supportée",
        titleAr: "التعرف الصوتي غير مدعوم",
        messageFr: "La reconnaissance vocale directe n'est pas prise en charge sur ce navigateur.",
        messageAr: "خاصية التعرف على الصوت غير مدعومة في هذا المتصفح.",
        suggestionFr: "Utilisez l'enregistrement audio ou le mode texte.",
        suggestionAr: "استخدم التسجيل الصوتي أو وضع الكتابة للتفاعل مع المساعد.",
        rawError,
        isRecoverable: false,
        suggestTextFallback: true,
        suggestRecordedFallback: true,
      };

    case "not-configured":
      return {
        code: "not-configured",
        titleFr: "Service de transcription non configuré",
        titleAr: "خدمة النسخ الصوتي غير مُعدة",
        messageFr: "Aucun fournisseur de transcription externe n'est actuellement configuré sur le serveur.",
        messageAr: "لم يتم إعداد مزود خدمة النسخ الصوتي على خوادم موري كير.",
        suggestionFr: "Passez en mode texte pour interagir directement avec l'assistant.",
        suggestionAr: "يرجى استخدام وضع الكتابة للتفاعل مباشرة مع المساعد.",
        rawError,
        isRecoverable: false,
        suggestTextFallback: true,
        suggestRecordedFallback: false,
      };

    case "provider-error":
      return {
        code: "provider-error",
        titleFr: "La transcription vocale est momentanément indisponible",
        titleAr: "خدمة النسخ الصوتي غير متاحة مؤقتاً",
        messageFr: "Le service de transcription n'a pas pu traiter l'audio capté.",
        messageAr: "تعذر على خادم النسخ الصوتي تحويل التسجيل إلى نص.",
        suggestionFr: "Vous pouvez réessayer ou continuer en mode texte.",
        suggestionAr: "يمكنكم إعادة المحاولة أو المتابعة بالكتابة.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: true,
        suggestRecordedFallback: false,
      };

    case "aborted":
      return {
        code: "aborted",
        titleFr: "Écoute interrompue",
        titleAr: "تم إيقاف الاستماع",
        messageFr: "L'enregistrement vocal a été interrompu.",
        messageAr: "تم إيقاف التسجيل الصوتي.",
        suggestionFr: "Cliquez sur le micro pour reprendre.",
        suggestionAr: "اضغط على الميكروفون للمتابعة.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: false,
        suggestRecordedFallback: false,
      };

    default:
      return {
        code: "unknown",
        titleFr: "Service vocal momentanément indisponible",
        titleAr: "الخدمة الصوتية غير متاحة حالياً",
        messageFr: `Une difficulté vocale est survenue (${rawError}).`,
        messageAr: `حدثت مشكلة أثناء المعالجة الصوتية (${rawError}).`,
        suggestionFr: "Vous pouvez réessayer ou continuer en mode texte.",
        suggestionAr: "يمكنكم إعادة المحاولة أو المتابعة بالكتابة.",
        rawError,
        isRecoverable: true,
        suggestTextFallback: true,
        suggestRecordedFallback: true,
      };
  }
}

// ============================================================================
// 1. PROVIDER : BROWSER WEB SPEECH (FAST PATH)
// ============================================================================

export class BrowserSpeechProvider implements SpeechToTextProvider {
  readonly name = "browser";
  private recognition: any = null;
  private state: STTProviderState = "idle";
  private isAbortedByUser: boolean = false;

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)
    );
  }

  getState(): STTProviderState {
    return this.state;
  }

  start(callbacks: STTCallbacks, language: string = "fr-FR"): void {
    if (!this.isSupported()) {
      this.state = "error";
      callbacks.onError?.(mapWebSpeechError("not-supported"));
      return;
    }

    try {
      this.abort();
      this.isAbortedByUser = false;

      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = language === "ar" ? "ar-SA" : "fr-FR";

      this.recognition.onstart = () => {
        this.state = "listening";
        callbacks.onStateChange?.("listening");
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const transcript = (finalTranscript || interimTranscript).trim();
        if (transcript) {
          if (finalTranscript) {
            callbacks.onFinalTranscript?.(finalTranscript.trim());
          } else {
            callbacks.onPartialTranscript?.(interimTranscript.trim());
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        this.state = "error";
        const rawErr = event?.error || "unknown";

        if (this.isAbortedByUser || rawErr === "aborted") {
          this.state = "idle";
          return;
        }

        const details = mapWebSpeechError(rawErr);
        callbacks.onError?.(details);
      };

      this.recognition.onend = () => {
        if (this.state === "listening") {
          this.state = "idle";
          callbacks.onStateChange?.("idle");
        }
      };

      this.recognition.start();
    } catch (err: any) {
      this.state = "error";
      callbacks.onError?.(mapWebSpeechError(err?.message || "start_failed"));
    }
  }

  stop(): void {
    if (this.recognition && this.state === "listening") {
      this.isAbortedByUser = false;
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.state = "idle";
    }
  }

  abort(): void {
    if (this.recognition) {
      this.isAbortedByUser = true;
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.state = "idle";
  }
}

// ============================================================================
// 2. PROVIDER : RECORDED AUDIO STT (ROBUST FALLBACK)
// ============================================================================

export type ServerTranscribeFn = (params: {
  audioBase64: string;
  mimeType: string;
  language?: string;
}) => Promise<{
  success: boolean;
  configured: boolean;
  code?: string;
  transcript?: string;
  message?: string;
}>;

export class RecordedAudioSTTProvider implements SpeechToTextProvider {
  readonly name = "recorded";
  private state: STTProviderState = "idle";
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private transcribeDelegate: ServerTranscribeFn | null = null;
  private detectedMimeType: string = "";
  private isAborted: boolean = false;
  private currentLanguage: string = "fr";

  // Silence detector & max duration safety
  private audioContext: AudioContext | null = null;
  private silenceTimer: any = null;
  private maxDurationTimer: any = null;
  private currentCallbacks: STTCallbacks | null = null;

  constructor(transcribeDelegate?: ServerTranscribeFn) {
    if (transcribeDelegate) {
      this.transcribeDelegate = transcribeDelegate;
    }
  }

  setTranscribeDelegate(fn: ServerTranscribeFn): void {
    this.transcribeDelegate = fn;
  }

  isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
  }

  getState(): STTProviderState {
    return this.state;
  }

  private detectSupportedMimeType(): string {
    const candidateTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/wav",
    ];

    if (typeof MediaRecorder === "undefined") return "";

    for (const t of candidateTypes) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return "";
  }

  async start(callbacks: STTCallbacks, language: string = "fr"): Promise<void> {
    if (!this.isSupported()) {
      this.state = "error";
      callbacks.onError?.(mapWebSpeechError("not-supported"));
      return;
    }

    try {
      this.abort();
      this.isAborted = false;
      this.currentCallbacks = callbacks;
      this.currentLanguage = language;
      this.audioChunks = [];

      // Capture de microphone via standard browser API
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioStream = stream;
      this.detectedMimeType = this.detectSupportedMimeType();

      const options: MediaRecorderOptions = {};
      if (this.detectedMimeType) {
        options.mimeType = this.detectedMimeType;
      }

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Libération immédiate des pistes microphones
        this.cleanupAudioStream();

        if (this.isAborted) {
          this.state = "idle";
          callbacks.onStateChange?.("idle");
          return;
        }

        const mime = this.detectedMimeType || "audio/webm";
        const recordedBlob = new Blob(this.audioChunks, { type: mime });
        this.audioChunks = [];

        // Vérification de présence d'audio
        if (recordedBlob.size < 400) {
          this.state = "error";
          callbacks.onError?.(mapWebSpeechError("no-speech"));
          return;
        }

        // Bascule vers l'état de transcription
        this.state = "transcribing";
        callbacks.onStateChange?.("transcribing");

        try {
          if (!this.transcribeDelegate) {
            this.state = "error";
            callbacks.onError?.(mapWebSpeechError("not-configured"));
            return;
          }

          // Encodage Base64 éphémère en mémoire pour le transport serveur
          const audioBase64 = await this.blobToBase64(recordedBlob);

          const res = await this.transcribeDelegate({
            audioBase64,
            mimeType: mime,
            language: this.currentLanguage,
          });

          if (this.isAborted) {
            this.state = "idle";
            return;
          }

          if (res.success && res.transcript && res.transcript.trim()) {
            this.state = "idle";
            callbacks.onStateChange?.("idle");
            callbacks.onFinalTranscript?.(res.transcript.trim());
          } else if (!res.configured) {
            this.state = "error";
            callbacks.onError?.(mapWebSpeechError("not-configured"));
          } else {
            this.state = "error";
            callbacks.onError?.(mapWebSpeechError("provider-error"));
          }
        } catch {
          if (!this.isAborted) {
            this.state = "error";
            callbacks.onError?.(mapWebSpeechError("provider-error"));
          }
        }
      };

      // Démarrage de l'enregistrement avec tranches de 250ms
      this.mediaRecorder.start(250);
      this.state = "listening";
      callbacks.onStateChange?.("listening");

      // Détecteur de fin de parole par niveau sonore (silence detection)
      this.setupSilenceDetector(stream);

      // Sécurité : arrêt automatique après 15 secondes max
      this.maxDurationTimer = setTimeout(() => {
        if (this.state === "listening") {
          this.stop();
        }
      }, 15000);
    } catch (err: any) {
      this.cleanupAudioStream();
      this.state = "error";
      const isDenied =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      callbacks.onError?.(
        mapWebSpeechError(isDenied ? "not-allowed" : "audio-capture")
      );
    }
  }

  stop(): void {
    this.clearTimers();
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
  }

  abort(): void {
    this.isAborted = true;
    this.clearTimers();
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanupAudioStream();
    this.audioChunks = [];
    this.state = "idle";
  }

  private cleanupAudioStream(): void {
    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.audioStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }

  private clearTimers(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  private setupSilenceDetector(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let speechStarted = false;
      let lastSpeechTime = Date.now();

      const checkVolume = () => {
        if (this.state !== "listening" || this.isAborted) return;

        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;

        // Seuil d'énergie vocale
        if (avg > 18) {
          speechStarted = true;
          lastSpeechTime = Date.now();
        } else if (speechStarted && Date.now() - lastSpeechTime > 1900) {
          // 1.9 seconde de silence consécutif après prise de parole
          this.stop();
          return;
        }

        requestAnimationFrame(checkVolume);
      };

      requestAnimationFrame(checkVolume);
    } catch {
      // AudioContext facultatif, dégradation gracieuse vers arrêt manuel
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64 || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// ============================================================================
// 3. COMPOSITE ORCHESTRATOR : COMPOSITE STT MANAGER
// ============================================================================

export type ProviderMode = "auto" | "browser" | "recorded";

export class CompositeSTTManager {
  private browserProvider: BrowserSpeechProvider;
  private recordedProvider: RecordedAudioSTTProvider;
  private activeMode: ProviderMode = "auto";
  private browserUnavailableForSession: boolean = false;
  private serverSTTConfigured: boolean = false;
  private currentActiveProvider: SpeechToTextProvider;
  private sessionUtteranceCount: number = 0;

  constructor() {
    this.browserProvider = new BrowserSpeechProvider();
    this.recordedProvider = new RecordedAudioSTTProvider();
    this.currentActiveProvider = this.browserProvider;
  }

  setTranscribeDelegate(fn: ServerTranscribeFn): void {
    this.recordedProvider.setTranscribeDelegate(fn);
  }

  setServerSTTConfigured(configured: boolean): void {
    this.serverSTTConfigured = configured;
    if (configured) {
      this.activeMode = "recorded";
      this.currentActiveProvider = this.recordedProvider;
      this.browserUnavailableForSession = true;
    }
  }

  isServerSTTConfigured(): boolean {
    return this.serverSTTConfigured;
  }

  resetSession(serverConfigured?: boolean): void {
    this.abort();
    if (serverConfigured !== undefined) {
      this.serverSTTConfigured = serverConfigured;
    }
    this.sessionUtteranceCount = 0;

    if (this.serverSTTConfigured) {
      this.activeMode = "recorded";
      this.browserUnavailableForSession = true;
      this.currentActiveProvider = this.recordedProvider;
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.log("[VoiceAI] Session reset: server STT configured -> primary provider set to recorded_audio (Groq)");
      }
    } else {
      this.activeMode = "auto";
      this.browserUnavailableForSession = false;
      this.currentActiveProvider = this.browserProvider;
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.log("[VoiceAI] Session reset: provider set to auto, browser available");
      }
    }
  }

  isBrowserUnavailableForSession(): boolean {
    return this.browserUnavailableForSession;
  }

  markBrowserUnavailableForSession(reason: string = "network"): void {
    this.browserUnavailableForSession = true;
    this.activeMode = "recorded";
    this.currentActiveProvider = this.recordedProvider;
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.log(`[VoiceAI] Browser STT marked unavailable for session (${reason}): provider locked to recorded_audio`);
    }
  }

  setProviderMode(mode: ProviderMode): void {
    const prev = this.activeMode;
    this.activeMode = mode;
    if (mode === "recorded" || this.serverSTTConfigured) {
      this.currentActiveProvider = this.recordedProvider;
      this.browserUnavailableForSession = true;
    } else if (mode === "browser") {
      this.currentActiveProvider = this.browserProvider;
      this.browserUnavailableForSession = false;
    } else {
      this.currentActiveProvider =
        !this.browserUnavailableForSession && this.browserProvider.isSupported()
          ? this.browserProvider
          : this.recordedProvider;
    }
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.log(
        `[VoiceAI] Session provider mode changed: ${prev} -> ${this.activeMode} (active: ${this.currentActiveProvider.name})`
      );
    }
  }

  getProviderMode(): ProviderMode {
    return this.activeMode;
  }

  getActiveProviderName(): string {
    return this.currentActiveProvider.name;
  }

  isBrowserSupported(): boolean {
    return this.browserProvider.isSupported();
  }

  isRecordedSupported(): boolean {
    return this.recordedProvider.isSupported();
  }

  getState(): STTProviderState {
    return this.currentActiveProvider.getState();
  }

  start(
    callbacks: STTCallbacks,
    language: string = "fr",
    forceProvider?: "browser" | "recorded"
  ): void {
    this.sessionUtteranceCount++;

    // 1. Si serveur STT configuré ou forceProvider = recorded : recorded_audio immédiat
    if (forceProvider === "recorded" || this.serverSTTConfigured) {
      this.activeMode = "recorded";
      this.browserUnavailableForSession = true;
      this.currentActiveProvider = this.recordedProvider;
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.log(
          `[VoiceAI] Utterance #${this.sessionUtteranceCount}: primary server STT (recorded_audio)`
        );
      }
    } else if (forceProvider === "browser") {
      if (!this.browserUnavailableForSession && this.browserProvider.isSupported()) {
        this.currentActiveProvider = this.browserProvider;
      } else {
        this.currentActiveProvider = this.recordedProvider;
      }
    } else if (this.activeMode === "recorded" || this.browserUnavailableForSession) {
      // 2. Mode session recorded_audio actif : ne jamais retenter le navigateur
      this.currentActiveProvider = this.recordedProvider;
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.log(
          `[VoiceAI] Utterance #${this.sessionUtteranceCount}: using sticky recorded_audio provider`
        );
      }
    } else {
      // 3. Mode auto initial (uniquement si aucun STT serveur configuré)
      this.currentActiveProvider =
        !this.browserUnavailableForSession && this.browserProvider.isSupported()
          ? this.browserProvider
          : this.recordedProvider;
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.log(
          `[VoiceAI] Utterance #${this.sessionUtteranceCount}: auto mode selected ${this.currentActiveProvider.name}`
        );
      }
    }

    // Interception de l'erreur pour mémoriser l'échec navigateur dans la session
    const wrappedCallbacks: STTCallbacks = {
      ...callbacks,
      onError: (errorDetails: STTErrorDetails) => {
        if (
          this.currentActiveProvider.name === "browser" &&
          (errorDetails.code === "network" ||
            errorDetails.code === "service-not-allowed" ||
            errorDetails.code === "not-supported")
        ) {
          this.markBrowserUnavailableForSession(errorDetails.code);
        }
        callbacks.onError?.(errorDetails);
      },
    };

    this.currentActiveProvider.start(wrappedCallbacks, language);
  }

  stop(): void {
    this.currentActiveProvider.stop();
  }

  abort(): void {
    this.browserProvider.abort();
    this.recordedProvider.abort();
  }
}

// Instance singleton principale
export const defaultSTTManager = new CompositeSTTManager();

// Export de rétrocompatibilité
export const defaultSTTProvider = {
  isSupported(): boolean {
    return (
      defaultSTTManager.isBrowserSupported() ||
      defaultSTTManager.isRecordedSupported()
    );
  },
  startListening(
    onResult: (result: { transcript: string; isFinal: boolean }) => void,
    onError: (error: STTErrorDetails) => void,
    onEnd: () => void,
    language?: string
  ): void {
    defaultSTTManager.start(
      {
        onPartialTranscript: (transcript) =>
          onResult({ transcript, isFinal: false }),
        onFinalTranscript: (transcript) =>
          onResult({ transcript, isFinal: true }),
        onError,
        onStateChange: (state) => {
          if (state === "idle") onEnd();
        },
      },
      language
    );
  },
  stopListening(): void {
    defaultSTTManager.stop();
  },
  abortListening(): void {
    defaultSTTManager.abort();
  },
  getIsListening(): boolean {
    return defaultSTTManager.getState() === "listening";
  },
};

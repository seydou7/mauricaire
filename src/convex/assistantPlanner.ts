import { CAPABILITY_REGISTRY, AssistantCapability } from "./assistantRegistry";
import { queryPlatformKnowledge } from "./assistantKnowledge";
import { ROLES } from "./schema";

export interface PlannerSessionContext {
  lastDomain?: "providers" | "appointments" | "requests" | "chronic" | "homelab" | "circle" | "relay" | "general";
  lastCapability?: string;
  lastFilters?: {
    specialty?: string;
    zone?: string;
    date?: string;
    timeOfDay?: string;
    status?: string;
    patientId?: string;
  };
  lastEntityIds?: string[];
  lastTurnCount?: number;
}

export interface AssistantPlanStep {
  capabilityName: string;
  parameters: Record<string, any>;
  description: string;
}

export interface AssistantPlan {
  type: "FAST_PATH" | "KNOWLEDGE" | "SINGLE_TOOL" | "MULTI_TOOL" | "CLARIFICATION" | "BLOCKED";
  steps: AssistantPlanStep[];
  knowledgeAnswer?: string;
  clarificationPromptFr?: string;
  clarificationPromptAr?: string;
  fastPathIntent?: string;
  updatedContext: PlannerSessionContext;
}

// Mots-clés de sécurité anti-injection de prompt
const PROMPT_INJECTION_PATTERNS = [
  /ignore.*(previous|all|instructions|rules|permissions)/i,
  /system\s*prompt/i,
  /dump\s*database/i,
  /bypass.*(auth|security|permission|circle|access)/i,
  /role\s*=\s*admin/i,
];

// Mots-clés stricts de détection de demande de diagnostic médical (Zéro IA Diagnostique)
const MEDICAL_DIAGNOSIS_PATTERNS = [
  /est-ce que j['’]ai (le|un|du|la)?\s*(diab[èe]te|cancer|covid|hypertension|infarctus|avc)/i,
  /diagnostique?(-moi)?/i,
  /quel est mon diagnostic/i,
  /qu'est-ce que j'ai comme maladie/i,
  /ai-je une maladie/i,
  /prescri(s|vez)(-moi)?/i,
  /quel traitement dois-je prendre/i,
  /هل أنا مصاب/i,
  /شخص مرضي/i,
  /ما هو مرضي/i,
  /ما هو علاجي/i,
];

// Helper extraction date
export function extractDateEntity(text: string): string | undefined {
  if (text.includes("aujourd'hui") || text.includes("ce jour") || text.includes("اليوم")) {
    return "today";
  }
  if (text.includes("après-demain") || text.includes("بعد غد")) {
    return "after_tomorrow";
  }
  if (text.includes("demain") || text.includes("غدا") || text.includes("غداً")) {
    return "tomorrow";
  }
  if (text.includes("cette semaine") || text.includes("هذا الأسبوع")) {
    return "this_week";
  }
  return undefined;
}

// Helper extraction spécialité
export function extractSpecialtyEntity(text: string): string | undefined {
  if (text.includes("infirmi") || text.includes("pansement") || text.includes("perfusion") || text.includes("ممرض")) {
    return "infirmier";
  }
  if (text.includes("médecin") || text.includes("docteur") || text.includes("طبيب")) {
    return "medecin";
  }
  if (text.includes("kiné") || text.includes("rééducat") || text.includes("علاج طبيعي")) {
    return "kinesitherapeute";
  }
  if (text.includes("sage-femme") || text.includes("maternité") || text.includes("قابلة")) {
    return "sage_femme";
  }
  if (text.includes("aide-soignant") || text.includes("aide soignant") || text.includes("مساعد تمريض")) {
    return "aide_soignant";
  }
  return undefined;
}

// Helper extraction zone
export function extractZoneEntity(text: string): string | undefined {
  const zones = [
    "tevragh zeina",
    "ksar",
    "dar naim",
    "arafat",
    "sebkha",
    "el mina",
    "riyadh",
    "toujounine",
    "tiyarett",
  ];
  for (const z of zones) {
    if (text.includes(z)) return z;
  }
  return undefined;
}

// Helper détection de demande de suivi / raffinement
export function isFollowUpRefinement(text: string): boolean {
  return (
    text.startsWith("seulement") ||
    text.startsWith("uniquement") ||
    text.startsWith("et ") ||
    text.startsWith("et les") ||
    text.startsWith("et pour") ||
    text.startsWith("فقط") ||
    text.startsWith("و ") ||
    text.includes("seulement les") ||
    text.includes("le premier") ||
    text.includes("lesquels")
  );
}

/**
 * Planificateur de commandes conversationnelles MauriCare
 */
export function planAssistantRequest(
  rawText: string,
  userRole: string,
  lang: string = "fr",
  sessionContext?: PlannerSessionContext,
  currentSection?: string
): AssistantPlan {
  const text = rawText.trim().toLowerCase();
  const ctx = sessionContext || {};

  // 1. Bouclier de sécurité anti-injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "BLOCKED",
        steps: [],
        clarificationPromptFr:
          "Cette commande ne peut pas être traitée en raison des règles de sécurité de MauriCare.",
        clarificationPromptAr:
          "لا يمكن معالجة هذا الطلب وفقاً لقواعد أمان وحماية نظام موري كير.",
        updatedContext: ctx,
      };
    }
  }

  // 2. Bouclier Zéro IA Diagnostique
  for (const pattern of MEDICAL_DIAGNOSIS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "BLOCKED",
        steps: [],
        clarificationPromptFr:
          "MauriCare Voice AI ne fournit aucun diagnostic médical, prescription ou avis clinique automatisé. Veuillez consulter un professionnel de santé agréé pour toute question médicale.",
        clarificationPromptAr:
          "نظام موري كير الصوتي لا يقدم أي تشخيص طبي أو وصفات علاجية آلية. يُرجى حجز موعد واستشارة ممارس صحي مؤهل لتقييم حالتكم الصحية.",
        updatedContext: ctx,
      };
    }
  }

  // 3. Navigation directe (Fast Path)
  if (
    text.startsWith("ouvre ") ||
    text.startsWith("ouvrir ") ||
    text.startsWith("affiche ") ||
    text.startsWith("navigue vers ") ||
    text.startsWith("افتح ")
  ) {
    let targetSection = "planning";
    if (text.includes("relay") || text.includes("ريلاي")) targetSection = "relay";
    else if (text.includes("homelab") || text.includes("laboratoire") || text.includes("مختبر")) targetSection = "homelab";
    else if (text.includes("circle") || text.includes("cercle") || text.includes("دائرة")) targetSection = "circle";
    else if (text.includes("chronic") || text.includes("constante") || text.includes("مؤشرات")) targetSection = "chronic";
    else if (text.includes("patient") || text.includes("مرضى")) targetSection = userRole === ROLES.PROFESSIONNEL ? "patients" : "apercu";
    else if (text.includes("demande") || text.includes("طلبات")) targetSection = "demandes";
    else if (text.includes("profil") || text.includes("حساب")) targetSection = "profil";
    else if (text.includes("réseau") || text.includes("soignant") || text.includes("دليل")) targetSection = "reseau";

    return {
      type: "FAST_PATH",
      fastPathIntent: "NAVIGATE_TAB",
      steps: [
        {
          capabilityName: "open_dashboard_section",
          parameters: { section: targetSection },
          description: `Ouvrir la section ${targetSection}`,
        },
      ],
      updatedContext: { ...ctx, lastDomain: "general" },
    };
  }

  // 4. Base de connaissances de la plateforme (Questions fonctionnelles "À quoi sert...", "Comment fonctionne...")
  const knowledgeMatch = queryPlatformKnowledge(text, userRole, lang);
  if (knowledgeMatch.matched && knowledgeMatch.answer) {
    return {
      type: "KNOWLEDGE",
      steps: [],
      knowledgeAnswer: knowledgeMatch.answer,
      updatedContext: { ...ctx, lastDomain: "general" },
    };
  }

  // 5. Suivi conversationnel contextuel (Follow-up refinement)
  if (isFollowUpRefinement(text) && ctx.lastDomain) {
    // Cas 5A : Raffinement d'une recherche de soignants existante
    if (ctx.lastDomain === "providers") {
      const refinedSpecialty = extractSpecialtyEntity(text) || ctx.lastFilters?.specialty;
      const refinedZone = extractZoneEntity(text) || ctx.lastFilters?.zone;
      const refinedDate = extractDateEntity(text) || ctx.lastFilters?.date;
      const refinedTime = text.includes("matin") ? "morning" : text.includes("soir") ? "evening" : ctx.lastFilters?.timeOfDay;

      return {
        type: "SINGLE_TOOL",
        steps: [
          {
            capabilityName: "find_available_providers",
            parameters: {
              specialty: refinedSpecialty,
              zone: refinedZone,
              date: refinedDate,
              timeOfDay: refinedTime,
            },
            description: "Recherche affinée de soignants disponibles",
          },
        ],
        updatedContext: {
          ...ctx,
          lastDomain: "providers",
          lastFilters: {
            ...ctx.lastFilters,
            specialty: refinedSpecialty,
            zone: refinedZone,
            date: refinedDate,
            timeOfDay: refinedTime,
          },
        },
      };
    }

    // Cas 5B : Raffinement de rendez-vous (ex: "Et lesquels sont en attente ?")
    if (ctx.lastDomain === "appointments") {
      const refinedStatus =
        text.includes("attente") || text.includes("معلق")
          ? "en_attente"
          : text.includes("confirmé") || text.includes("مؤكد")
          ? "confirme"
          : ctx.lastFilters?.status;
      const refinedDate = extractDateEntity(text) || ctx.lastFilters?.date;

      return {
        type: "SINGLE_TOOL",
        steps: [
          {
            capabilityName: userRole === ROLES.PROFESSIONNEL && refinedStatus === "en_attente"
              ? "get_pending_appointment_requests"
              : "get_my_appointments",
            parameters: {
              date: refinedDate,
              status: refinedStatus,
            },
            description: "Consultation affinée des rendez-vous",
          },
        ],
        updatedContext: {
          ...ctx,
          lastDomain: "appointments",
          lastFilters: {
            ...ctx.lastFilters,
            date: refinedDate,
            status: refinedStatus,
          },
        },
      };
    }
  }

  // 6. Question multi-outils : "Quels patients que je vois demain ont déjà des constantes ?"
  if (
    userRole === ROLES.PROFESSIONNEL &&
    (text.includes("patients que je vois") || text.includes("rendez-vous demain avec un patient")) &&
    (text.includes("constante") || text.includes("suivi") || text.includes("dossier"))
  ) {
    const targetDate = extractDateEntity(text) || "tomorrow";
    return {
      type: "MULTI_TOOL",
      steps: [
        {
          capabilityName: "get_my_appointments",
          parameters: { date: targetDate },
          description: `Consulter les rendez-vous du professionnel pour ${targetDate}`,
        },
        {
          capabilityName: "get_patient_care_summary",
          parameters: { checkAllUpcomingPatients: true, date: targetDate },
          description: "Consulter les constantes cliniques des patients prévus",
        },
      ],
      updatedContext: { ...ctx, lastDomain: "appointments" },
    };
  }

  // 7. Découverte de soignants disponibles (find_available_providers)
  const isProviderDiscovery =
    (text.includes("disponible") ||
      text.includes("disponibilité") ||
      text.includes("libre") ||
      text.includes("peut venir") ||
      text.includes("peuvent intervenir") ||
      text.includes("intervenir") ||
      text.includes("cherche un") ||
      text.includes("trouver un") ||
      text.includes("متاح") ||
      text.includes("متوفر") ||
      text.includes("من يمكنه الحضور")) &&
    (text.includes("soignant") ||
      text.includes("infirmi") ||
      text.includes("médecin") ||
      text.includes("professionnel") ||
      text.includes("kiné") ||
      text.includes("sage-femme") ||
      text.includes("aide-soignant") ||
      text.includes("docteur") ||
      text.includes("qui") ||
      text.includes("طبيب") ||
      text.includes("ممرض"));

  if (isProviderDiscovery) {
    const specialty = extractSpecialtyEntity(text);
    const zone = extractZoneEntity(text);
    const date = extractDateEntity(text) || (text.includes("actuellement") ? "today" : undefined);
    const timeOfDay = text.includes("matin") ? "morning" : text.includes("soir") ? "evening" : undefined;

    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "find_available_providers",
          parameters: { specialty, zone, date, timeOfDay },
          description: "Rechercher les soignants disponibles dans l'annuaire vérifié",
        },
      ],
      updatedContext: {
        lastDomain: "providers",
        lastCapability: "find_available_providers",
        lastFilters: { specialty, zone, date, timeOfDay },
      },
    };
  }

  // 8. Consultation de mes patients pour le soignant (get_my_patients)
  if (
    userRole === ROLES.PROFESSIONNEL &&
    (text.includes("mes patients") ||
      text.includes("patients que je suis") ||
      text.includes("patients suivis") ||
      text.includes("patients déjà vus") ||
      text.includes("quels patients ai-je déjà vus") ||
      text.includes("suivi de constantes"))
  ) {
    const withChronicOnly = text.includes("constante") || text.includes("suivi");
    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "get_my_patients",
          parameters: { withChronicOnly },
          description: "Lister les patients suivis avec relation de soins établie",
        },
      ],
      updatedContext: {
        lastDomain: "chronic",
        lastCapability: "get_my_patients",
      },
    };
  }

  // 9. Demandes en attente du Professionnel (get_pending_appointment_requests)
  if (
    userRole === ROLES.PROFESSIONNEL &&
    (text.includes("demande en attente") ||
      text.includes("demandes en attente") ||
      text.includes("demandes reçues") ||
      text.includes("en attente demain") ||
      text.includes("combien de demandes"))
  ) {
    const targetDate = extractDateEntity(text);
    const isNextOnly = text.includes("prochaine") || text.includes("la première");

    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "get_pending_appointment_requests",
          parameters: { date: targetDate, isNextOnly },
          description: "Consulter les demandes de rendez-vous en attente de confirmation",
        },
      ],
      updatedContext: {
        lastDomain: "requests",
        lastCapability: "get_pending_appointment_requests",
        lastFilters: { date: targetDate, status: "en_attente" },
      },
    };
  }

  // 10. Rendez-vous et planning (get_my_appointments)
  if (
    text.includes("rendez-vous") ||
    text.includes("rdv") ||
    text.includes("planning") ||
    text.includes("agenda") ||
    text.includes("consultation") ||
    text.includes("موعد") ||
    text.includes("مواعيد") ||
    text.includes("جدول")
  ) {
    const date = extractDateEntity(text);
    const status = text.includes("confirmé") ? "confirme" : text.includes("attente") ? "en_attente" : undefined;
    const isNextOnly = text.includes("prochain") || text.includes("prochaine");

    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "get_my_appointments",
          parameters: { date, status, isNextOnly },
          description: "Consulter les rendez-vous programmés",
        },
      ],
      updatedContext: {
        lastDomain: "appointments",
        lastCapability: "get_my_appointments",
        lastFilters: { date, status },
      },
    };
  }

  // 11. Constantes de santé du patient (get_my_health_observations)
  if (
    text.includes("constante") ||
    text.includes("mesure") ||
    text.includes("tension") ||
    text.includes("glycémie") ||
    text.includes("pouls") ||
    text.includes("température") ||
    text.includes("ضغط") ||
    text.includes("مؤشرات")
  ) {
    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "get_my_health_observations",
          parameters: {},
          description: "Consulter les dernières constantes vitales",
        },
      ],
      updatedContext: {
        lastDomain: "chronic",
        lastCapability: "get_my_health_observations",
      },
    };
  }

  // 12. Suivi analyses HomeLab (get_homelab_status)
  if (
    text.includes("homelab") ||
    text.includes("analyse") ||
    text.includes("prélèvement") ||
    text.includes("prise de sang") ||
    text.includes("résultat de labo") ||
    text.includes("تحليل")
  ) {
    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "get_homelab_status",
          parameters: {},
          description: "Consulter le statut des analyses HomeLab",
        },
      ],
      updatedContext: {
        lastDomain: "homelab",
        lastCapability: "get_homelab_status",
      },
    };
  }

  // 13. Actions d'écriture sensibles (Demandes de confirmation)
  if (
    userRole === ROLES.PROFESSIONNEL &&
    (text.includes("confirme") || text.includes("valide la demande") || text.includes("أكد الموعد"))
  ) {
    return {
      type: "SINGLE_TOOL",
      steps: [
        {
          capabilityName: "confirm_appointment",
          parameters: { isNextOnly: true },
          description: "Confirmer la prochaine consultation en attente",
        },
      ],
      updatedContext: ctx,
    };
  }

  // 14. Clarification ciblée si ambigu
  if (text.includes("soignant") || text.includes("médecin") || text.includes("infirmier")) {
    return {
      type: "CLARIFICATION",
      steps: [],
      clarificationPromptFr:
        "Pour quelle spécialité ou zone recherchez-vous un soignant ? (ex: infirmier à Tevragh Zeina, médecin, kinésithérapeute)",
      clarificationPromptAr:
        "ما هو التخصص أو المنطقة المطلوبة للبحث عن ممارس صحي؟ (مثل: ممرض في تفرغ زينة، طبيب، أخصائي علاج طبيعي)",
      updatedContext: ctx,
    };
  }

  // 15. Repli général gracieux
  return {
    type: "CLARIFICATION",
    steps: [],
    clarificationPromptFr:
      userRole === ROLES.PROFESSIONNEL
        ? "Je peux vous aider à consulter vos rendez-vous, vos demandes en attente, trouver des confrères disponibles ou répondre à vos questions sur MauriCare (ex: Relay, HomeLab, Circle)."
        : "Je peux vous aider à vérifier les soignants disponibles, consulter vos rendez-vous, vos constantes de santé ou vous expliquer le fonctionnement de MauriCare.",
    clarificationPromptAr:
      userRole === ROLES.PROFESSIONNEL
        ? "يمكنني مساعدتك في استعراض مواعيدك، الطلبات المعلقة، البحث عن زملاء متاحين، أو الإجابة على استفساراتكم حول منصة موري كير."
        : "يمكنني مساعدتك في معرفة الممارسين المتاحين، مراجعة مواعيدك، مؤشراتك الحيوية، أو شرح خدمات موري كير.",
    updatedContext: ctx,
  };
}

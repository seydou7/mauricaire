import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import { createServerNotification } from "./notifications";
import { planAssistantRequest } from "./assistantPlanner";
import { executeAssistantPlan } from "./assistantExecutor";
import { queryPlatformKnowledge } from "./assistantKnowledge";
import { CAPABILITY_REGISTRY } from "./assistantRegistry";

async function requireAuthUser(ctx: any) {
  const userId = (await auth.getUserId(ctx)) as Id<"users"> | null;
  if (!userId) {
    throw new Error("Authentification requise");
  }
  const user = (await ctx.db.get(userId)) as Doc<"users"> | null;
  if (!user) {
    throw new Error("Compte utilisateur introuvable");
  }
  return { userId, user };
}

async function verifyCareRelationship(
  ctx: any,
  professionalUserId: Id<"users">,
  patientId: Id<"users">
) {
  const provider = (await ctx.db
    .query("providers")
    .withIndex("by_userId", (q: any) => q.eq("userId", professionalUserId))
    .first()) as Doc<"providers"> | null;

  if (!provider) return false;

  const appointments = await ctx.db
    .query("appointments")
    .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
    .filter((q: any) => q.eq(q.field("patientId"), patientId))
    .collect();

  return appointments.some(
    (a: any) =>
      a.status === APPOINTMENT_STATUS.CONFIRMED ||
      a.status === APPOINTMENT_STATUS.COMPLETED
  );
}

// ============================================================================
// CONSTANTES & ENUMERATIONS DES INTENTS CANONIQUES
// ============================================================================

export const CANONICAL_INTENTS = {
  BOOK_APPOINTMENT: "BOOK_APPOINTMENT",
  REBOOK_APPOINTMENT: "REBOOK_APPOINTMENT",
  CANCEL_APPOINTMENT: "CANCEL_APPOINTMENT",
  VIEW_UPCOMING_APPOINTMENTS: "VIEW_UPCOMING_APPOINTMENTS",
  VIEW_MY_APPOINTMENTS: "VIEW_MY_APPOINTMENTS",
  VIEW_PENDING_REQUESTS: "VIEW_PENDING_REQUESTS",
  CONFIRM_APPOINTMENT: "CONFIRM_APPOINTMENT",
  REJECT_APPOINTMENT: "REJECT_APPOINTMENT",
  NAVIGATE_TAB: "NAVIGATE_TAB",
  VIEW_PROVIDER_AVAILABILITY: "VIEW_PROVIDER_AVAILABILITY",
  VIEW_HOMELAB_STATUS: "VIEW_HOMELAB_STATUS",
  VIEW_HOMELAB_RESULT: "VIEW_HOMELAB_RESULT",
  CREATE_HOMELAB_REQUEST: "CREATE_HOMELAB_REQUEST",
  RECORD_HEALTH_MEASUREMENT: "RECORD_HEALTH_MEASUREMENT",
  VIEW_HEALTH_TREND: "VIEW_HEALTH_TREND",
  VIEW_CHRONIC_PROGRAM: "VIEW_CHRONIC_PROGRAM",
  CREATE_RELAY_REQUEST: "CREATE_RELAY_REQUEST",
  SEND_MESSAGE: "SEND_MESSAGE",
  MEDICAL_INQUIRY_BLOCKED: "MEDICAL_INQUIRY_BLOCKED",
  UNKNOWN_INTENT: "UNKNOWN_INTENT",
} as const;

export type CanonicalIntent = keyof typeof CANONICAL_INTENTS;

// Mots-clés de sécurité anti-injection de prompt
const PROMPT_INJECTION_PATTERNS = [
  /ignore.*(previous|all|instructions|rules|permissions)/i,
  /system\s*prompt/i,
  /dump\s*database/i,
  /bypass.*(auth|security|permission|circle|access)/i,
  /give\s*me\s*all\s*patients/i,
  /tous\s*les\s*dossiers/i,
  /contourne.*(sécurité|permission|droits)/i,
];

// Mots-clés de demandes médicales ou diagnostiques formellement interdites à l'IA
const MEDICAL_DIAGNOSIS_PATTERNS = [
  /qu['\s]est[- ]ce\s+que\s+j['\s]ai/i,
  /quel\s+m[eé]dicament/i,
  /quelle\s+dose/i,
  /posologie/i,
  /est[- ]ce\s+(grave|dangereux|un\s+infarctus|un\s+avc|le\s+cancer)/i,
  /interpr[eé]ter?\s+(mes\s+r[eé]sultats|mon\s+analyse|ma\s+prise\s+de\s+sang)/i,
  /j['\s]ai\s+mal\s+(au\s+coeur|[aà]\s+la\s+poitrine|au\s+bras)/i,
  /diagnostique/i,
  /ordonnance/i,
  /ما\s*هو\s*مرضي/,
  /ما\s*هو\s*الدواء/,
  /هل\s*هو\s*خطير/,
  /تشخيص/,
];

// ============================================================================
// HELPERS : DATES & TEMPORALITÉ CANONIQUE
// ============================================================================

export function getTodayDateString(refDate: Date = new Date()): string {
  return refDate.toISOString().split("T")[0];
}

export function getTomorrowDateString(refDate: Date = new Date()): string {
  const d = new Date(refDate);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

export function getAfterTomorrowDateString(refDate: Date = new Date()): string {
  const d = new Date(refDate);
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().split("T")[0];
}

export function getTargetDateString(keyword?: string, refDate: Date = new Date()): string | undefined {
  if (!keyword) return undefined;
  if (keyword === "today" || keyword === "aujourd'hui") return getTodayDateString(refDate);
  if (keyword === "tomorrow" || keyword === "demain") return getTomorrowDateString(refDate);
  if (keyword === "after_tomorrow" || keyword === "après-demain" || keyword === "apres-demain") return getAfterTomorrowDateString(refDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(keyword)) return keyword;
  return undefined;
}

// ============================================================================
// HELPER : PARSING SÉMANTIQUE DÉTERMINISTE D'INTENT (ROLE-AWARE)
// ============================================================================

interface ParsedCommand {
  intent: CanonicalIntent;
  confidence: number;
  entities: Record<string, any>;
  needsClarification: boolean;
  clarificationPromptFr?: string;
  clarificationPromptAr?: string;
}

export function parseIntentFromText(
  rawText: string,
  userRole: string,
  language: string = "fr"
): ParsedCommand {
  const text = rawText.trim().toLowerCase();

  // 1. Détection de tentative d'injection de prompt
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        intent: CANONICAL_INTENTS.UNKNOWN_INTENT,
        confidence: 0,
        entities: {},
        needsClarification: false,
      };
    }
  }

  // 2. Détection de question diagnostique ou médicale interdite (Zéro IA Diagnostique)
  for (const pattern of MEDICAL_DIAGNOSIS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        intent: CANONICAL_INTENTS.MEDICAL_INQUIRY_BLOCKED,
        confidence: 0.99,
        entities: { query: rawText },
        needsClarification: false,
        clarificationPromptFr:
          "MauriCare ne fournit aucun diagnostic médical automatisé ni prescription. Pour toute question clinique, veuillez consulter un praticien de santé ou contacter les urgences.",
        clarificationPromptAr:
          "لا يقدم تطبيق موري كير أي تشخيص طبي آلي أو وصفات علاجية. لأي استفسار صحي، يرجى استشارة ممارس صحي أو الاتصال بالطوارئ.",
      };
    }
  }

  // Extraction d'entités temporelles relatives (Section 6)
  let dateFilter: "today" | "tomorrow" | "after_tomorrow" | undefined;
  if (text.includes("demain") || text.includes("غدا") || text.includes("غداً")) {
    dateFilter = "tomorrow";
  } else if (
    text.includes("aujourd'hui") ||
    text.includes("aujourd hui") ||
    text.includes("ce jour") ||
    text.includes("اليوم")
  ) {
    dateFilter = "today";
  } else if (
    text.includes("après-demain") ||
    text.includes("apres-demain") ||
    text.includes("بعد غد")
  ) {
    dateFilter = "after_tomorrow";
  }

  const isNextOnly =
    text.includes("prochain") ||
    text.includes("prochaine") ||
    text.includes("prochains") ||
    text.includes("prochaines") ||
    text.includes("القادم") ||
    text.includes("القادمة");

  // Extraction d'entités de statut (Section 7)
  let statusFilter: string | undefined;
  if (
    text.includes("en attente") ||
    text.includes("à confirmer") ||
    text.includes("non traitée") ||
    text.includes("non confirmée") ||
    text.includes("reçue") ||
    text.includes("معلقة") ||
    text.includes("قيد الانتظار")
  ) {
    statusFilter = "en_attente";
  } else if (
    text.includes("confirmé") ||
    text.includes("confirmée") ||
    text.includes("accepté") ||
    text.includes("validé") ||
    text.includes("مؤكد")
  ) {
    statusFilter = "confirme";
  } else if (
    text.includes("terminé") ||
    text.includes("terminée") ||
    text.includes("passé") ||
    text.includes("effectué") ||
    text.includes("مكتمل")
  ) {
    statusFilter = "termine";
  }

  // 3. Commandes de navigation / ouverture d'onglets (Section 16)
  if (
    text.includes("ouvre") ||
    text.includes("ouvrir") ||
    text.includes("affiche") ||
    text.includes("accède") ||
    text.includes("voir") ||
    text.includes("افتح") ||
    text.includes("عرض")
  ) {
    if (text.includes("planning") || text.includes("agenda") || text.includes("جدول")) {
      return {
        intent: CANONICAL_INTENTS.NAVIGATE_TAB,
        confidence: 0.95,
        entities: { tab: "planning" },
        needsClarification: false,
      };
    }
    if (text.includes("demande") || text.includes("demandes") || text.includes("طلبات")) {
      return {
        intent: CANONICAL_INTENTS.NAVIGATE_TAB,
        confidence: 0.95,
        entities: { tab: "demandes" },
        needsClarification: false,
      };
    }
    if (text.includes("relay") || text.includes("ريلاي")) {
      return {
        intent: CANONICAL_INTENTS.NAVIGATE_TAB,
        confidence: 0.95,
        entities: { tab: "relay" },
        needsClarification: false,
      };
    }
    if (text.includes("homelab") || text.includes("mission") || text.includes("هوم لاب")) {
      return {
        intent: CANONICAL_INTENTS.NAVIGATE_TAB,
        confidence: 0.95,
        entities: { tab: "homelab" },
        needsClarification: false,
      };
    }
    if (text.includes("patient") || text.includes("patients") || text.includes("مرضى")) {
      return {
        intent: CANONICAL_INTENTS.NAVIGATE_TAB,
        confidence: 0.95,
        entities: { tab: "patients" },
        needsClarification: false,
      };
    }
    if (text.includes("profil") || text.includes("compte") || text.includes("ملف")) {
      return {
        intent: CANONICAL_INTENTS.NAVIGATE_TAB,
        confidence: 0.95,
        entities: { tab: "profil" },
        needsClarification: false,
      };
    }
  }

  // 4. Actions d'écriture Professionnel (Validation / Refus) (Section 12 & 13)
  if (userRole === ROLES.PROFESSIONNEL) {
    if (
      (text.includes("confirme") ||
        text.includes("valide") ||
        text.includes("accepte") ||
        text.includes("تأكيد") ||
        text.includes("قبول")) &&
      (text.includes("demande") ||
        text.includes("rendez-vous") ||
        text.includes("rdv") ||
        text.includes("consultation") ||
        text.includes("موعد") ||
        text.includes("طلب"))
    ) {
      return {
        intent: CANONICAL_INTENTS.CONFIRM_APPOINTMENT,
        confidence: 0.95,
        entities: { dateFilter, isNextOnly },
        needsClarification: false,
      };
    }

    if (
      (text.includes("refuse") ||
        text.includes("décline") ||
        text.includes("annule") ||
        text.includes("رفض") ||
        text.includes("إلغاء")) &&
      (text.includes("demande") ||
        text.includes("rendez-vous") ||
        text.includes("rdv") ||
        text.includes("consultation") ||
        text.includes("موعد") ||
        text.includes("طلب"))
    ) {
      return {
        intent: CANONICAL_INTENTS.REJECT_APPOINTMENT,
        confidence: 0.95,
        entities: { dateFilter, isNextOnly },
        needsClarification: false,
      };
    }
  }

  // 5. Demandes en attente Professionnel (Section 5)
  if (
    userRole === ROLES.PROFESSIONNEL &&
    (text.includes("demande") ||
      text.includes("demandes") ||
      text.includes("en attente") ||
      text.includes("à confirmer") ||
      text.includes("non traitée") ||
      text.includes("non confirmée") ||
      text.includes("طلبات") ||
      text.includes("قيد الانتظار") ||
      text.includes("معلقة"))
  ) {
    return {
      intent: CANONICAL_INTENTS.VIEW_PENDING_REQUESTS,
      confidence: 0.95,
      entities: {
        dateFilter,
        statusFilter: "en_attente",
        isNextOnly,
      },
      needsClarification: false,
    };
  }

  // 6. Mesure de santé (Chronic)
  if (
    text.includes("tension") ||
    text.includes("glycémie") ||
    text.includes("pouls") ||
    text.includes("poids") ||
    text.includes("température") ||
    text.includes("spo2") ||
    text.includes("ضغط") ||
    text.includes("سكر") ||
    text.includes("نبض") ||
    text.includes("حرارة") ||
    text.includes("وزن")
  ) {
    // Si l'utilisateur demande une courbe ou un historique
    if (
      text.includes("courbe") ||
      text.includes("graphe") ||
      text.includes("historique") ||
      text.includes("évolution") ||
      text.includes("montre") ||
      text.includes("voir") ||
      text.includes("رسم") ||
      text.includes("تطور") ||
      text.includes("سجل")
    ) {
      let metric = "blood_pressure";
      if (text.includes("glycémie") || text.includes("سكر")) metric = "blood_glucose";
      else if (text.includes("pouls") || text.includes("نبض")) metric = "heart_rate";
      else if (text.includes("poids") || text.includes("وزن")) metric = "weight";
      else if (text.includes("spo2")) metric = "spo2";
      else if (text.includes("température") || text.includes("حرارة")) metric = "temperature";

      return {
        intent: CANONICAL_INTENTS.VIEW_HEALTH_TREND,
        confidence: 0.95,
        entities: { metric, timeRange: text.includes("30") ? "30d" : text.includes("3 mois") ? "3m" : "7d" },
        needsClarification: false,
      };
    }

    // Sinon, enregistrement d'une mesure
    if (
      text.includes("ajoute") ||
      text.includes("enregistre") ||
      text.includes("note") ||
      text.includes("prise") ||
      text.includes("mesure") ||
      text.includes("سجل") ||
      text.includes("أضف") ||
      /\d+/.test(text)
    ) {
      let measurementCode = "blood_pressure";
      let numericValue: number | undefined;
      let secondaryNumericValue: number | undefined;
      let unit = "mmHg";

      // Pression artérielle : ex 135/85 ou 135 sur 85
      const bpMatch = text.match(/(\d{2,3})\s*(?:[/-]|sur)\s*(\d{2,3})/);
      if (bpMatch) {
        measurementCode = "blood_pressure";
        numericValue = parseInt(bpMatch[1], 10);
        secondaryNumericValue = parseInt(bpMatch[2], 10);
        unit = "mmHg";
      } else {
        const numMatch = text.match(/(\d+(?:[.,]\d+)?)/);
        if (numMatch) {
          numericValue = parseFloat(numMatch[1].replace(",", "."));
          if (text.includes("glycémie") || text.includes("سكر")) {
            measurementCode = "blood_glucose";
            unit = "mg/dL";
          } else if (text.includes("pouls") || text.includes("نبض")) {
            measurementCode = "heart_rate";
            unit = "bpm";
          } else if (text.includes("poids") || text.includes("وزن")) {
            measurementCode = "weight";
            unit = "kg";
          } else if (text.includes("température") || text.includes("حرارة")) {
            measurementCode = "temperature";
            unit = "°C";
          } else if (text.includes("spo2")) {
            measurementCode = "spo2";
            unit = "%";
          }
        }
      }

      if (numericValue !== undefined) {
        return {
          intent: CANONICAL_INTENTS.RECORD_HEALTH_MEASUREMENT,
          confidence: 0.95,
          entities: {
            measurementCode,
            numericValue,
            secondaryNumericValue,
            unit,
            context: text.includes("jeun") ? "fasting" : text.includes("repas") ? "post_meal" : "resting",
          },
          needsClarification: false,
        };
      }
    }
  }

  // 7. HomeLab (Analyses & Prélèvements)
  if (
    text.includes("homelab") ||
    text.includes("analyse") ||
    text.includes("laboratoire") ||
    text.includes("prise de sang") ||
    text.includes("prélèvement") ||
    text.includes("résultat") ||
    text.includes("مختبر") ||
    text.includes("تحليل") ||
    text.includes("فحص")
  ) {
    if (
      text.includes("programme") ||
      text.includes("réserve") ||
      text.includes("commander") ||
      text.includes("demande") ||
      text.includes("طلب") ||
      text.includes("حجز")
    ) {
      return {
        intent: CANONICAL_INTENTS.CREATE_HOMELAB_REQUEST,
        confidence: 0.9,
        entities: {
          beneficiary: text.includes("mère") ? "mother" : text.includes("père") ? "father" : "self",
        },
        needsClarification: false,
      };
    }

    if (text.includes("résultat") || text.includes("disponible") || text.includes("نتائج")) {
      return {
        intent: CANONICAL_INTENTS.VIEW_HOMELAB_RESULT,
        confidence: 0.9,
        entities: {},
        needsClarification: false,
      };
    }

    return {
      intent: CANONICAL_INTENTS.VIEW_HOMELAB_STATUS,
      confidence: 0.88,
      entities: {},
      needsClarification: false,
    };
  }

  // 8. MauriCare Relay (Avis confraternel pro)
  if (
    text.includes("relay") ||
    text.includes("avis d'un confrère") ||
    text.includes("avis confraternel") ||
    text.includes("demande l'avis") ||
    text.includes("استشارة زميل")
  ) {
    if (userRole !== ROLES.PROFESSIONNEL) {
      return {
        intent: CANONICAL_INTENTS.UNKNOWN_INTENT,
        confidence: 0,
        entities: {},
        needsClarification: false,
        clarificationPromptFr: "La fonction MauriCare Relay est réservée aux professionnels de santé agréés.",
        clarificationPromptAr: "خدمة MauriCare Relay مخصصة فقط للممارسين الصحيين المعتمدين.",
      };
    }

    return {
      intent: CANONICAL_INTENTS.CREATE_RELAY_REQUEST,
      confidence: 0.92,
      entities: {
        specialtyRequested: text.includes("cardio")
          ? "cardiologist"
          : text.includes("diab")
          ? "diabetologist"
          : "general_practitioner",
      },
      needsClarification: false,
    };
  }

  // 9. Rendez-vous, Consultations & Planning (Section 4, 8 & 9)
  if (
    text.includes("rendez-vous") ||
    text.includes("rdv") ||
    text.includes("consultation") ||
    text.includes("planning") ||
    text.includes("agenda") ||
    text.includes("soin") ||
    text.includes("infirmier") ||
    text.includes("infirmière") ||
    text.includes("médecin") ||
    text.includes("pansement") ||
    text.includes("perfusion") ||
    text.includes("injection") ||
    text.includes("sage-femme") ||
    text.includes("kiné") ||
    text.includes("موعد") ||
    text.includes("مواعيد") ||
    text.includes("جدول") ||
    text.includes("ممرض") ||
    text.includes("طبيب") ||
    text.includes("علاج") ||
    text.includes("ضماد") ||
    text.includes("j'ai quoi") ||
    text.includes("qu'est-ce que j'ai") ||
    text.includes("programme") ||
    text.includes("ماذا لدي")
  ) {
    // Annulation (Patient)
    if (
      userRole !== ROLES.PROFESSIONNEL &&
      (text.includes("annule") ||
        text.includes("supprime") ||
        text.includes("décommande") ||
        text.includes("إلغاء"))
    ) {
      return {
        intent: CANONICAL_INTENTS.CANCEL_APPOINTMENT,
        confidence: 0.9,
        entities: { targetDate: dateFilter || "upcoming" },
        needsClarification: false,
      };
    }

    // Role-Aware: Si Professionnel de santé
    if (userRole === ROLES.PROFESSIONNEL) {
      if (statusFilter === "en_attente") {
        return {
          intent: CANONICAL_INTENTS.VIEW_PENDING_REQUESTS,
          confidence: 0.95,
          entities: { dateFilter, statusFilter, isNextOnly },
          needsClarification: false,
        };
      }
      return {
        intent: CANONICAL_INTENTS.VIEW_MY_APPOINTMENTS,
        confidence: 0.95,
        entities: { dateFilter, statusFilter, isNextOnly },
        needsClarification: false,
      };
    }

    // Role-Aware: Si Patient consultant ses rendez-vous
    if (
      text.includes("mes rendez-vous") ||
      text.includes("prochain") ||
      text.includes("quand") ||
      text.includes("planning") ||
      text.includes("مواعيدي") ||
      text.includes("جدول")
    ) {
      return {
        intent: CANONICAL_INTENTS.VIEW_UPCOMING_APPOINTMENTS,
        confidence: 0.92,
        entities: { dateFilter, isNextOnly },
        needsClarification: false,
      };
    }

    // Réservation de soin par un Patient
    let specialty = "infirmier";
    if (text.includes("médecin") || text.includes("طبيب")) specialty = "medecin_generaliste";
    else if (text.includes("sage-femme") || text.includes("قابلة")) specialty = "sage_femme";
    else if (text.includes("kiné") || text.includes("physio") || text.includes("طبيعي")) specialty = "kinesitherapeute";

    let serviceName = "Soins infirmiers à domicile";
    if (text.includes("pansement") || text.includes("ضماد")) serviceName = "Pansement complexe / Plaie";
    else if (text.includes("perfusion") || text.includes("مصل")) serviceName = "Perfusion intraveineuse";
    else if (text.includes("injection") || text.includes("حقنة")) serviceName = "Injection sous-cutanée / IM";

    const datePreference = dateFilter || "asap";
    let timePreference = "anytime";
    if (text.includes("matin") || text.includes("صباح")) timePreference = "morning";
    else if (text.includes("soir") || text.includes("après-midi") || text.includes("مساء")) timePreference = "evening";

    let beneficiary = "self";
    if (text.includes("mère") || text.includes("maman") || text.includes("أمي")) beneficiary = "mother";
    else if (text.includes("père") || text.includes("papa") || text.includes("أبي")) beneficiary = "father";
    else if (text.includes("enfant") || text.includes("fils") || text.includes("fille") || text.includes("ابني")) beneficiary = "child";

    return {
      intent: CANONICAL_INTENTS.BOOK_APPOINTMENT,
      confidence: 0.88,
      entities: {
        specialty,
        serviceName,
        datePreference,
        timePreference,
        beneficiary,
      },
      needsClarification: false,
    };
  }

  // 10. Messagerie
  if (
    text.includes("message") ||
    text.includes("écris") ||
    text.includes("envoie") ||
    text.includes("dis à") ||
    text.includes("رسالة") ||
    text.includes("أرسل")
  ) {
    const content = rawText.replace(/^(envoie|écris|message|أرسل|رسالة).*(:|à|لـ)/i, "").trim();
    return {
      intent: CANONICAL_INTENTS.SEND_MESSAGE,
      confidence: 0.85,
      entities: { messageText: content || rawText },
      needsClarification: !content,
      clarificationPromptFr: "Quel message souhaitez-vous transmettre ?",
      clarificationPromptAr: "ما هي الرسالة التي تريد إرسالها؟",
    };
  }

  // 11. Inférence intelligente en repli (Section 14)
  if (dateFilter || isNextOnly) {
    if (userRole === ROLES.PROFESSIONNEL) {
      return {
        intent: CANONICAL_INTENTS.VIEW_MY_APPOINTMENTS,
        confidence: 0.8,
        entities: { dateFilter, isNextOnly },
        needsClarification: false,
      };
    }
    return {
      intent: CANONICAL_INTENTS.VIEW_UPCOMING_APPOINTMENTS,
      confidence: 0.8,
      entities: { dateFilter, isNextOnly },
      needsClarification: false,
    };
  }

  // Par défaut : Intention non reconnue avec suggestions adaptées au rôle
  const fallbackFr =
    userRole === ROLES.PROFESSIONNEL
      ? "Je n'ai pas bien compris votre commande. Vous pouvez consulter vos rendez-vous, vos demandes en attente ou ouvrir votre planning."
      : "Je n'ai pas bien compris votre demande. Vous pouvez réserver un soin, consulter vos résultats de laboratoire ou enregistrer une constante de santé.";
  const fallbackAr =
    userRole === ROLES.PROFESSIONNEL
      ? "لم أتمكن من فهم طلبكم جيداً. يمكنكم استعراض مواعيدكم، الطلبات المعلقة، أو فتح جدول المواعيد."
      : "لم أتمكن من فهم طلبك جيداً. يمكنك حجز موعد، الاطلاع على نتائج المختبر، أو تسجيل مؤشر صحي.";

  return {
    intent: CANONICAL_INTENTS.UNKNOWN_INTENT,
    confidence: 0.3,
    entities: { raw: rawText },
    needsClarification: true,
    clarificationPromptFr: fallbackFr,
    clarificationPromptAr: fallbackAr,
  };
}

// ============================================================================
// MUTATION : TRAITEMENT D'UNE COMMANDE CONVERSATIONNELLE & PRÉPARATION D'ACTION
// ============================================================================

export const processAssistantCommand = mutation({
  args: {
    text: v.string(),
    inputMode: v.union(v.literal("voice"), v.literal("text")),
    language: v.optional(v.string()), // "fr" | "ar"
    activePatientId: v.optional(v.id("users")), // Contexte patient actif si pro ou cercle
    currentSection: v.optional(v.string()), // Section courante UI
    sessionContext: v.optional(v.any()), // Contexte conversationnel / mémoire de session
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const lang = args.language || "fr";
    const now = Date.now();

    // 1. Évaluation via le Planificateur Général MauriCare (General Platform Agent)
    const plan = planAssistantRequest(
      args.text,
      (user.role || ROLES.PATIENT),
      lang,
      args.sessionContext,
      args.currentSection
    );

    // 1A. Demande bloquée déontologiquement ou sécurité
    if (plan.type === "BLOCKED") {
      const interactionId = await ctx.db.insert("assistantInteractions", {
        userId,
        role: (user.role || ROLES.PATIENT),
        inputMode: args.inputMode,
        language: lang,
        sanitizedTranscript: args.text.slice(0, 200),
        detectedIntent: "BLOCKED",
        status: "completed",
        createdAt: now,
      });

      return {
        interactionId,
        intent: "BLOCKED",
        status: "COMPLETED",
        responseMessage:
          lang === "ar" ? plan.clarificationPromptAr : plan.clarificationPromptFr,
        actionPreview: null,
        actionPayload: null,
        sessionContext: plan.updatedContext,
      };
    }

    // 1B. Base de connaissances de la plateforme MauriCare (Questions produit / FAQ)
    if (plan.type === "KNOWLEDGE" && plan.knowledgeAnswer) {
      const interactionId = await ctx.db.insert("assistantInteractions", {
        userId,
        role: (user.role || ROLES.PATIENT),
        inputMode: args.inputMode,
        language: lang,
        sanitizedTranscript: args.text.slice(0, 200),
        detectedIntent: "PLATFORM_KNOWLEDGE",
        status: "completed",
        createdAt: now,
      });

      return {
        interactionId,
        intent: "PLATFORM_KNOWLEDGE",
        status: "COMPLETED",
        responseMessage: plan.knowledgeAnswer,
        actionPreview: null,
        actionPayload: null,
        executedTools: ["knowledge_base"],
        sessionContext: plan.updatedContext,
      };
    }

    // 1C. Navigation directe (Fast Path)
    if (plan.type === "FAST_PATH" && plan.fastPathIntent === "NAVIGATE_TAB") {
      const targetSection = plan.steps[0]?.parameters?.section || "planning";
      const interactionId = await ctx.db.insert("assistantInteractions", {
        userId,
        role: (user.role || ROLES.PATIENT),
        inputMode: args.inputMode,
        language: lang,
        sanitizedTranscript: args.text.slice(0, 200),
        detectedIntent: "NAVIGATE_TAB",
        status: "completed",
        createdAt: now,
      });

      return {
        interactionId,
        intent: "NAVIGATE_TAB",
        status: "EXECUTE_DIRECT",
        responseMessage:
          lang === "ar"
            ? `جاري الانتقال إلى ${targetSection}...`
            : `Ouverture de la section ${targetSection}...`,
        actionPreview: {
          type: "open_tab",
          tab: targetSection,
        },
        actionPayload: null,
        executedTools: ["open_dashboard_section"],
        sessionContext: plan.updatedContext,
      };
    }

    // 1D. Outils du General Agent (SINGLE_TOOL ou MULTI_TOOL)
    if (plan.type === "SINGLE_TOOL" || plan.type === "MULTI_TOOL") {
      const execResult = await executeAssistantPlan(ctx, plan, userId, user, lang);

      const interactionId = await ctx.db.insert("assistantInteractions", {
        userId,
        role: (user.role || ROLES.PATIENT),
        inputMode: args.inputMode,
        language: lang,
        sanitizedTranscript: args.text.slice(0, 200),
        detectedIntent: plan.steps[0]?.capabilityName || "GENERAL_AGENT",
        status: execResult.status === "NEED_CONFIRMATION" ? "ready_for_confirmation" : "completed",
        createdAt: now,
      });

      return {
        interactionId,
        intent: plan.steps[0]?.capabilityName || "GENERAL_AGENT",
        status: execResult.status,
        responseMessage: execResult.responseMessage,
        actionPreview: execResult.actionPreview,
        actionPayload: execResult.actionPayload,
        executedTools: execResult.executedTools,
        sessionContext: plan.updatedContext,
      };
    }

    // 2. Fast paths déterministes additionnels
    const parsed = parseIntentFromText(args.text, (user.role || 'patient'), lang);

    // Journalisation minimale de l'interaction
    const interactionId = await ctx.db.insert("assistantInteractions", {
      userId,
      role: (user.role || 'patient'),
      inputMode: args.inputMode,
      language: lang,
      sanitizedTranscript: args.text.slice(0, 200),
      detectedIntent: parsed.intent,
      status: parsed.needsClarification
        ? "clarification_needed"
        : parsed.intent === CANONICAL_INTENTS.MEDICAL_INQUIRY_BLOCKED
        ? "completed"
        : "ready_for_confirmation",
      createdAt: now,
    });

    // Cas 1 : Demande bloquée déontologiquement
    if (parsed.intent === CANONICAL_INTENTS.MEDICAL_INQUIRY_BLOCKED) {
      return {
        interactionId,
        intent: parsed.intent,
        status: "COMPLETED",
        responseMessage:
          lang === "ar"
            ? parsed.clarificationPromptAr
            : parsed.clarificationPromptFr,
        actionPreview: null,
        actionPayload: null,
        sessionContext: plan.updatedContext,
      };
    }

    // Cas 2 : Besoin d'éclaircissement / repli gracieux
    if (parsed.needsClarification) {
      return {
        interactionId,
        intent: parsed.intent,
        status: "NEEDS_CLARIFICATION",
        responseMessage:
          lang === "ar"
            ? plan.clarificationPromptAr || parsed.clarificationPromptAr
            : plan.clarificationPromptFr || parsed.clarificationPromptFr,
        actionPreview: null,
        actionPayload: null,
        sessionContext: plan.updatedContext,
      };
    }

    // Cas 3 : Actions de lecture directe (READ-ONLY)

    // A. Navigation / Ouverture d'onglets (Section 16)
    if (parsed.intent === CANONICAL_INTENTS.NAVIGATE_TAB) {
      const targetTab = parsed.entities.tab || "planning";
      const tabLabel =
        targetTab === "planning"
          ? "votre planning"
          : targetTab === "demandes"
          ? "vos demandes en attente"
          : targetTab === "relay"
          ? "l'espace MauriCare Relay"
          : targetTab === "homelab"
          ? "l'espace HomeLab"
          : targetTab === "patients"
          ? "votre liste de patients"
          : targetTab;

      return {
        interactionId,
        intent: parsed.intent,
        status: "EXECUTE_DIRECT",
        responseMessage:
          lang === "ar"
            ? `جاري الانتقال إلى ${targetTab}...`
            : `Ouverture de ${tabLabel}...`,
        actionPreview: {
          type: "open_tab",
          tab: targetTab,
        },
        actionPayload: null,
      };
    }

    // B. Demandes en attente du Professionnel (Section 5)
    if (parsed.intent === CANONICAL_INTENTS.VIEW_PENDING_REQUESTS) {
      if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage:
            lang === "ar"
              ? "هذه الخاصية مخصصة للممارسين الصحيين لمتابعة الطلبات الواردة."
              : "La consultation des demandes reçues en attente est réservée aux professionnels de santé.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!provider) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage:
            lang === "ar"
              ? "تعذر العثور على ملف ممارس صحي مرتبط بهذا الحساب."
              : "Je n'ai pas pu consulter votre planning pour le moment (profil praticien introuvable).",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const pendingRequests = await ctx.db
        .query("appointments")
        .withIndex("by_provider_status", (q: any) =>
          q.eq("providerId", provider._id).eq("status", APPOINTMENT_STATUS.PENDING)
        )
        .collect();

      const targetDateStr = getTargetDateString(parsed.entities.dateFilter);
      let filtered = pendingRequests;
      if (targetDateStr) {
        filtered = filtered.filter((a) => a.date === targetDateStr);
      }

      filtered.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

      if (parsed.entities.isNextOnly && filtered.length > 0) {
        filtered = [filtered[0]];
      }

      if (filtered.length === 0) {
        let msg = "Vous n'avez aucune demande en attente actuellement.";
        if (parsed.entities.dateFilter === "tomorrow") {
          msg = "Vous n'avez aucune demande en attente pour demain.";
        } else if (parsed.entities.dateFilter === "today") {
          msg = "Vous n'avez aucune demande en attente pour aujourd'hui.";
        }
        const msgAr =
          parsed.entities.dateFilter === "tomorrow"
            ? "ليس لديك أي طلبات معلقة ليوم غد."
            : parsed.entities.dateFilter === "today"
            ? "ليس لديك أي طلبات معلقة اليوم."
            : "ليس لديك أي طلبات معلقة حالياً.";

        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage: lang === "ar" ? msgAr : msg,
          actionPreview: {
            type: "appointment_list",
            items: [],
          },
          actionPayload: null,
        };
      }

      const enriched = await Promise.all(
        filtered.map(async (a) => {
          const patient = await ctx.db.get(a.patientId);
          return {
            id: a._id,
            date: a.date,
            time: a.time,
            status: a.status,
            serviceType: a.serviceType || "Consultation",
            patientName: patient?.name || patient?.email || "Patient",
            address: a.address || patient?.city || "Nouakchott",
          };
        })
      );

      const dateLabel =
        parsed.entities.dateFilter === "tomorrow"
          ? (lang === "ar" ? "غداً" : "demain")
          : parsed.entities.dateFilter === "today"
          ? (lang === "ar" ? "اليوم" : "aujourd'hui")
          : "";

      let responseMessage = "";
      if (lang === "ar") {
        responseMessage =
          `لديك ${enriched.length} طلب${enriched.length > 1 ? "ات" : ""} في الانتظار ${dateLabel} :\n` +
          enriched.map((e) => `• ${e.time} — ${e.patientName} — ${e.serviceType}`).join("\n");
      } else {
        responseMessage =
          `Vous avez ${enriched.length} demande(s) en attente ${dateLabel} :\n` +
          enriched.map((e) => `• ${e.time} — ${e.patientName} — ${e.serviceType}`).join("\n");
      }

      return {
        interactionId,
        intent: parsed.intent,
        status: "EXECUTE_DIRECT",
        responseMessage,
        actionPreview: {
          type: "appointment_list",
          items: enriched,
        },
        actionPayload: null,
      };
    }

    // C. Planning & Rendez-vous (Role-Aware : Professionnel vs Patient) (Section 4, 8 & 9)
    if (
      parsed.intent === CANONICAL_INTENTS.VIEW_MY_APPOINTMENTS ||
      parsed.intent === CANONICAL_INTENTS.VIEW_UPCOMING_APPOINTMENTS
    ) {
      if ((user.role || 'patient') === ROLES.PROFESSIONNEL) {
        const provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first();

        if (!provider) {
          return {
            interactionId,
            intent: parsed.intent,
            status: "EXECUTE_DIRECT",
            responseMessage:
              lang === "ar"
                ? "تعذر العثور على ملف ممارس صحي مرتبط بهذا الحساب."
                : "Je n'ai pas pu consulter votre planning pour le moment (profil praticien introuvable).",
            actionPreview: null,
            actionPayload: null,
          };
        }

        const allAppointments = await ctx.db
          .query("appointments")
          .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
          .collect();

        const todayStr = getTodayDateString();
        const tomorrowStr = getTomorrowDateString();

        let filtered = allAppointments;

        if (parsed.entities.dateFilter === "tomorrow") {
          filtered = filtered.filter((a) => a.date === tomorrowStr);
        } else if (parsed.entities.dateFilter === "today") {
          filtered = filtered.filter((a) => a.date === todayStr);
        } else if (parsed.entities.dateFilter) {
          const explicitDate = getTargetDateString(parsed.entities.dateFilter);
          if (explicitDate) {
            filtered = filtered.filter((a) => a.date === explicitDate);
          }
        } else {
          filtered = filtered.filter(
            (a) => a.date >= todayStr && a.status !== APPOINTMENT_STATUS.CANCELLED
          );
        }

        if (parsed.entities.statusFilter) {
          filtered = filtered.filter((a) => a.status === parsed.entities.statusFilter);
        } else {
          filtered = filtered.filter((a) => a.status !== APPOINTMENT_STATUS.CANCELLED);
        }

        filtered.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

        if (parsed.entities.isNextOnly && filtered.length > 0) {
          filtered = [filtered[0]];
        }

        if (filtered.length === 0) {
          let msg = "Vous n'avez aucun rendez-vous à venir dans votre planning.";
          if (parsed.entities.dateFilter === "tomorrow") {
            msg = "Vous n'avez aucun rendez-vous prévu pour demain.";
          } else if (parsed.entities.dateFilter === "today") {
            msg = "Vous n'avez aucun rendez-vous prévu pour aujourd'hui.";
          }
          const msgAr =
            parsed.entities.dateFilter === "tomorrow"
              ? "ليس لديك أي مواعيد مقررة ليوم غد."
              : parsed.entities.dateFilter === "today"
              ? "ليس لديك أي مواعيد مقررة لليوم."
              : "ليس لديك أي مواعيد قادمة في جدولك.";

          return {
            interactionId,
            intent: parsed.intent,
            status: "EXECUTE_DIRECT",
            responseMessage: lang === "ar" ? msgAr : msg,
            actionPreview: {
              type: "appointment_list",
              items: [],
            },
            actionPayload: null,
          };
        }

        const enriched = await Promise.all(
          filtered.map(async (a) => {
            const patient = await ctx.db.get(a.patientId);
            const statusLabel =
              a.status === "confirme"
                ? (lang === "ar" ? "مؤكد" : "Confirmé")
                : a.status === "en_attente"
                ? (lang === "ar" ? "قيد الانتظار" : "En attente")
                : a.status === "termine"
                ? (lang === "ar" ? "مكتمل" : "Terminé")
                : (lang === "ar" ? "ملغي" : "Annulé");

            return {
              id: a._id,
              date: a.date,
              time: a.time,
              status: a.status,
              statusLabel,
              serviceType: a.serviceType || "Consultation",
              patientName: patient?.name || patient?.email || "Patient",
              address: a.address || patient?.city || "Nouakchott",
            };
          })
        );

        let responseMessage = "";
        if (parsed.entities.isNextOnly) {
          const next = enriched[0];
          const isTomorrow = next.date === tomorrowStr;
          const isToday = next.date === todayStr;
          const dateText = isTomorrow
            ? (lang === "ar" ? "غداً" : "demain")
            : isToday
            ? (lang === "ar" ? "اليوم" : "aujourd'hui")
            : next.date;
          responseMessage =
            lang === "ar"
              ? `موعدك القادم مقرر ${dateText} على الساعة ${next.time} مع ${next.patientName} (${next.serviceType} — ${next.statusLabel}).`
              : `Votre prochain rendez-vous est prévu ${dateText} à ${next.time} avec ${next.patientName} (${next.serviceType} — ${next.statusLabel}).`;
        } else {
          const dateLabel =
            parsed.entities.dateFilter === "tomorrow"
              ? (lang === "ar" ? "غداً" : "demain")
              : parsed.entities.dateFilter === "today"
              ? (lang === "ar" ? "اليوم" : "aujourd'hui")
              : (lang === "ar" ? "القادمة" : "prévu(s)");

          if (lang === "ar") {
            responseMessage =
              `لديك ${enriched.length} موعد ${dateLabel} :\n` +
              enriched
                .map((e) => `• ${e.time} — ${e.patientName} — ${e.serviceType} (${e.statusLabel})`)
                .join("\n");
          } else {
            responseMessage =
              `Vous avez ${enriched.length} rendez-vous ${dateLabel} :\n` +
              enriched
                .map((e) => `• ${e.time} — ${e.patientName} — ${e.serviceType} (${e.statusLabel})`)
                .join("\n");
          }
        }

        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage,
          actionPreview: {
            type: "appointment_list",
            items: enriched,
          },
          actionPayload: null,
        };
      }

      // --- CAS PATIENT ---
      const todayStr = getTodayDateString();
      const allPatientAppointments = await ctx.db
        .query("appointments")
        .withIndex("by_patient", (q: any) => q.eq("patientId", userId))
        .collect();

      const filtered = allPatientAppointments.filter(
        (a) => a.date >= todayStr && a.status !== APPOINTMENT_STATUS.CANCELLED
      );
      filtered.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

      if (filtered.length === 0) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage:
            lang === "ar"
              ? "ليس لديك أي مواعيد قادمة مسجلة في جدولك."
              : "Vous n'avez aucun rendez-vous à venir actuellement.",
          actionPreview: {
            type: "appointment_list",
            items: [],
          },
          actionPayload: null,
        };
      }

      const enriched = await Promise.all(
        filtered.slice(0, 3).map(async (a) => {
          const provider = await ctx.db.get(a.providerId);
          const provUser = provider ? await ctx.db.get(provider.userId) : null;
          return {
            id: a._id,
            date: a.date,
            time: a.time,
            status: a.status,
            providerName: provUser?.name || "Professionnel",
            serviceType: a.serviceType || "Consultation",
          };
        })
      );

      return {
        interactionId,
        intent: parsed.intent,
        status: "EXECUTE_DIRECT",
        responseMessage:
          lang === "ar"
            ? `لديك ${enriched.length} مواعيد قادمة مسجلة في جدولك.`
            : `Vous avez ${enriched.length} rendez-vous prévu(s) prochainement.`,
        actionPreview: {
          type: "appointment_list",
          items: enriched,
        },
        actionPayload: null,
      };
    }

    if (parsed.intent === CANONICAL_INTENTS.VIEW_HOMELAB_STATUS) {
      const targetId = args.activePatientId || userId;
      const requests = await ctx.db
        .query("homeLabRequests")
        .withIndex("by_patient", (q: any) => q.eq("patientId", targetId))
        .order("desc")
        .take(2);

      const latest = requests[0];
      return {
        interactionId,
        intent: parsed.intent,
        status: "EXECUTE_DIRECT",
        responseMessage: latest
          ? lang === "ar"
            ? `آخر طلب فحص منزلي (${latest.sampleCode}) حالته حالياً: ${latest.status}.`
            : `Votre demande HomeLab (${latest.sampleCode}) est actuellement au statut : ${latest.status}.`
          : lang === "ar"
          ? "لم يتم العثور على أي تحاليل مخبرية منزلية حديثة."
          : "Aucune demande HomeLab récente n'a été trouvée.",
        actionPreview: latest
          ? {
              type: "homelab_status",
              requestNumber: latest.sampleCode,
              status: latest.status,
              createdAt: new Date(latest.createdAt).toLocaleDateString(),
            }
          : null,
        actionPayload: null,
      };
    }

    if (parsed.intent === CANONICAL_INTENTS.VIEW_HEALTH_TREND) {
      return {
        interactionId,
        intent: parsed.intent,
        status: "EXECUTE_DIRECT",
        responseMessage:
          lang === "ar"
            ? `عرض رسم تطور ${parsed.entities.metric || "المؤشرات"} على لوحة المتابعة.`
            : `Affichage de la tendance graphique de ${parsed.entities.metric || "vos constantes"}.`,
        actionPreview: {
          type: "open_tab",
          tab: "chronic",
          metric: parsed.entities.metric,
        },
        actionPayload: null,
      };
    }

    // Cas 4 : Actions sensibles d'écriture nécessitant une confirmation explicite (WRITE)

    // A. Enregistrement d'une constante de santé (Chronic)
    if (parsed.intent === CANONICAL_INTENTS.RECORD_HEALTH_MEASUREMENT) {
      const e = parsed.entities;
      const targetPatientId = args.activePatientId || userId;
      const displayVal =
        e.measurementCode === "blood_pressure"
          ? `${e.numericValue}/${e.secondaryNumericValue} ${e.unit}`
          : `${e.numericValue} ${e.unit}`;

      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `هل ترغب في تسجيل ${displayVal} في ملف متابعتك الصحية؟`
            : `Confirmez-vous l'enregistrement de ${displayVal} dans votre suivi santé ?`,
        actionPreview: {
          title: lang === "ar" ? "تسجيل قياس صحي" : "Enregistrement d'une constante",
          beneficiary: user.name || "Moi-même",
          measurementCode: e.measurementCode,
          valueFormatted: displayVal,
          context: e.context,
          dateFormatted: new Date(now).toLocaleDateString(lang === "ar" ? "ar-MA" : "fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        actionPayload: {
          type: "RECORD_HEALTH_MEASUREMENT",
          patientId: targetPatientId,
          measurementCode: e.measurementCode,
          numericValue: e.numericValue,
          secondaryNumericValue: e.secondaryNumericValue,
          unit: e.unit,
          context: e.context,
        },
      };
    }

    // B. Réservation de soin
    if (parsed.intent === CANONICAL_INTENTS.BOOK_APPOINTMENT) {
      const e = parsed.entities;

      // Résolution du bénéficiaire si Circle
      let targetBeneficiaryId = userId;
      let beneficiaryName = user.name || "Moi-même";

      if (e.beneficiary && e.beneficiary !== "self") {
        const circleMembers = await ctx.db
          .query("circleMembers")
          .withIndex("by_memberUserId", (q: any) => q.eq("memberUserId", userId))
          .filter((q: any) => q.eq(q.field("status"), "active"))
          .collect();

        if (circleMembers.length === 1) {
          const relation = circleMembers[0];
          // Vérification de la permission BOOK_APPOINTMENTS
          const perms = relation.permissions || [];
          if (!perms.includes("book_appointments") && !perms.includes("BOOK_APPOINTMENTS")) {
            return {
              interactionId,
              intent: parsed.intent,
              status: "BLOCKED",
              responseMessage:
                lang === "ar"
                  ? "ليس لديك تصريح لحجز المواعيد نيابة عن هذا القريب في دائرة الرعاية."
                  : "Votre statut dans le Cercle de proches ne vous accorde pas le droit de réserver des soins pour ce proche.",
              actionPreview: null,
              actionPayload: null,
            };
          }
          targetBeneficiaryId = relation.patientId;
          const patientUser = await ctx.db.get(relation.patientId);
          if (patientUser) beneficiaryName = patientUser.name || 'Proche';
        } else if (circleMembers.length > 1) {
          return {
            interactionId,
            intent: parsed.intent,
            status: "NEEDS_CLARIFICATION",
            responseMessage:
              lang === "ar"
                ? "لديك عدة أقارب مسجلين. يرجى تحديد اسم القريب المطلوب."
                : "Vous accompagnez plusieurs proches dans votre Cercle. Veuillez préciser le nom du proche concerné.",
            actionPreview: null,
            actionPayload: null,
          };
        }
      }

      // Date cible approximative
      const targetDate = new Date();
      if (e.datePreference === "tomorrow") {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (e.datePreference === "friday") {
        targetDate.setDate(targetDate.getDate() + ((5 - targetDate.getDay() + 7) % 7 || 7));
      }
      const dateStr = targetDate.toLocaleDateString(lang === "ar" ? "ar-MA" : "fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `تأكيد حجز ${e.serviceName} لصالح ${beneficiaryName} بتاريخ ${dateStr}؟`
            : `Confirmez-vous la demande de ${e.serviceName} pour ${beneficiaryName} le ${dateStr} ?`,
        actionPreview: {
          title: lang === "ar" ? "تأكيد طلب موعد" : "Demande de rendez-vous de soin",
          beneficiary: beneficiaryName,
          service: e.serviceName,
          specialty: e.specialty,
          dateFormatted: dateStr,
          timePreference: e.timePreference === "morning" ? "Matin" : "Après-midi / Soir",
          priceIndicative: "450 MRU (Règlement sur place)",
        },
        actionPayload: {
          type: "BOOK_APPOINTMENT",
          patientId: targetBeneficiaryId,
          specialty: e.specialty,
          serviceName: e.serviceName,
          dateTimestamp: targetDate.getTime(),
          timeSlot: e.timePreference === "morning" ? "09:30" : "16:00",
        },
      };
    }

    // C. Commande de prélèvement HomeLab
    if (parsed.intent === CANONICAL_INTENTS.CREATE_HOMELAB_REQUEST) {
      let targetBeneficiaryId = userId;
      let beneficiaryName = user.name || "Moi-même";

      // Si la commande est pour un tiers (Cercle de proches)
      if (parsed.entities.beneficiary && parsed.entities.beneficiary !== "self") {
        const circleMembers = await ctx.db
          .query("circleMembers")
          .withIndex("by_memberUserId", (q: any) => q.eq("memberUserId", userId))
          .filter((q: any) => q.eq(q.field("status"), "active"))
          .collect();

        if (circleMembers.length > 0) {
          const relation = circleMembers[0];
          const perms = relation.permissions || [];
          if (!perms.includes("manage_homelab") && !perms.includes("MANAGE_HOMELAB")) {
            return {
              interactionId,
              intent: parsed.intent,
              status: "BLOCKED",
              responseMessage:
                lang === "ar"
                  ? "طلب التحاليل المخبرية نيابة عن قريب يتطلب تصريح MANAGE_HOMELAB صريحاً."
                  : "La commande d'analyses HomeLab pour un proche requiert expressément l'habilitation MANAGE_HOMELAB.",
              actionPreview: null,
              actionPayload: null,
            };
          }
          targetBeneficiaryId = relation.patientId;
          const pUser = await ctx.db.get(relation.patientId);
          if (pUser) beneficiaryName = pUser.name || 'Proche';
        }
      }

      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `تأكيد طلب زيارة أخذ عينات مخبرية لصالح ${beneficiaryName}؟`
            : `Confirmez-vous la programmation d'un prélèvement HomeLab à domicile pour ${beneficiaryName} ?`,
        actionPreview: {
          title: lang === "ar" ? "طلب تحاليل HomeLab" : "Prélèvement biologique HomeLab",
          beneficiary: beneficiaryName,
          type: "Bilan standard à domicile",
          collectionFee: "200 MRU",
          reminder: "Ordonnance médicale à présenter au préleveur",
        },
        actionPayload: {
          type: "CREATE_HOMELAB_REQUEST",
          beneficiaryId: targetBeneficiaryId,
        },
      };
    }

    // D. Demande d'avis confraternel Relay (Réservé soignant)
    if (parsed.intent === CANONICAL_INTENTS.CREATE_RELAY_REQUEST) {
      if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "BLOCKED",
          responseMessage: "Cette action est réservée aux soignants agréés.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? "هل ترغب في فتح استشارة طبية مشتركة (Relay) مع أخصائي؟"
            : "Confirmez-vous l'ouverture d'une demande d'avis confraternel Relay ?",
        actionPreview: {
          title: "Demande d'avis confraternel Relay",
          specialty: parsed.entities.specialtyRequested || "Médecine générale",
          urgency: "Standard (24-48h)",
        },
        actionPayload: {
          type: "CREATE_RELAY_REQUEST",
          specialty: parsed.entities.specialtyRequested,
        },
      };
    }

    // D. Envoi de message
    if (parsed.intent === CANONICAL_INTENTS.SEND_MESSAGE) {
      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `تأكيد إرسال الرسالة: « ${parsed.entities.messageText} » ؟`
            : `Confirmez-vous l'envoi du message : « ${parsed.entities.messageText} » ?`,
        actionPreview: {
          title: lang === "ar" ? "إرسال رسالة" : "Envoi d'un message",
          content: parsed.entities.messageText,
        },
        actionPayload: {
          type: "SEND_MESSAGE",
          text: parsed.entities.messageText,
        },
      };
    }

    // E. Validation de consultation par le praticien (CONFIRM_APPOINTMENT) (Section 12 & 13)
    if (parsed.intent === CANONICAL_INTENTS.CONFIRM_APPOINTMENT) {
      if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "BLOCKED",
          responseMessage: "Seul le praticien assigné peut confirmer une consultation.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!provider) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "BLOCKED",
          responseMessage: "Profil praticien introuvable.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const pending = await ctx.db
        .query("appointments")
        .withIndex("by_provider_status", (q: any) =>
          q.eq("providerId", provider._id).eq("status", APPOINTMENT_STATUS.PENDING)
        )
        .collect();

      const targetDateStr = getTargetDateString(parsed.entities.dateFilter);
      let candidates = pending;
      if (targetDateStr) {
        candidates = candidates.filter((a) => a.date === targetDateStr);
      }
      candidates.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

      if (candidates.length === 0) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage:
            lang === "ar"
              ? "ليس لديك أي طلبات معلقة لتأكيدها."
              : "Vous n'avez aucune demande en attente à confirmer.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      // Gestion de l'ambiguïté (Section 13)
      if (candidates.length > 1 && !parsed.entities.isNextOnly) {
        const choices = await Promise.all(
          candidates.slice(0, 3).map(async (c, i) => {
            const p = await ctx.db.get(c.patientId);
            return `${i + 1}) ${c.date} à ${c.time} — ${p?.name || "Patient"} (${c.serviceType || "Soin"})`;
          })
        );

        return {
          interactionId,
          intent: parsed.intent,
          status: "NEEDS_CLARIFICATION",
          responseMessage:
            lang === "ar"
              ? `لديك ${candidates.length} طلبات معلقة. أي منها ترغب في تأكيده ؟\n${choices.join("\n")}`
              : `Vous avez ${candidates.length} demandes en attente. Laquelle souhaitez-vous confirmer ?\n${choices.join("\n")}`,
          actionPreview: null,
          actionPayload: null,
        };
      }

      const targetAppt = candidates[0];
      const patient = await ctx.db.get(targetAppt.patientId);
      const patientName = patient?.name || patient?.email || "Patient";

      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `هل تؤكد قبول موعد ${patientName} يوم ${targetAppt.date} على الساعة ${targetAppt.time} ؟`
            : `Confirmez-vous l'acceptation du rendez-vous de ${patientName} prévu le ${targetAppt.date} à ${targetAppt.time} ?`,
        actionPreview: {
          title: "Confirmation de consultation",
          beneficiary: patientName,
          service: targetAppt.serviceType || "Consultation",
          dateFormatted: targetAppt.date,
          timePreference: targetAppt.time,
          priceIndicative: targetAppt.serviceSnapshot?.price
            ? `${targetAppt.serviceSnapshot.price} MRU`
            : undefined,
        },
        actionPayload: {
          type: "CONFIRM_APPOINTMENT",
          appointmentId: targetAppt._id,
          patientId: targetAppt.patientId,
        },
      };
    }

    // F. Refus de consultation par le praticien (REJECT_APPOINTMENT)
    if (parsed.intent === CANONICAL_INTENTS.REJECT_APPOINTMENT) {
      if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "BLOCKED",
          responseMessage: "Seul le praticien assigné peut refuser une consultation.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!provider) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "BLOCKED",
          responseMessage: "Profil praticien introuvable.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const pending = await ctx.db
        .query("appointments")
        .withIndex("by_provider_status", (q: any) =>
          q.eq("providerId", provider._id).eq("status", APPOINTMENT_STATUS.PENDING)
        )
        .collect();

      const targetDateStr = getTargetDateString(parsed.entities.dateFilter);
      let candidates = pending;
      if (targetDateStr) {
        candidates = candidates.filter((a) => a.date === targetDateStr);
      }
      candidates.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

      if (candidates.length === 0) {
        return {
          interactionId,
          intent: parsed.intent,
          status: "EXECUTE_DIRECT",
          responseMessage:
            lang === "ar"
              ? "ليس لديك أي طلبات معلقة لرفضها."
              : "Vous n'avez aucune demande en attente à décliner.",
          actionPreview: null,
          actionPayload: null,
        };
      }

      const targetAppt = candidates[0];
      const patient = await ctx.db.get(targetAppt.patientId);
      const patientName = patient?.name || patient?.email || "Patient";

      return {
        interactionId,
        intent: parsed.intent,
        status: "READY_FOR_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `هل تؤكد رفض طلب موعد ${patientName} يوم ${targetAppt.date} على الساعة ${targetAppt.time} ؟`
            : `Confirmez-vous le refus du rendez-vous de ${patientName} prévu le ${targetAppt.date} à ${targetAppt.time} ?`,
        actionPreview: {
          title: "Refus de consultation",
          beneficiary: patientName,
          service: targetAppt.serviceType || "Consultation",
          dateFormatted: targetAppt.date,
          timePreference: targetAppt.time,
        },
        actionPayload: {
          type: "REJECT_APPOINTMENT",
          appointmentId: targetAppt._id,
          patientId: targetAppt.patientId,
        },
      };
    }

    return {
      interactionId,
      intent: parsed.intent,
      status: "COMPLETED",
      responseMessage: "Commande traitée avec succès.",
      actionPreview: null,
      actionPayload: null,
    };
  },
});

// ============================================================================
// MUTATION : EXÉCUTION D'UNE ACTION CONFIRMÉE VIA L'ASSISTANT
// ============================================================================

export const executeConfirmedAssistantAction = mutation({
  args: {
    interactionId: v.id("assistantInteractions"),
    actionType: v.string(),
    actionPayload: v.any(),
    confirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const now = Date.now();

    if (!args.confirmed) {
      await ctx.db.patch(args.interactionId, { status: "cancelled" });
      return { success: false, message: "Action annulée par l'utilisateur." };
    }

    const payload = args.actionPayload;
    let targetEntityId: string | undefined;

    try {
      // 1. Enregistrement d'une constante de santé
      if (args.actionType === "RECORD_HEALTH_MEASUREMENT") {
        const obsId = await ctx.db.insert("healthObservations", {
          patientId: payload.patientId || userId,
          measurementCode: payload.measurementCode,
          numericValue: payload.numericValue,
          secondaryNumericValue: payload.secondaryNumericValue,
          unit: payload.unit,
          observedAt: now,
          recordedAt: now,
          recordedByUserId: userId,
          recordedByRole: (user.role || 'patient'),
          source: (user.role || 'patient') === ROLES.PROFESSIONNEL ? "professional_manual" : "patient_manual",
          context: payload.context,
          notes: "Enregistré par commande vocale/conversationnelle MauriCare Voice AI",
          createdAt: now,
        });
        targetEntityId = String(obsId);
      }

      // 2. Réservation d'un soin
      else if (args.actionType === "BOOK_APPOINTMENT") {
        // Recherche d'un soignant disponible vérifié pour cette spécialité
        const providers = await ctx.db
          .query("providers")
          .filter((q: any) =>
            q.and(
              q.eq(q.field("verificationStatus"), "approved"),
              q.eq(q.field("availabilityStatus"), "available")
            )
          )
          .take(5);

        const assignedProvider = providers[0];
        if (!assignedProvider) {
          throw new Error("Aucun soignant disponible trouvé pour ce créneau.");
        }

        const dateStr = new Date(payload.dateTimestamp || now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const appointmentId = await ctx.db.insert("appointments", {
          patientId: payload.patientId || userId,
          providerId: assignedProvider._id,
          serviceType: payload.serviceName || "Soin infirmier",
          serviceSnapshot: {
            name: payload.serviceName || "Soin infirmier",
            price: 450,
            duration: 45,
          },
          date: dateStr,
          time: payload.timeSlot || "09:30",
          status: "en_attente",
          notes: "Demande initiée via MauriCare Voice AI",
          paymentMethod: "cash",
          beneficiaryId: payload.patientId !== userId ? payload.patientId : undefined,
          bookedByUserId: payload.patientId !== userId ? userId : undefined,
        });
        targetEntityId = String(appointmentId);
      }

      // 3. Demande de prélèvement HomeLab
      else if (args.actionType === "CREATE_HOMELAB_REQUEST") {
        const sampleCode = `HL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
        const todayStr = new Date().toISOString().slice(0, 10);
        const homeLabId = await ctx.db.insert("homeLabRequests", {
          sampleCode,
          patientId: payload.beneficiaryId || userId,
          actorUserId: userId,
          actorType: payload.beneficiaryId && payload.beneficiaryId !== userId ? "circle_member" : "patient",
          status: "requested",
          scheduledDate: todayStr,
          scheduledTimeSlot: "08:00 - 10:00",
          address: "Nouakchott (confirmé par téléphone)",
          city: "Nouakchott",
          phone: user.phone || "45000000",
          patientNotes: "Commande vocale MauriCare Voice AI",
          pricingSnapshot: {
            collectionFee: 200,
            analysesAmount: 250,
            totalAmount: 450,
            currency: "MRU",
          },
          createdAt: now,
          updatedAt: now,
        });
        targetEntityId = String(homeLabId);
      }

      // 4. Demande d'avis Relay
      else if (args.actionType === "CREATE_RELAY_REQUEST") {
        if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
          throw new Error("Action réservée aux soignants agréés");
        }
        // Inscription dans la file Relay
        const provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first();

        if (!provider) throw new Error("Profil praticien introuvable pour cette demande Relay");

        const relayId = await ctx.db.insert("relayRequests", {
          requestingProviderId: provider._id,
          requestingUserId: userId,
          patientId: payload.patientId || userId,
          requestedSpecialty: payload.specialty || "general_practitioner",
          urgencyLevel: "standard",
          reason: "Demande d'avis confraternel transmise via MauriCare Voice AI",
          clinicalContext: {
            observations: "Dossier transmis pour avis confraternel par commande vocale.",
          },
          status: "requested",
          createdAt: now,
        });
        targetEntityId = String(relayId);
      }

      // 5. Envoi d'un message
      else if (args.actionType === "SEND_MESSAGE") {
        // Enregistre dans messages
        await ctx.db.insert("messages", {
          senderId: userId,
          receiverId: userId,
          content: payload.text,
          read: true,
        });
      }

      // 6. Confirmation de consultation praticien (CONFIRM_APPOINTMENT)
      else if (args.actionType === "CONFIRM_APPOINTMENT") {
        if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
          throw new Error("Action réservée aux soignants agréés");
        }
        const apptId = payload.appointmentId;
        if (!apptId) throw new Error("Identifiant de rendez-vous manquant");
        const appt = (await ctx.db.get(apptId)) as Doc<"appointments"> | null;
        if (!appt) throw new Error("Rendez-vous introuvable");

        const provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first();
        if (!provider || appt.providerId !== provider._id) {
          throw new Error("Non autorisé à modifier ce rendez-vous");
        }

        await ctx.db.patch(appt._id, {
          status: APPOINTMENT_STATUS.CONFIRMED,
        });

        await createServerNotification(ctx, {
          userId: appt.patientId,
          type: "info",
          title: "Consultation confirmée",
          message: `Le praticien a validé votre rendez-vous du ${appt.date} à ${appt.time}.`,
          link: "/appointments",
        });

        targetEntityId = String(appt._id);
      }

      // 7. Refus de consultation praticien (REJECT_APPOINTMENT)
      else if (args.actionType === "REJECT_APPOINTMENT") {
        if ((user.role || 'patient') !== ROLES.PROFESSIONNEL) {
          throw new Error("Action réservée aux soignants agréés");
        }
        const apptId = payload.appointmentId;
        if (!apptId) throw new Error("Identifiant de rendez-vous manquant");
        const appt = (await ctx.db.get(apptId)) as Doc<"appointments"> | null;
        if (!appt) throw new Error("Rendez-vous introuvable");

        const provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first();
        if (!provider || appt.providerId !== provider._id) {
          throw new Error("Non autorisé à modifier ce rendez-vous");
        }

        await ctx.db.patch(appt._id, {
          status: APPOINTMENT_STATUS.CANCELLED,
          cancellationReason: payload.reason || "Refusé par le praticien via Voice AI",
        });

        await createServerNotification(ctx, {
          userId: appt.patientId,
          type: "alert",
          title: "Consultation refusée",
          message: `Le praticien n'a pas pu valider votre demande du ${appt.date} à ${appt.time}.`,
          link: "/appointments",
        });

        targetEntityId = String(appt._id);
      }

      // Enregistrement de l'audit immuable
      await ctx.db.insert("assistantActionAudit", {
        userId,
        role: (user.role || 'patient'),
        intent: args.actionType,
        actionName: args.actionType,
        beneficiaryId: payload.patientId || payload.beneficiaryId,
        targetEntityId,
        confirmedAt: now,
        executionStatus: "success",
        details: { actionType: args.actionType },
        createdAt: now,
      });

      await ctx.db.patch(args.interactionId, { status: "completed" });

      return {
        success: true,
        entityId: targetEntityId,
        message: "Action exécutée et enregistrée avec succès.",
      };
    } catch (err: any) {
      console.error("Erreur exécution action assistant:", err);

      await ctx.db.insert("assistantActionAudit", {
        userId,
        role: (user.role || 'patient'),
        intent: args.actionType,
        actionName: args.actionType,
        confirmedAt: now,
        executionStatus: "error",
        details: { error: err?.message },
        createdAt: now,
      });

      await ctx.db.patch(args.interactionId, { status: "failed" });
      throw new Error(err?.message || "Erreur lors de l'exécution de l'action.");
    }
  },
});

// ============================================================================
// QUERIES : CONTEXTE & HISTORIQUE DE L'ASSISTANT
// ============================================================================

export const getAssistantSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuthUser(ctx);

    if ((user.role || 'patient') === ROLES.PROFESSIONNEL) {
      return [
        { id: "pro_schedule", labelFr: "Consulter mon planning du jour", labelAr: "عرض جدول مواعيدي اليوم", intent: "VIEW_UPCOMING_APPOINTMENTS" },
        { id: "pro_relay", labelFr: "Ouvrir les demandes Relay", labelAr: "فتح استشارات Relay", intent: "CREATE_RELAY_REQUEST" },
        { id: "pro_measure", labelFr: "Ajouter une constante patient", labelAr: "تسجيل مؤشر صحي لمريض", intent: "RECORD_HEALTH_MEASUREMENT" },
        { id: "pro_patients", labelFr: "Surveillance de mes patients", labelAr: "متابعة المرضى", intent: "VIEW_HEALTH_TREND" },
      ];
    }

    // Suggestions Patient / Cercle
    return [
      { id: "pat_book", labelFr: "Réserver une infirmière demain matin", labelAr: "حجز ممرض غداً صباحاً", intent: "BOOK_APPOINTMENT" },
      { id: "pat_rdv", labelFr: "Voir mes prochains rendez-vous", labelAr: "عرض مواعيدي القادمة", intent: "VIEW_UPCOMING_APPOINTMENTS" },
      { id: "pat_bp", labelFr: "Ajouter ma tension : 120 sur 80", labelAr: "تسجيل ضغط الدم: 120 على 80", intent: "RECORD_HEALTH_MEASUREMENT" },
      { id: "pat_lab", labelFr: "État de mes analyses HomeLab", labelAr: "حالة تحاليلي في المختبر", intent: "VIEW_HOMELAB_STATUS" },
      { id: "pat_trends", labelFr: "Voir l'évolution de ma tension", labelAr: "عرض منحنى ضغط الدم", intent: "VIEW_HEALTH_TREND" },
    ];
  },
});

export const getAssistantAuditHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const takeCount = args.limit || 20;

    return await ctx.db
      .query("assistantActionAudit")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(takeCount);
  },
});

// ============================================================================
// STT CAPABILITIES & TRANSCRIBE ACTION (ROBUST RECORDED AUDIO PIPELINE)
// ============================================================================

export const getVoiceSTTCapabilities = query({
  args: {},
  handler: async () => {
    const provider = process.env.VOICE_STT_PROVIDER;
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    const hasDeepgram = Boolean(process.env.DEEPGRAM_API_KEY);

    const configured = Boolean(
      (provider && provider !== "none") ||
      hasOpenAI ||
      hasGroq ||
      hasDeepgram
    );

    const activeProvider = provider || (hasGroq ? "groq" : hasOpenAI ? "openai" : hasDeepgram ? "deepgram" : "none");

    return {
      configured,
      provider: configured ? activeProvider : "none",
      hasFallbackAudio: configured,
    };
  },
});

export const transcribeRecordedAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = (await auth.getUserId(ctx)) as Id<"users"> | null;
    if (!userId) {
      throw new Error("Authentification requise pour la transcription vocale.");
    }

    const provider = process.env.VOICE_STT_PROVIDER;
    const openAiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const deepgramKey = process.env.DEEPGRAM_API_KEY;

    const activeProvider = provider || (groqKey ? "groq" : openAiKey ? "openai" : deepgramKey ? "deepgram" : "none");

    if (activeProvider === "none" || (!openAiKey && !groqKey && !deepgramKey && !provider)) {
      return {
        success: false,
        configured: false,
        code: "STT_NOT_CONFIGURED",
        transcript: "",
        message: "Aucun service de transcription vocale externe n'est actuellement configuré sur le serveur (VOICE_STT_PROVIDER / GROQ_API_KEY / OPENAI_API_KEY).",
      };
    }

    try {
      const binaryString = atob(args.audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const extension = args.mimeType.includes("webm")
        ? "webm"
        : args.mimeType.includes("mp4")
        ? "mp4"
        : args.mimeType.includes("ogg")
        ? "ogg"
        : "wav";

      const fileBlob = new Blob([bytes], { type: args.mimeType || "audio/webm" });
      const lang = args.language?.startsWith("ar") ? "ar" : "fr";

      if (activeProvider === "groq" && groqKey) {
        const formData = new FormData();
        formData.append("file", fileBlob, `utterance.${extension}`);
        formData.append("model", "whisper-large-v3");
        formData.append("language", lang);

        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Erreur API Groq Whisper:", errText);
          return {
            success: false,
            configured: true,
            code: "STT_PROVIDER_ERROR",
            transcript: "",
            message: "Échec de transcription auprès du fournisseur Groq Whisper.",
          };
        }

        const data: any = await res.json();
        return {
          success: true,
          configured: true,
          transcript: data.text?.trim() || "",
          provider: "groq",
        };
      } else if (activeProvider === "openai" && openAiKey) {
        const formData = new FormData();
        formData.append("file", fileBlob, `utterance.${extension}`);
        formData.append("model", "whisper-1");
        formData.append("language", lang);

        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Erreur API OpenAI Whisper:", errText);
          return {
            success: false,
            configured: true,
            code: "STT_PROVIDER_ERROR",
            transcript: "",
            message: "Échec de transcription auprès du fournisseur OpenAI Whisper.",
          };
        }

        const data: any = await res.json();
        return {
          success: true,
          configured: true,
          transcript: data.text?.trim() || "",
          provider: "openai",
        };
      } else if (activeProvider === "deepgram" && deepgramKey) {
        const res = await fetch(`https://api.deepgram.com/v1/listen?language=${lang}&model=nova-2`, {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": args.mimeType || "audio/webm",
          },
          body: bytes,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Erreur API Deepgram:", errText);
          return {
            success: false,
            configured: true,
            code: "STT_PROVIDER_ERROR",
            transcript: "",
            message: "Échec de transcription auprès du fournisseur Deepgram.",
          };
        }

        const data: any = await res.json();
        const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
        return {
          success: true,
          configured: true,
          transcript,
          provider: "deepgram",
        };
      } else {
        return {
          success: false,
          configured: false,
          code: "STT_NOT_CONFIGURED",
          transcript: "",
          message: `Le fournisseur ${activeProvider} est configuré sans clé API valide.`,
        };
      }
    } catch (err: any) {
      console.error("Erreur lors de la transcription audio:", err);
      return {
        success: false,
        configured: true,
        code: "STT_EXCEPTION",
        transcript: "",
        message: err?.message || "Erreur lors du traitement de l'enregistrement audio.",
      };
    }
  },
});

import { CANONICAL_SERVICES, CanonicalServiceDefinition } from "@/convex/serviceCatalog";

/**
 * Service & Medical Vocabulary Localization System
 * Handles bidirectional translation between French and Arabic for medical services,
 * specialties, and controlled system notes without affecting user free text.
 */

export const SPECIALTY_TRANSLATIONS: Record<string, { fr: string; ar: string }> = {
  infirmier: {
    fr: "Infirmier(ère) d'État",
    ar: "ممرض(ة) دولة",
  },
  kinestherapeute: {
    fr: "Kinésithérapeute",
    ar: "أخصائي علاج طبيعي",
  },
  kine: {
    fr: "Kinésithérapeute",
    ar: "أخصائي علاج طبيعي",
  },
  sage_femme: {
    fr: "Sage-femme diplômée",
    ar: "قابلة قانونية",
  },
  medecin: {
    fr: "Médecin à domicile",
    ar: "طبيب منزلي",
  },
  aide_soignant: {
    fr: "Aide-soignant(e)",
    ar: "مساعد(ة) تمريض",
  },
};

// Build index maps for fast lookup
const CANONICAL_BY_ID = new Map<string, CanonicalServiceDefinition>();
const CANONICAL_BY_FR_LABEL = new Map<string, CanonicalServiceDefinition>();
const CANONICAL_BY_AR_LABEL = new Map<string, CanonicalServiceDefinition>();

CANONICAL_SERVICES.forEach((service) => {
  CANONICAL_BY_ID.set(service.id.toLowerCase(), service);
  CANONICAL_BY_FR_LABEL.set(service.label.toLowerCase().trim(), service);
  CANONICAL_BY_AR_LABEL.set(service.labelAr.toLowerCase().trim(), service);
});

// Additional aliases/synonyms
const SERVICE_ALIASES: Record<string, string> = {
  "pansement simple": "infirmier_pansement",
  "pansement": "infirmier_pansement",
  "pansement simple ou complexe": "infirmier_pansement",
  "injection": "infirmier_injection",
  "injections": "infirmier_injection",
  "prise de constantes": "infirmier_constantes",
  "constantes vitales": "infirmier_constantes",
  "perfusion": "infirmier_perfusion",
  "suivi post-opératoire": "infirmier_suivi_post_op",
  "suivi post-op": "infirmier_suivi_post_op",
  "soins généraux": "infirmier_soins_generaux",
  "soins infirmiers généraux": "infirmier_soins_generaux",
  "reeducation fonctionnelle": "kine_reeducation_fonctionnelle",
  "rééducation fonctionnelle": "kine_reeducation_fonctionnelle",
  "rééducation": "kine_reeducation_fonctionnelle",
  "kinesitherapie": "kine_reeducation_fonctionnelle",
  "consultation a domicile": "medecin_consultation_domicile",
  "consultation à domicile": "medecin_consultation_domicile",
  "consultation medicale": "medecin_consultation_domicile",
  "consultation générale": "medecin_consultation_domicile",
  "consultation": "medecin_consultation_domicile",
  "aide a la toilette": "aide_toilette",
  "aide à la toilette": "aide_toilette",
  "toilette": "aide_toilette",
};

/**
 * Returns the localized name of a medical service given an ID, French label, Arabic label, or snapshot object.
 */
export function getLocalizedServiceLabel(
  serviceInput: string | { name?: string; serviceType?: string; type?: string; title?: string; titleAr?: string } | null | undefined,
  lang: string
): string {
  if (!serviceInput) return "";

  let rawString = "";
  if (typeof serviceInput === "string") {
    rawString = serviceInput.trim();
  } else if (typeof serviceInput === "object") {
    // If object already carries Arabic title in Arabic mode
    if (lang === "ar" && serviceInput.titleAr) {
      return serviceInput.titleAr;
    }
    rawString = (serviceInput.name || serviceInput.title || serviceInput.serviceType || serviceInput.type || "").trim();
  }

  if (!rawString) return "";

  const isAr = lang === "ar";
  const normalized = rawString.toLowerCase().trim();

  // 1. Direct match by canonical ID
  const byId = CANONICAL_BY_ID.get(normalized);
  if (byId) {
    return isAr ? byId.labelAr : byId.label;
  }

  // 2. Direct match by French label
  const byFr = CANONICAL_BY_FR_LABEL.get(normalized);
  if (byFr) {
    return isAr ? byFr.labelAr : byFr.label;
  }

  // 3. Direct match by Arabic label
  const byAr = CANONICAL_BY_AR_LABEL.get(normalized);
  if (byAr) {
    return isAr ? byAr.labelAr : byAr.label;
  }

  // 4. Match via aliases
  const aliasTargetId = SERVICE_ALIASES[normalized];
  if (aliasTargetId) {
    const canonical = CANONICAL_BY_ID.get(aliasTargetId);
    if (canonical) {
      return isAr ? canonical.labelAr : canonical.label;
    }
  }

  // 5. Partial/fuzzy match against canonical French services
  for (const s of CANONICAL_SERVICES) {
    const sLower = s.label.toLowerCase();
    if (sLower.includes(normalized) || normalized.includes(sLower)) {
      return isAr ? s.labelAr : s.label;
    }
  }

  // Fallback: return raw string
  return rawString;
}

/**
 * Returns localized specialty name.
 */
export function getLocalizedSpecialtyLabel(specialty: string | null | undefined, lang: string): string {
  if (!specialty) return "";
  const normalized = specialty.toLowerCase().trim();
  const entry = SPECIALTY_TRANSLATIONS[normalized];
  if (entry) {
    return lang === "ar" ? entry.ar : entry.fr;
  }
  return specialty;
}

/**
 * Localizes system-controlled default notes (e.g. "Demande de prise en charge à domicile")
 * while strictly leaving user-entered free text unchanged.
 */
export function getLocalizedAppointmentNote(note: string | null | undefined, lang: string): string {
  if (!note) return "";
  const trimmed = note.trim();
  if (trimmed === "Demande de prise en charge à domicile") {
    return lang === "ar" ? "طلب رعاية صحية منزلية" : "Demande de prise en charge à domicile";
  }
  return trimmed;
}

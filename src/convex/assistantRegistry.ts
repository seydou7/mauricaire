import { ROLES } from "./schema";

export type CapabilityClassification = "READ" | "NAVIGATION" | "WRITE";
export type CapabilityPrivacyLevel =
  | "public"
  | "relationship_required"
  | "self_only"
  | "delegated_circle"
  | "admin_only";

export interface AssistantCapability {
  name: string;
  classification: CapabilityClassification;
  descriptionFr: string;
  descriptionAr: string;
  allowedRoles: string[];
  privacyLevel: CapabilityPrivacyLevel;
  confirmationRequired: boolean;
  inputParameters: Record<string, { type: string; description: string; required?: boolean }>;
  keywordsFr: string[];
  keywordsAr: string[];
}

export const CAPABILITY_REGISTRY: Record<string, AssistantCapability> = {
  find_available_providers: {
    name: "find_available_providers",
    classification: "READ",
    descriptionFr:
      "Recherche les professionnels de santé agréés, vérifiés et disponibles selon la spécialité (infirmier, médecin, kiné, sage-femme), la zone d'intervention (ex: Tevragh Zeina, Ksar) et la date.",
    descriptionAr:
      "البحث عن الممارسين الصحيين المعتمدين والمتاحين حسب التخصص والمنطقة والوقت.",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, ROLES.ADMIN, "circle_member"],
    privacyLevel: "public",
    confirmationRequired: false,
    inputParameters: {
      specialty: { type: "string", description: "Spécialité soignant (infirmier, medecin, etc.)" },
      zone: { type: "string", description: "Zone d'intervention à Nouakchott (ex: Tevragh Zeina, Ksar)" },
      date: { type: "string", description: "Date souhaitée (today, tomorrow, YYYY-MM-DD)" },
      timeOfDay: { type: "string", description: "matin, après-midi, soir" },
    },
    keywordsFr: [
      "soignant disponible",
      "soignants disponibles",
      "professionnels disponibles",
      "qui est disponible",
      "qui est libre",
      "infirmier libre",
      "médecin disponible",
      "qui peut venir",
      "trouver un soignant",
      "chercher un infirmier",
      "annuaire soignants",
      "disponibles actuellement",
    ],
    keywordsAr: [
      "ممارس متاح",
      "ممرض متوفر",
      "طبيب متاح",
      "من يمكنه الحضور",
      "المتاحين حالياً",
      "من هو متوفر",
    ],
  },

  get_my_appointments: {
    name: "get_my_appointments",
    classification: "READ",
    descriptionFr:
      "Consulte les rendez-vous programmés pour le patient connecté ou le planning de consultations du professionnel de santé.",
    descriptionAr: "الاطلاع على المواعيد القادمة للمريض أو جدول المواعيد للطبيب/الممرض.",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, ROLES.ADMIN, "circle_member"],
    privacyLevel: "self_only",
    confirmationRequired: false,
    inputParameters: {
      date: { type: "string", description: "Filtrage date (today, tomorrow, all)" },
      status: { type: "string", description: "Filtrage statut (confirme, en_attente, termine)" },
      isNextOnly: { type: "boolean", description: "Uniquement le tout prochain rendez-vous" },
    },
    keywordsFr: [
      "mes rendez-vous",
      "mes rdv",
      "mon planning",
      "prochain rendez-vous",
      "prochains rdv",
      "rendez-vous demain",
      "consultations prévues",
      "agenda",
    ],
    keywordsAr: ["مواعيدي", "موعدي القادم", "جدولي", "مواعيد الغد", "مواعيد اليوم"],
  },

  get_pending_appointment_requests: {
    name: "get_pending_appointment_requests",
    classification: "READ",
    descriptionFr:
      "Consulte les demandes de rendez-vous en attente d'acceptation par le soignant connecté.",
    descriptionAr: "الاطلاع على طلبات المواعيد المعلقة التي تنتظر موافقة الممارس الصحي.",
    allowedRoles: [ROLES.PROFESSIONNEL, ROLES.ADMIN],
    privacyLevel: "self_only",
    confirmationRequired: false,
    inputParameters: {
      date: { type: "string", description: "Filtrage date (today, tomorrow, upcoming)" },
      isNextOnly: { type: "boolean", description: "Seulement la prochaine demande" },
    },
    keywordsFr: [
      "demandes en attente",
      "demande en attente",
      "demandes reçues",
      "en attente de confirmation",
      "combien de demandes en attente",
      "prochaines demandes en attente",
    ],
    keywordsAr: ["طلبات معلقة", "طلبات في الانتظار", "طلبات واردة"],
  },

  get_my_patients: {
    name: "get_my_patients",
    classification: "READ",
    descriptionFr:
      "Liste les patients suivis par le soignant connecté ayant une relation de soin établie (consultation confirmée ou terminée).",
    descriptionAr: "قائمة المرضى التابعين للممارس الصحي والذين لديهم علاقة علاجية مؤكدة.",
    allowedRoles: [ROLES.PROFESSIONNEL, ROLES.ADMIN],
    privacyLevel: "relationship_required",
    confirmationRequired: false,
    inputParameters: {
      withChronicOnly: { type: "boolean", description: "Filtrer uniquement ceux avec suivi des constantes" },
      withUpcomingOnly: { type: "boolean", description: "Filtrer uniquement ceux ayant un rdv à venir" },
    },
    keywordsFr: [
      "mes patients",
      "patients que je suis",
      "patients suivis",
      "patients vus",
      "patients déjà vus",
      "quels patients ai-je déjà vus",
      "patients avec un suivi de constantes",
    ],
    keywordsAr: ["مرضاي", "المرضى المتابعين", "قائمة المرضى"],
  },

  get_patient_care_summary: {
    name: "get_patient_care_summary",
    classification: "READ",
    descriptionFr:
      "Consulte les constantes cliniques récentes et le résumé de santé d'un patient sous relation de soin vérifiée.",
    descriptionAr: "الاطلاع على المؤشرات الحيوية وملخص الرعاية للمريض في إطار علاقة علاجية مصرح بها.",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, "circle_member"],
    privacyLevel: "relationship_required",
    confirmationRequired: false,
    inputParameters: {
      patientId: { type: "string", description: "Identifiant du patient cible (vérification relation obligatoire)" },
    },
    keywordsFr: [
      "constantes du patient",
      "dossier du patient",
      "résumé de suivi",
      "ses dernières constantes",
      "suivi de constantes",
    ],
    keywordsAr: ["مؤشرات المريض", "ملف المريض", "متابعة المريض"],
  },

  get_my_health_observations: {
    name: "get_my_health_observations",
    classification: "READ",
    descriptionFr:
      "Consulte les dernières constantes vitales enregistrées (tension artérielle, glycémie, pouls, température) pour le patient.",
    descriptionAr: "الاطلاع على آخر القياسات الحيوية للمريض (ضغط الدم، السكري، النبض).",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, "circle_member"],
    privacyLevel: "self_only",
    confirmationRequired: false,
    inputParameters: {
      measurementCode: { type: "string", description: "blood_pressure, blood_glucose, heart_rate, temperature" },
    },
    keywordsFr: [
      "mes dernières constantes",
      "mes constantes",
      "ma tension",
      "ma glycémie",
      "mon pouls",
      "mes mesures de santé",
      "suivi constantes",
    ],
    keywordsAr: ["قياساتي", "ضغطي", "السكري", "المؤشرات الحيوية"],
  },

  get_homelab_status: {
    name: "get_homelab_status",
    classification: "READ",
    descriptionFr:
      "Consulte le statut d'une demande d'analyses HomeLab, l'avancement de la collecte ou les résultats publiés.",
    descriptionAr: "الاطلاع على حالة فحص المختبر المنزلي HomeLab والنتائج الصادرة.",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, "circle_member", ROLES.ADMIN],
    privacyLevel: "self_only",
    confirmationRequired: false,
    inputParameters: {
      requestId: { type: "string", description: "Optionnel: ID de la demande" },
    },
    keywordsFr: [
      "mon analyse homelab",
      "mon analyse labo",
      "mes résultats de laboratoire",
      "où en est mon analyse",
      "résultat homelab",
      "prélèvement homelab",
    ],
    keywordsAr: ["تحليل هوم لاب", "فحص المختبر", "نتيجة التحليل", "سحب العينة"],
  },

  get_relay_requests: {
    name: "get_relay_requests",
    classification: "READ",
    descriptionFr:
      "Consulte les demandes d'avis confraternel MauriCare Relay envoyées ou reçues par le praticien.",
    descriptionAr: "الاطلاع على طلبات الرأي الطبي التخصصي في MauriCare Relay.",
    allowedRoles: [ROLES.PROFESSIONNEL, ROLES.ADMIN],
    privacyLevel: "self_only",
    confirmationRequired: false,
    inputParameters: {
      status: { type: "string", description: "requested, in_review, answered" },
    },
    keywordsFr: [
      "mes demandes relay",
      "avis confraternel en cours",
      "demandes d'avis relay",
      "dossiers relay",
    ],
    keywordsAr: ["طلبات ريلاي", "استشارات ريلاي"],
  },

  get_circle_members: {
    name: "get_circle_members",
    classification: "READ",
    descriptionFr:
      "Consulte les membres aidants du Cercle familial du patient ou les patients accompagnés par l'utilisateur.",
    descriptionAr: "الاطلاع على أفراد دائرة العائلة المعتمدين أو الأشخاص المرافقين.",
    allowedRoles: [ROLES.PATIENT, "circle_member"],
    privacyLevel: "delegated_circle",
    confirmationRequired: false,
    inputParameters: {},
    keywordsFr: [
      "mon cercle",
      "membres du cercle",
      "personnes que j'accompagne",
      "aidants cercle",
      "qui est dans mon cercle",
    ],
    keywordsAr: ["أفراد الدائرة", "الأشخاص الذين أرافقهم", "عائلتي في سيركل"],
  },

  open_dashboard_section: {
    name: "open_dashboard_section",
    classification: "NAVIGATION",
    descriptionFr:
      "Navigue directement vers une section de l'application (planning, demandes, patients, chronic, relay, homelab, circle, profil).",
    descriptionAr: "الانتقال مباشرة إلى أحد أقسام التطبيق الرئيسية.",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, ROLES.ADMIN, "circle_member"],
    privacyLevel: "public",
    confirmationRequired: false,
    inputParameters: {
      section: { type: "string", description: "Nom de la section (planning, relay, homelab, circle, chronic, etc.)", required: true },
    },
    keywordsFr: [
      "ouvre",
      "ouvrir",
      "aller sur",
      "affiche",
      "navigue vers",
      "voir la section",
    ],
    keywordsAr: ["افتح", "انتقل إلى", "عرض قسم"],
  },

  prepare_appointment_booking: {
    name: "prepare_appointment_booking",
    classification: "WRITE",
    descriptionFr:
      "Prépare une demande de réservation de soin infirmier ou consultation à domicile.",
    descriptionAr: "إعداد طلب حجز موعد رعاية منزلية أو استشارة.",
    allowedRoles: [ROLES.PATIENT, "circle_member"],
    privacyLevel: "self_only",
    confirmationRequired: true,
    inputParameters: {
      providerId: { type: "string", description: "ID du praticien cible" },
      serviceName: { type: "string", description: "Nom de la prestation de soin" },
      date: { type: "string", description: "Date d'intervention" },
      time: { type: "string", description: "Heure d'intervention" },
    },
    keywordsFr: ["réserve", "réserver", "prendre rendez-vous avec", "bloquer le créneau"],
    keywordsAr: ["احجز", "حجز موعد مع"],
  },

  confirm_appointment: {
    name: "confirm_appointment",
    classification: "WRITE",
    descriptionFr:
      "Valide et confirme une demande de rendez-vous reçue par le soignant.",
    descriptionAr: "تأكيد وقبول طلب موعد وارد للممارس الصحي.",
    allowedRoles: [ROLES.PROFESSIONNEL],
    privacyLevel: "self_only",
    confirmationRequired: true,
    inputParameters: {
      appointmentId: { type: "string", description: "ID du rendez-vous à confirmer", required: true },
    },
    keywordsFr: ["confirme le rendez-vous", "valide la demande", "accepte la consultation", "confirme ma prochaine demande"],
    keywordsAr: ["أكد الموعد", "قبول الطلب"],
  },

  reject_appointment: {
    name: "reject_appointment",
    classification: "WRITE",
    descriptionFr:
      "Refuse ou annule une demande de consultation reçue par le praticien.",
    descriptionAr: "رفض أو إلغاء طلب موعد وارد للممارس الصحي.",
    allowedRoles: [ROLES.PROFESSIONNEL],
    privacyLevel: "self_only",
    confirmationRequired: true,
    inputParameters: {
      appointmentId: { type: "string", description: "ID du rendez-vous à refuser", required: true },
      reason: { type: "string", description: "Motif d'indisponibilité" },
    },
    keywordsFr: ["refuse le rendez-vous", "annule la demande", "décline la consultation"],
    keywordsAr: ["رفض الموعد", "إلغاء الطلب"],
  },

  record_health_measurement: {
    name: "record_health_measurement",
    classification: "WRITE",
    descriptionFr:
      "Prépare l'enregistrement d'une constante clinique (tension artérielle, glycémie, etc.).",
    descriptionAr: "إعداد تسجيل قياس حيوي جديد في الملف الصحي.",
    allowedRoles: [ROLES.PATIENT, ROLES.PROFESSIONNEL, "circle_member"],
    privacyLevel: "relationship_required",
    confirmationRequired: true,
    inputParameters: {
      measurementCode: { type: "string", description: "blood_pressure, blood_glucose, heart_rate, etc." },
      numericValue: { type: "number", description: "Valeur principale (ou systole)" },
      secondaryNumericValue: { type: "number", description: "Valeur secondaire (ex: diastole)" },
    },
    keywordsFr: ["enregistre ma tension", "note ma glycémie", "ajoute ma constante", "enregistrer ma mesure"],
    keywordsAr: ["سجل ضغطي", "سجل قياس السكري"],
  },

  create_homelab_request: {
    name: "create_homelab_request",
    classification: "WRITE",
    descriptionFr:
      "Prépare une commande de prélèvement HomeLab à domicile.",
    descriptionAr: "إعداد طلب سحب تحاليل مخبرية منزلية.",
    allowedRoles: [ROLES.PATIENT, "circle_member"],
    privacyLevel: "self_only",
    confirmationRequired: true,
    inputParameters: {
      analyses: { type: "string", description: "NFS, Bilan lipidique, Glycémie..." },
      date: { type: "string", description: "Date souhaitée pour le prélèvement" },
    },
    keywordsFr: ["commande une prise de sang", "demande homelab", "programme une analyse à domicile"],
    keywordsAr: ["اطلب تحليل منزلي", "سحب دم في المنزل"],
  },
};

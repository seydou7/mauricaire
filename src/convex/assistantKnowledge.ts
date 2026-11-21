/**
 * MAURICARE PLATFORM KNOWLEDGE BASE
 * Authoritative, non-hallucinated functional documentation of MauriCare capabilities.
 * Sourced directly from MauriCare specifications.
 */

export interface KnowledgeTopic {
  id: string;
  topic: string;
  titleFr: string;
  titleAr: string;
  summaryFr: string;
  summaryAr: string;
  keywordsFr: string[];
  keywordsAr: string[];
  relevantRoles?: string[];
  suggestedSection?: string;
}

export const MAURICARE_KNOWLEDGE_BASE: KnowledgeTopic[] = [
  {
    id: "relay",
    topic: "MauriCare Relay (Télé-expertise & Avis Confraternel)",
    titleFr: "MauriCare Relay : Avis Confraternel Sécurisé",
    titleAr: "خدمة MauriCare Relay : الاستشارة والتعاون الطبي",
    summaryFr:
      "MauriCare Relay est le canal de télé-expertise médicale réservé aux professionnels de santé agréés (médecins, infirmiers). Il permet à un soignant traitant de solliciter l'avis formel d'un confrère spécialiste pour un patient donné, avec partage encadré du contexte clinique, pièces jointes sécurisées et réponse horodatée intégrée au dossier.",
    summaryAr:
      "خدمة MauriCare Relay مخصصة للممارسين الصحيين المعتمدين لطلب رأي طبي متخصص من زميل حول حالة مريض، مع مشاركة آمنة للمؤشرات والوثائق السريرية وتوثيق الرد في الملف الصحي.",
    keywordsFr: [
      "relay",
      "avis confraternel",
      "télé-expertise",
      "avis confrère",
      "collaboration médicale",
      "demande d'avis",
      "confrère",
      "à quoi sert relay",
      "c'est quoi relay",
      "comment marche relay",
    ],
    keywordsAr: ["ريلاي", "استشارة زميل", "استشارة طبية", "رأي طبي", "تعاون طبي"],
    relevantRoles: ["professionnel", "admin"],
    suggestedSection: "relay",
  },
  {
    id: "homelab",
    topic: "MauriCare HomeLab (Analyses & Prélèvements à Domicile)",
    titleFr: "HomeLab : Prélèvements Biologiques à Domicile",
    titleAr: "خدمة HomeLab : سحب التحاليل المخبرية المنزلية",
    summaryFr:
      "MauriCare HomeLab permet aux patients de commander des prélèvements sanguins et biologiques directement à domicile à Nouakchott. Un préleveur qualifié intervient à l'horaire choisi, achemine les échantillons sous scellé traçable vers un laboratoire d'analyses certifié partenaire, et les résultats officiels scellés sont publiés dans l'espace patient.",
    summaryAr:
      "تتيح خدمة HomeLab طلب سحب التحاليل المخبرية في المنزل بنواكشوط. ينتقل ممرض أو فني سحب معتمد، وتنقل العينات في ظروف محكمة لمختبر شريك معتمد، وتصدر النتائج الرسمية مباشرة في حساب المريض.",
    keywordsFr: [
      "homelab",
      "home lab",
      "analyse à domicile",
      "prélèvement à domicile",
      "prise de sang",
      "laboratoire",
      "analyses",
      "à quoi sert homelab",
      "comment fonctionne homelab",
      "c'est quoi homelab",
    ],
    keywordsAr: ["هوم لاب", "مختبر منزلي", "تحليل منزلي", "سحب دم", "فحص دم"],
    relevantRoles: ["patient", "professionnel", "circle_member", "admin"],
    suggestedSection: "homelab",
  },
  {
    id: "circle_vs_caregivers",
    topic: "Différence entre MauriCare Circle et Mes Soignants",
    titleFr: "Circle (Cercle Familial) vs Mes Soignants",
    titleAr: "الفرق بين دائرة العائلة (Circle) ومقدمي الرعاية (Mes soignants)",
    summaryFr:
      "MauriCare Circle regroupe vos proches aidants et votre famille pour gérer vos rendez-vous et vos commandes HomeLab par mandat délégué sécurisé (sans jamais accéder à vos notes médicales brutes confidentielles). À l'inverse, 'Mes soignants' rassemble les professionnels de santé diplômés (médecins, infirmiers) avec qui vous avez une relation de soins clinique officielle.",
    summaryAr:
      "دائرة MauriCare Circle مخصصة للعائلة والمرافقين الموثوقين لمساعدتكم في حجز المواعيد وطلبات التحاليل بتفويض محدد دون الاطلاع على الملاحظات الطبية الخاصة. بينما 'Mes soignants' يضم الأطباء والممرضين المعتمدين الذين يشرفون على علاجكم الفعلي.",
    keywordsFr: [
      "différence entre circle et soignant",
      "différence circle soignants",
      "circle ou mes soignants",
      "distinction circle",
      "c'est quoi la différence entre circle",
    ],
    keywordsAr: ["الفرق بين سيركل", "الفرق بين العائلة والطبيب"],
    relevantRoles: ["patient", "circle_member", "professionnel", "admin"],
    suggestedSection: "circle",
  },
  {
    id: "circle",
    topic: "MauriCare Circle (Coordination Familiale & Aidants)",
    titleFr: "MauriCare Circle : Mandat et Entourage Aidant",
    titleAr: "دائرة MauriCare Circle : رعاية ومرافقة الأقارب",
    summaryFr:
      "MauriCare Circle permet aux patients d'inviter des proches de confiance (conjoint, enfants, aidants) avec des permissions granulaires : prise de rendez-vous pour autrui et suivi des prélèvements HomeLab, tout en garantissant l'étanchéité absolue du dossier médical strict.",
    summaryAr:
      "تتيح دائرة Circle تفويض أفراد العائلة الموثوقين لتنظيم المواعيد ومتابعة تحاليل المختبر المنزلي نيابة عنكم مع الحفاظ الكامل على سرية الملف الطبي الشخصي.",
    keywordsFr: [
      "circle",
      "cercle",
      "proche aidant",
      "famille",
      "mandat",
      "accompagner un patient",
      "à quoi sert circle",
      "comment fonctionne circle",
      "c'est quoi circle",
    ],
    keywordsAr: ["دائرة", "سيركل", "عائلة", "مرافق", "مساعدة الوالدين"],
    relevantRoles: ["patient", "circle_member", "admin"],
    suggestedSection: "circle",
  },
  {
    id: "booking",
    topic: "Réservation de Soins & Consultations à Domicile",
    titleFr: "Réservation de Soins MauriCare",
    titleAr: "حجز الرعاية والاستشارات المنزلية",
    summaryFr:
      "Pour réserver une consultation ou un soin infirmier à domicile, explorez l'annuaire des professionnels vérifiés, filtrez par spécialité ou zone (ex: Tevragh Zeina), choisissez un créneau horaire compatible et validez votre demande avec le récapitulatif tarifaire transparent garanti.",
    summaryAr:
      "لحجز رعاية تمريضية أو استشارة منزلية، تصفح دليل الممارسين المعتمدين، اختر التخصص والمنطقة، وحدد الموعد المناسب مع تأكيد فوري وشفافية في الأسعار.",
    keywordsFr: [
      "comment réserver",
      "réserver un soin",
      "prendre rendez-vous",
      "comment prendre rdv",
      "réserver infirmier",
      "demande de soin",
    ],
    keywordsAr: ["كيفية الحجز", "حجز موعد", "طلب ممرض", "حجز استشارة"],
    relevantRoles: ["patient", "circle_member", "admin"],
    suggestedSection: "reseau",
  },
  {
    id: "availability",
    topic: "Gestion des Disponibilités & Planning Praticien",
    titleFr: "Gestion du Planning et des Disponibilités",
    titleAr: "إدارة أوقات العمل والجدول للممارس",
    summaryFr:
      "Les soignants agréés gèrent leurs tranches horaires hebdomadaires, leurs zones d'intervention (ex: Tevragh Zeina, Ksar) et déclarent leurs congés ou exceptions dans la section 'Planning & Disponibilités'. Seuls les professionnels avec statut disponible sont exposés aux réservations des patients.",
    summaryAr:
      "يمكن للممارسين الصحيين ضبط ساعات عملهم الأسبوعية ومناطق التدخل وتسجيل الإجازات من قسم الجدول الزمني لظهورهم في أوقات التوفر الفعلية فقط.",
    keywordsFr: [
      "modifier mes disponibilités",
      "changer mes horaires",
      "planning soignant",
      "mes disponibilités",
      "comment modifier mon planning",
      "déclarer congé",
    ],
    keywordsAr: ["تعديل أوقات العمل", "جدول العمل", "أوقات التوفر", "إجازة"],
    relevantRoles: ["professionnel", "admin"],
    suggestedSection: "planning",
  },
  {
    id: "onboarding_pending",
    topic: "Statut d'Agrément & Onboarding Professionnel en Attente",
    titleFr: "Validation du Dossier Professionnel",
    titleAr: "حالة مراجعة وتوثيق ملف الممارس الصحي",
    summaryFr:
      "Lorsqu'un soignant s'inscrit sur MauriCare, son diplôme d'État et son autorisation d'exercer en Mauritanie sont vérifiés par l'équipe d'administration sous 24h à 48h ouvrées. Durant cette phase de contrôle de conformité, le profil reste au statut 'en attente' pour garantir la sécurité absolue des patients.",
    summaryAr:
      "عند تسجيل ممارس صحي جديد، تتم مراجعة الشهادات ورخصة المزاولة الرسمية بموريتانيا من قِبل إدارة موري كير خلال 24 إلى 48 ساعة لضمان سلامة المرضى قبل تفعيل الحساب.",
    keywordsFr: [
      "dossier en attente",
      "pourquoi mon dossier est en attente",
      "validation praticien",
      "agrément soignant",
      "compte non vérifié",
      "délai validation",
    ],
    keywordsAr: ["ملف قيد الانتظار", "توثيق الحساب", "مراجعة الشهادة"],
    relevantRoles: ["professionnel", "admin"],
    suggestedSection: "onboarding",
  },
  {
    id: "chronic",
    topic: "Suivi Longitudinal Chronic & Constantes Vitales",
    titleFr: "Suivi des Constantes & Pathologies Chroniques",
    titleAr: "متابعة المؤشرات الحيوية والأمراض المزمنة",
    summaryFr:
      "Le module MauriCare Chronic permet d'enregistrer et de suivre dans le temps les constantes physiologiques essentielles (pression artérielle appariée systole/diastole, glycémie, pouls, température, SpO2). Le soignant traitant et le patient disposent d'un historique graphique pour détecter les dérives sans jamais remplacer la décision médicale humaine.",
    summaryAr:
      "يوفر نظام MauriCare Chronic متابعة المؤشرات الحيوية مثل ضغط الدم، السكري، والنبض مع رسوم بيانية زمنية تمكن الممارس والمريض من رصد المؤشرات بدقة.",
    keywordsFr: [
      "chronic",
      "suivi constantes",
      "tension",
      "glycémie",
      "constantes vitales",
      "suivi longitudinal",
      "à quoi sert chronic",
      "mesures de santé",
    ],
    keywordsAr: ["الأمراض المزمنة", "قياس الضغط", "السكري", "المؤشرات الحيوية"],
    relevantRoles: ["patient", "professionnel", "circle_member", "admin"],
    suggestedSection: "chronic",
  },
];

/**
 * Recherche une réponse dans la base de connaissances fonctionnelle MauriCare
 */
export function queryPlatformKnowledge(
  queryText: string,
  userRole: string,
  lang: string = "fr"
): { matched: boolean; topic?: KnowledgeTopic; answer?: string } {
  const text = queryText.toLowerCase().trim();

  // Score chaque sujet selon les mots-clés
  let bestTopic: KnowledgeTopic | null = null;
  let maxScore = 0;

  for (const topic of MAURICARE_KNOWLEDGE_BASE) {
    let score = 0;
    const keywords = lang === "ar" ? topic.keywordsAr : topic.keywordsFr;

    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += kw.length > 5 ? 3 : 2;
      }
    }

    // Bonus si le rôle correspond
    if (score > 0 && topic.relevantRoles?.includes(userRole)) {
      score += 1;
    }

    if (score > maxScore) {
      maxScore = score;
      bestTopic = topic;
    }
  }

  // Seuil de confiance minimal pour correspondance documentaire
  if (bestTopic && maxScore >= 2) {
    const answer =
      lang === "ar" ? bestTopic.summaryAr : bestTopic.summaryFr;
    return {
      matched: true,
      topic: bestTopic,
      answer,
    };
  }

  return { matched: false };
}

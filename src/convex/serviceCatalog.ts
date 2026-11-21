/**
 * MauriCare — Catalogue Canonique de Soins de Santé (Module 4)
 * Référentiel médical structuré par spécialité pour la Mauritanie.
 */

export interface CanonicalServiceDefinition {
  id: string;
  specialty: string;
  label: string;
  labelAr: string;
  defaultDuration: number; // en minutes
  defaultMinPrice: number; // en MRU
  description: string;
  descriptionAr: string;
}

export const CANONICAL_SERVICES: CanonicalServiceDefinition[] = [
  // --- INFIRMIER ---
  {
    id: "infirmier_injection",
    specialty: "infirmier",
    label: "Injection (IM / SC / IV directe)",
    labelAr: "حقن (عضلي / تحت الجلد / وريدي مباشر)",
    defaultDuration: 20,
    defaultMinPrice: 200,
    description: "Administration sécurisée d'injections selon prescription médicale.",
    descriptionAr: "إعطاء الحقن بأمان وفق الوصفة الطبية في المنزل.",
  },
  {
    id: "infirmier_pansement",
    specialty: "infirmier",
    label: "Pansement simple ou complexe",
    labelAr: "تضميد الجروح البسيطة والمعقدة",
    defaultDuration: 30,
    defaultMinPrice: 350,
    description: "Nettoyage, asepsie et réfection de pansements post-opératoires ou chroniques.",
    descriptionAr: "تنظيف وتعقيم وتغيير ضمادات الجروح بعد العمليات أو المزمنة.",
  },
  {
    id: "infirmier_constantes",
    specialty: "infirmier",
    label: "Prise de constantes vitales",
    labelAr: "قياس المؤشرات الحيوية",
    defaultDuration: 20,
    defaultMinPrice: 150,
    description: "Mesure de tension artérielle, pulsation, glycémie capillaire et saturation O2.",
    descriptionAr: "قياس ضغط الدم، النبض، نسبة السكر في الدم وتشبع الأكسجين.",
  },
  {
    id: "infirmier_perfusion",
    specialty: "infirmier",
    label: "Perfusion & Pose de voie veineuse",
    labelAr: "المحاليل الوريدية وتركيب القسطرة",
    defaultDuration: 45,
    defaultMinPrice: 500,
    description: "Mise en place de cathéter périphérique, administration de solutés et surveillance.",
    descriptionAr: "تركيب قسطرة وريدية محيطية ومتابعة تقطير المحاليل العلاجية.",
  },
  {
    id: "infirmier_suivi_post_op",
    specialty: "infirmier",
    label: "Suivi post-opératoire à domicile",
    labelAr: "متابعة ما بعد الجراحة في المنزل",
    defaultDuration: 40,
    defaultMinPrice: 600,
    description: "Surveillance de cicatrice, ablation d'agrafes/points et évaluation de l'état général.",
    descriptionAr: "متابعة التئام الجروح، إزالة الغرز ومراقبة الحالة الصحية العامة.",
  },
  {
    id: "infirmier_soins_generaux",
    specialty: "infirmier",
    label: "Soins infirmiers généraux à domicile",
    labelAr: "رعاية تمريضية منزلية عامة",
    defaultDuration: 30,
    defaultMinPrice: 300,
    description: "Sondages, soins d'hygiène thérapeutique et accompagnement médicalisé.",
    descriptionAr: "تركيب القساطر، العناية التمريضية والمرافقة الصحية المتخصصة.",
  },

  // --- KINÉSITHÉRAPEUTE ---
  {
    id: "kine_reeducation_fonctionnelle",
    specialty: "kinestherapeute",
    label: "Rééducation fonctionnelle & motrice",
    labelAr: "إعادة التأهيل الوظيفي والحركي",
    defaultDuration: 45,
    defaultMinPrice: 600,
    description: "Exercices thérapeutiques de renforcement et récupération de l'autonomie.",
    descriptionAr: "تمارين علاجية لاستعادة القدرة الحركية والاستقلالية اليومية.",
  },
  {
    id: "kine_mobilisation",
    specialty: "kinestherapeute",
    label: "Mobilisation passive & active",
    labelAr: "التحريك المفصلي الإيجابي والسلبي",
    defaultDuration: 30,
    defaultMinPrice: 500,
    description: "Entretien des amplitudes articulaires pour patients alités ou en perte d'autonomie.",
    descriptionAr: "الحفاظ على مرونة المفاصل للمرضى طريحي الفراش أو محدودي الحركة.",
  },
  {
    id: "kine_reeducation_post_op",
    specialty: "kinestherapeute",
    label: "Rééducation post-opératoire",
    labelAr: "إعادة التأهيل بعد العمليات الجراحية",
    defaultDuration: 45,
    defaultMinPrice: 700,
    description: "Prise en charge spécialisée post-chirurgie orthopédique ou neurologique.",
    descriptionAr: "رعاية ترويضية متخصصة بعد جراحات العظام والمفاصل أو الأعصاب.",
  },
  {
    id: "kine_respiratoire",
    specialty: "kinestherapeute",
    label: "Kinésithérapie respiratoire",
    labelAr: "العلاج الطبيعي للجهاز التنفسي",
    defaultDuration: 30,
    defaultMinPrice: 600,
    description: "Désencombrement bronchique et techniques ventilatoires adaptées.",
    descriptionAr: "تقنيات تنظيف المجاري التنفسية وتحسين كفاءة التنفس للبالغين والأطفال.",
  },
  {
    id: "kine_autre",
    specialty: "kinestherapeute",
    label: "Autre soin kinésithérapique personnalisé",
    labelAr: "جلسة علاج طبيعي مخصصة",
    defaultDuration: 45,
    defaultMinPrice: 500,
    description: "Prise en charge ciblée selon la prescription médicale.",
    descriptionAr: "علاج طبيعي وترويض مخصص حسب التوجيهات الطبية.",
  },

  // --- MÉDECIN ---
  {
    id: "medecin_consultation_domicile",
    specialty: "medecin",
    label: "Consultation médicale générale à domicile",
    labelAr: "استشارة طبية عامة في المنزل",
    defaultDuration: 45,
    defaultMinPrice: 1000,
    description: "Examen clinique complet, diagnostic, prescription d'ordonnance et orientation.",
    descriptionAr: "فحص سريري شامل في المنزل، تشخيص، تحرير الوصفات والتوجيه الطبي.",
  },
  {
    id: "medecin_suivi_medical",
    specialty: "medecin",
    label: "Suivi médical d'affection chronique",
    labelAr: "متابعة طبية للأمراض المزمنة",
    defaultDuration: 40,
    defaultMinPrice: 800,
    description: "Surveillance et stabilisation du diabète, de l'hypertension artérielle ou cardiopathie.",
    descriptionAr: "مراقبة وضبط العلاج لأمراض السكري، ضغط الدم وأمراض القلب والشرايين.",
  },
  {
    id: "medecin_consultation_controle",
    specialty: "medecin",
    label: "Consultation de contrôle & ajustement",
    labelAr: "استشارة متابعة وضبط العلاج",
    defaultDuration: 30,
    defaultMinPrice: 700,
    description: "Évaluation de la réponse aux traitements et réajustement posologique.",
    descriptionAr: "تقييم الاستجابة للعلاج وضبط الجرعات الدوائية.",
  },

  // --- AIDE-SOIGNANT ---
  {
    id: "aide_toilette",
    specialty: "aide_soignant",
    label: "Aide à la toilette & soins d'hygiène",
    labelAr: "المساعدة في الاستحمام والنظافة الشخصية",
    defaultDuration: 45,
    defaultMinPrice: 350,
    description: "Assistance complète ou partielle pour la toilette, le rasage et le confort au lit.",
    descriptionAr: "مساعدة المريض في النظافة الجسدية والعناية اليومية في الفراش.",
  },
  {
    id: "aide_mobilisation",
    specialty: "aide_soignant",
    label: "Mobilisation & Transferts de confort",
    labelAr: "المساعدة في الحركة والتنقل الآمن",
    defaultDuration: 30,
    defaultMinPrice: 300,
    description: "Aide au lever, coucher, transferts lit-fauteuil et prévention des chutes.",
    descriptionAr: "المساعدة في النهوض والجلوس والتنقل بأمان داخل المنزل.",
  },
  {
    id: "aide_accompagnement",
    specialty: "aide_soignant",
    label: "Accompagnement quotidien & présence",
    labelAr: "المرافقة اليومية والدعم الشخصي",
    defaultDuration: 60,
    defaultMinPrice: 400,
    description: "Présence bienveillante, aide à la prise de repas et surveillance du bien-être.",
    descriptionAr: "رعاية حضورية دافئة، مساعدة في تناول الوجبات ومراقبة الراحة.",
  },
  {
    id: "aide_soins_hygiene",
    specialty: "aide_soignant",
    label: "Prévention d'escarres & soins d'hygiène",
    labelAr: "الوقاية من قرح الفراش ورعاية الجلد",
    defaultDuration: 40,
    defaultMinPrice: 350,
    description: "Changements réguliers de position, effleurage et protection des zones d'appui.",
    descriptionAr: "تغيير وضعيات المريض بانتظام، تدليك وقائي وحماية نقاط الضغط الجلدي.",
  },
];

export function getCanonicalServicesForSpecialty(specialty: string): CanonicalServiceDefinition[] {
  return CANONICAL_SERVICES.filter((s) => s.specialty === specialty);
}

export function findCanonicalService(id: string): CanonicalServiceDefinition | undefined {
  return CANONICAL_SERVICES.find((s) => s.id === id);
}

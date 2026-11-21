import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import { createServerNotification } from "./notifications";
import { CIRCLE_PERMISSIONS } from "./circle";
import { isOperationalProfessional } from "./providers";
import { syncHomeLabResultToChronic } from "./chronic";

// =========================================================================
// CANONICAL CONSTANTS
// =========================================================================

export const HOMELAB_STATUS = {
  REQUESTED: "requested",
  VALIDATED: "validated",
  SCHEDULED: "scheduled",
  COLLECTOR_ASSIGNED: "collector_assigned",
  COLLECTION_IN_PROGRESS: "collection_in_progress",
  SAMPLE_COLLECTED: "sample_collected",
  IN_TRANSIT: "in_transit",
  RECEIVED_BY_LAB: "received_by_lab",
  PROCESSING: "processing",
  RESULT_AVAILABLE: "result_available",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
  COLLECTION_FAILED: "collection_failed",
} as const;

/**
 * Strict eligibility check for HomeLab sample collectors.
 * Sample collection at home (phlebotomy, clinical specimens) requires an operational
 * professional with qualification as a registered nurse (infirmier) or doctor (medecin).
 */
export function isEligibleCollector(
  provider: {
    _id?: any;
    verified?: boolean;
    onboardingStatus?: string;
    verificationStatus?: string;
    deactivated?: boolean;
    specialty?: string;
  } | null | undefined,
  user?: {
    role?: string;
    deactivatedAt?: number | null;
  } | null | undefined
): boolean {
  if (!isOperationalProfessional(provider, user)) return false;
  const allowed = ["infirmier", "medecin"];
  return Boolean(provider.specialty && allowed.includes(provider.specialty));
}

/**
 * Default catalogue items for DEV environment initialization.
 * IMPORTANT: indicativePrice values below are strictly DEV test fixtures.
 * Production environments rely exclusively on authoritative partner laboratory configuration.
 */
export const DEFAULT_CATALOG_TESTS = [
  {
    code: "nfs",
    name: "Numération Formule Sanguine (NFS / CBC)",
    nameAr: "تعداد الدم الكامل (NFS)",
    category: "hematologie",
    sampleType: "sang_total",
    fastingRequired: false,
    prescriptionRequired: true,
    preparationInstructions: "Aucun jeûne strict requis. Éviter un effort physique intense avant le prélèvement.",
    preparationInstructionsAr: "لا يشترط الصيام التام. تجنب المجهود البدني الشاق قبل أخذ العينة.",
    indicativePrice: 350,
  },
  {
    code: "glycemia",
    name: "Glycémie à jeun",
    nameAr: "فحص السكر في الدم صائماً",
    category: "biochimie",
    sampleType: "plasma",
    fastingRequired: true,
    prescriptionRequired: false,
    preparationInstructions: "Jeûne strict de 8 à 12 heures requis (eau plate autorisée uniquement).",
    preparationInstructionsAr: "صيام صارم من 8 إلى 12 ساعة (يسمح بشرب الماء فقط).",
    indicativePrice: 150,
  },
  {
    code: "hba1c",
    name: "Hémoglobine Glyquée (HbA1c)",
    nameAr: "السكر التراكمي (HbA1c)",
    category: "metabolique",
    sampleType: "sang_total",
    fastingRequired: false,
    prescriptionRequired: false,
    preparationInstructions: "Prélèvement réalisable à tout moment de la journée, sans jeûne obligatoire.",
    preparationInstructionsAr: "يمكن أخذ العينة في أي وقت دون اشتراط الصيام.",
    indicativePrice: 500,
  },
  {
    code: "creatinine",
    name: "Créatinine sérique & Débit de Filtration (DFG)",
    nameAr: "الكرياتينين ووظائف الكلى",
    category: "biochimie",
    sampleType: "serum",
    fastingRequired: true,
    prescriptionRequired: true,
    preparationInstructions: "Jeûne de 6 à 8 heures conseillé. Bien s'hydrater la veille au soir.",
    preparationInstructionsAr: "يفضل الصيام من 6 إلى 8 ساعات مع شرب الماء الكافي في الليلة السابقة.",
    indicativePrice: 250,
  },
  {
    code: "urea",
    name: "Urée sanguine",
    nameAr: "اليوريا في الدم",
    category: "biochimie",
    sampleType: "serum",
    fastingRequired: true,
    prescriptionRequired: true,
    preparationInstructions: "Jeûne de 6 à 8 heures. Éviter les excès d'apport protidique 24h avant.",
    preparationInstructionsAr: "صيام من 6 إلى 8 ساعات. تجنب الإفراط في البروتينات قبل الفحص بـ 24 ساعة.",
    indicativePrice: 200,
  },
  {
    code: "lipid_profile",
    name: "Bilan lipidique complet (Cholestérol Total, HDL, LDL, Triglycérides)",
    nameAr: "تحليل الدهون الشامل (الكوليسترول والدهون الثلاثية)",
    category: "lipidique",
    sampleType: "serum",
    fastingRequired: true,
    prescriptionRequired: false,
    preparationInstructions: "Jeûne strict de 12 heures impératif. Repas léger la veille.",
    preparationInstructionsAr: "صيام صارم لمدة 12 ساعة كاملة أمر إلزامي مع وجبة عشاء خفيفة.",
    indicativePrice: 600,
  },
  {
    code: "transaminases",
    name: "Bilan hépatique (ASAT / ALAT)",
    nameAr: "إنزيمات الكبد (ASAT / ALAT)",
    category: "biochimie",
    sampleType: "serum",
    fastingRequired: true,
    prescriptionRequired: true,
    preparationInstructions: "Jeûne de 8 heures. Éviter toute prise médicamenteuse non vitale avant avis.",
    preparationInstructionsAr: "صيام 8 ساعات. تجنب أخذ الأدوية غير الحيوية قبل استشارة الطبيب.",
    indicativePrice: 400,
  },
  {
    code: "crp",
    name: "Protéine C-Réactive (CRP quantitative)",
    nameAr: "البروتين التفاعلي C (فحص الالتهاب CRP)",
    category: "autre",
    sampleType: "serum",
    fastingRequired: false,
    prescriptionRequired: false,
    preparationInstructions: "Pas de jeûne obligatoire. Signaler tout traitement anti-inflammatoire en cours.",
    preparationInstructionsAr: "لا يشترط الصيام. يرجى إبلاغ الممارس بأي علاج مضاد للالتهاب.",
    indicativePrice: 300,
  },
  {
    code: "urine_ecbu",
    name: "Examen Cyto-Bactériologique des Urines (ECBU)",
    nameAr: "فحص ومزرعة البول (ECBU)",
    category: "autre",
    sampleType: "urines",
    fastingRequired: false,
    prescriptionRequired: true,
    preparationInstructions: "Recueil du premier jet du matin ou 3h après miction, après toilette locale intime rigoureuse.",
    preparationInstructionsAr: "جمع عينة الصباح الأولى في وعاء معقم بعد غسيل وتعقيم موضعي دقيق.",
    indicativePrice: 450,
  },
];

// =========================================================================
// AUTHORIZATION & DOMAIN HELPERS
// =========================================================================

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

/**
 * Checks if caller belongs to a laboratory partner organization.
 */
async function getLaboratoryContext(ctx: any, userId: Id<"users">) {
  const labUser = (await ctx.db
    .query("laboratoryUsers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("active"), true))
    .first()) as Doc<"laboratoryUsers"> | null;

  if (!labUser) return null;

  const lab = (await ctx.db.get(labUser.laboratoryId)) as Doc<"laboratoryPartners"> | null;
  if (!lab || !lab.active) return null;

  return { labUser, lab };
}

/**
 * Generates human-friendly, collision-resistant tracking codes: HL-YYYYMMDD-XXXX
 */
function generateTrackingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HL-${dateStr}-${rand}`;
}

/**
 * Consistently logs HomeLab operational and clinical traceability audit events.
 */
async function logHomeLabAudit(
  ctx: any,
  args: {
    requestId: Id<"homeLabRequests">;
    patientId: Id<"users">;
    actorUserId: Id<"users">;
    action: string;
    metadata?: any;
  }
) {
  await ctx.db.insert("homeLabAuditEvents", {
    requestId: args.requestId,
    patientId: args.patientId,
    actorUserId: args.actorUserId,
    action: args.action,
    timestamp: Date.now(),
    metadata: args.metadata,
  });
}

/**
 * Ensures caller has legitimate care relationship with patient.
 */
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

// =========================================================================
// QUERIES
// =========================================================================

/**
 * Returns available laboratory analyses from the catalog, auto-seeding if empty.
 */
export const getLabTestCatalog = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("labTestCatalog").withIndex("by_active", (q: any) => q.eq("active", true));

    if (args.category) {
      q = ctx.db
        .query("labTestCatalog")
        .withIndex("by_category", (q: any) => q.eq("category", args.category))
        .filter((q: any) => q.eq(q.field("active"), true));
    }

    const tests = await q.collect();
    return tests;
  },
});

/**
 * Returns list of active laboratory partners for patient and ordering views.
 */
export const getLaboratoryPartners = query({
  args: {},
  handler: async (ctx) => {
    const partners = await ctx.db
      .query("laboratoryPartners")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    return partners.map((p) => ({
      _id: p._id,
      name: p.name,
      code: p.code,
      phone: p.phone,
      address: p.address,
      city: p.city,
      supportedCategories: p.supportedCategories,
      openingHours: p.openingHours,
      collectionFee: p.collectionFee,
    }));
  },
});

/**
 * Returns requests list visible to the authenticated caller:
 * - Patient: their own requests
 * - Circle member: requests for accompanied patients (if granted VIEW_HOMELAB_STATUS or MANAGE_HOMELAB)
 * - Professional: requests they ordered or where they are assigned collector
 */
export const getMyHomeLabRequests = query({
  args: {
    beneficiaryId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);

    const targetPatientId = args.beneficiaryId || (user.role === ROLES.PATIENT ? userId : undefined);

    let requests: any[] = [];

    if (targetPatientId) {
      const isSelf = targetPatientId === userId;
      let isAuthorizedCircleMember = false;

      if (!isSelf) {
        // Circle check
        const membership = await ctx.db
          .query("circleMembers")
          .withIndex("by_patient_and_member", (q: any) =>
            q.eq("patientId", targetPatientId).eq("memberUserId", userId)
          )
          .first();

        if (
          membership &&
          membership.status === "active" &&
          (membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_HOMELAB_STATUS) ||
            membership.permissions.includes(CIRCLE_PERMISSIONS.MANAGE_HOMELAB) ||
            membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_SELECTED_HEALTH_DATA) ||
            membership.permissions.includes("view_care_summary"))
        ) {
          isAuthorizedCircleMember = true;
        }
      }

      const isAuthorizedProvider =
        !isSelf && user.role === ROLES.PROFESSIONNEL
          ? await verifyCareRelationship(ctx, userId, targetPatientId)
          : false;

      if (!isSelf && !isAuthorizedCircleMember && !isAuthorizedProvider) {
        throw new Error("Accès non autorisé aux demandes HomeLab de ce patient");
      }

      requests = await ctx.db
        .query("homeLabRequests")
        .withIndex("by_patient", (q: any) => q.eq("patientId", targetPatientId))
        .order("desc")
        .collect();
    } else if (user.role === ROLES.PROFESSIONNEL) {
      // Find provider ID
      const provider = (await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first()) as Doc<"providers"> | null;

      if (!isOperationalProfessional(provider)) {
        return [];
      }

      const orderedRequests = await ctx.db
        .query("homeLabRequests")
        .withIndex("by_actor", (q: any) => q.eq("actorUserId", userId))
        .order("desc")
        .collect();

      let assignedRequests: any[] = [];
      if (provider) {
        assignedRequests = await ctx.db
          .query("homeLabRequests")
          .withIndex("by_collector", (q: any) => q.eq("collectorId", provider._id))
          .collect();
      }

      const map = new Map<string, any>();
      for (const r of [...orderedRequests, ...assignedRequests]) {
        map.set(r._id, r);
      }
      requests = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
    } else {
      requests = await ctx.db
        .query("homeLabRequests")
        .withIndex("by_patient", (q: any) => q.eq("patientId", userId))
        .order("desc")
        .collect();
    }

    // Enrich with items and lab name
    const enriched = await Promise.all(
      requests.map(async (req) => {
        const items = await ctx.db
          .query("homeLabRequestItems")
          .withIndex("by_request", (q: any) => q.eq("requestId", req._id))
          .collect();

        const patient = (await ctx.db.get(req.patientId)) as Doc<"users"> | null;
        let lab: Doc<"laboratoryPartners"> | null = null;
        if (req.laboratoryId) {
          lab = (await ctx.db.get(req.laboratoryId)) as Doc<"laboratoryPartners"> | null;
        }

        const result = await ctx.db
          .query("homeLabResults")
          .withIndex("by_request", (q: any) => q.eq("requestId", req._id))
          .filter((q: any) => q.neq(q.field("status"), "draft"))
          .first();

        return {
          ...req,
          itemsCount: items.length,
          itemNames: items.map((i) => i.testName),
          fastingRequired: items.some((i) => i.fastingRequired),
          patientName:
            `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
            patient?.name ||
            "Patient",
          laboratoryName: lab?.name || "Laboratoire Partenaire",
          hasPublishedResult: Boolean(result),
          resultId: result?._id || null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Returns full details of a HomeLab request with IDOR access control.
 */
export const getHomeLabRequestDetails = query({
  args: {
    requestId: v.id("homeLabRequests"),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) {
      throw new Error("Demande HomeLab introuvable");
    }

    // Authorization checks
    const isBeneficiary = req.patientId === userId;
    const isActor = req.actorUserId === userId;

    let isAuthorizedLab = false;
    const labCtx = await getLaboratoryContext(ctx, userId);
    if (labCtx && req.laboratoryId && labCtx.lab._id === req.laboratoryId) {
      isAuthorizedLab = true;
    }

    let isCollector = false;
    if (req.collectorId && user.role === ROLES.PROFESSIONNEL) {
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();
      if (provider && provider._id === req.collectorId) {
        isCollector = true;
      }
    }

    let isAuthorizedCircleMember = false;
    if (!isBeneficiary && !isActor) {
      const membership = await ctx.db
        .query("circleMembers")
        .withIndex("by_patient_and_member", (q: any) =>
          q.eq("patientId", req.patientId).eq("memberUserId", userId)
        )
        .first();

      if (
        membership &&
        membership.status === "active" &&
        (membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_HOMELAB_STATUS) ||
          membership.permissions.includes(CIRCLE_PERMISSIONS.MANAGE_HOMELAB) ||
          membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_SELECTED_HEALTH_DATA))
      ) {
        isAuthorizedCircleMember = true;
      }
    }

    const isAuthorizedProvider =
      user.role === ROLES.PROFESSIONNEL
        ? await verifyCareRelationship(ctx, userId, req.patientId)
        : false;

    if (
      !isBeneficiary &&
      !isActor &&
      !isAuthorizedLab &&
      !isCollector &&
      !isAuthorizedCircleMember &&
      !isAuthorizedProvider &&
      user.role !== ROLES.ADMIN
    ) {
      throw new Error("Accès non autorisé à cette demande HomeLab");
    }

    // Fetch items
    const items = await ctx.db
      .query("homeLabRequestItems")
      .withIndex("by_request", (q: any) => q.eq("requestId", req._id))
      .collect();

    // Fetch lab
    let lab: Doc<"laboratoryPartners"> | null = null;
    if (req.laboratoryId) {
      lab = (await ctx.db.get(req.laboratoryId)) as Doc<"laboratoryPartners"> | null;
    }

    // Fetch patient
    const patient = (await ctx.db.get(req.patientId)) as Doc<"users"> | null;

    // Fetch prescription download URL if authorized
    let prescriptionUrl: string | null = null;
    if (req.prescriptionStorageId) {
      try {
        prescriptionUrl = await ctx.storage.getUrl(req.prescriptionStorageId);
      } catch {
        prescriptionUrl = null;
      }
    }

    // Fetch audit timeline
    const auditEvents = await ctx.db
      .query("homeLabAuditEvents")
      .withIndex("by_request", (q: any) => q.eq("requestId", req._id))
      .order("desc")
      .collect();

    return {
      ...req,
      patientName:
        `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
        patient?.name ||
        "Patient",
      patientPhone: req.phone || patient?.phone || "",
      laboratoryName: lab?.name || "Laboratoire Partenaire",
      laboratoryPhone: lab?.phone || null,
      items,
      fastingRequired: items.some((i) => i.fastingRequired),
      prescriptionUrl,
      auditTimeline: auditEvents.map((e) => ({
        action: e.action,
        timestamp: e.timestamp,
        metadata: e.metadata,
      })),
      isBeneficiary,
      isActor,
      isAuthorizedLab,
      isCollector,
    };
  },
});

/**
 * Returns scoped queue of requests for a laboratory partner user.
 * Laboratory users see only requests assigned to their laboratory organization.
 */
export const getLaboratoryQueue = query({
  args: {
    statusGroup: v.optional(
      v.union(
        v.literal("all"),
        v.literal("scheduled"),
        v.literal("in_transit"),
        v.literal("received"),
        v.literal("processing"),
        v.literal("results_ready")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const labCtx = await getLaboratoryContext(ctx, userId);
    if (!labCtx) {
      throw new Error("Accès réservé au personnel de laboratoire habilité");
    }

    const requests = await ctx.db
      .query("homeLabRequests")
      .withIndex("by_lab", (q: any) => q.eq("laboratoryId", labCtx.lab._id))
      .order("desc")
      .collect();

    const filtered = requests.filter((r) => {
      if (!args.statusGroup || args.statusGroup === "all") return true;
      if (args.statusGroup === "scheduled") {
        return r.status === "scheduled" || r.status === "collector_assigned";
      }
      if (args.statusGroup === "in_transit") {
        return r.status === "sample_collected" || r.status === "in_transit";
      }
      if (args.statusGroup === "received") {
        return r.status === "received_by_lab";
      }
      if (args.statusGroup === "processing") {
        return r.status === "processing";
      }
      if (args.statusGroup === "results_ready") {
        return r.status === "result_available" || r.status === "completed";
      }
      return true;
    });

    const enriched = await Promise.all(
      filtered.map(async (req) => {
        const items = await ctx.db
          .query("homeLabRequestItems")
          .withIndex("by_request", (q: any) => q.eq("requestId", req._id))
          .collect();

        const patient = (await ctx.db.get(req.patientId)) as Doc<"users"> | null;

        return {
          ...req,
          itemsCount: items.length,
          itemNames: items.map((i) => i.testName),
          fastingRequired: items.some((i) => i.fastingRequired),
          patientName:
            `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
            patient?.name ||
            "Patient",
        };
      })
    );

    return {
      laboratory: {
        _id: labCtx.lab._id,
        name: labCtx.lab.name,
        code: labCtx.lab.code,
      },
      requests: enriched,
    };
  },
});

/**
 * Returns collector's active tour and available collection missions.
 * Only accessible to verified healthcare professionals qualified as collectors.
 */
export const getCollectorQueue = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuthUser(ctx);
    if (user.role !== ROLES.PROFESSIONNEL) {
      return [];
    }

    const provider = (await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first()) as Doc<"providers"> | null;

    if (!provider || !isEligibleCollector(provider, user)) return [];

    // 1. Missions explicitly assigned to this collector
    const assignedRequests = await ctx.db
      .query("homeLabRequests")
      .withIndex("by_collector", (q: any) => q.eq("collectorId", provider._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "scheduled"),
          q.eq(q.field("status"), "collector_assigned"),
          q.eq(q.field("status"), "collection_in_progress"),
          q.eq(q.field("status"), "sample_collected"),
          q.eq(q.field("status"), "in_transit")
        )
      )
      .collect();

    // 2. Available unassigned collection missions awaiting a collector
    const unassignedScheduled = await ctx.db
      .query("homeLabRequests")
      .withIndex("by_status", (q: any) => q.eq("status", "scheduled"))
      .filter((q: any) => q.eq(q.field("collectorId"), undefined))
      .collect();

    // Matching territory / city
    const availableMatching = unassignedScheduled.filter((r) => {
      if (!provider.city) return true;
      return !r.city || r.city.toLowerCase() === provider.city.toLowerCase();
    });

    const allRequests = [
      ...assignedRequests.map((r) => ({ ...r, isAssignedToMe: true, isAvailable: false })),
      ...availableMatching.map((r) => ({ ...r, isAssignedToMe: false, isAvailable: true })),
    ];

    allRequests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const enriched = await Promise.all(
      allRequests.map(async (r) => {
        const items = await ctx.db
          .query("homeLabRequestItems")
          .withIndex("by_request", (q: any) => q.eq("requestId", r._id))
          .collect();

        const patient = (await ctx.db.get(r.patientId)) as Doc<"users"> | null;
        const lab = r.laboratoryId
          ? ((await ctx.db.get(r.laboratoryId)) as Doc<"laboratoryPartners"> | null)
          : null;

        return {
          ...r,
          itemsCount: items.length,
          testNames: items.map((i) => i.testName),
          fastingRequired: items.some((i) => i.fastingRequired),
          laboratoryName: lab?.name || "Laboratoire Central d'Analyses Médicales",
          patientName:
            `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
            patient?.name ||
            "Patient",
        };
      })
    );

    return enriched;
  },
});

/**
 * Checks whether current authenticated professional is authorized for HomeLab collection missions.
 */
export const checkCollectorEligibility = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { eligible: false, reason: "Non authentifié" };

    const user = await ctx.db.get(userId);
    if (!user || user.role !== ROLES.PROFESSIONNEL) {
      return { eligible: false, reason: "Réservé aux professionnels de santé" };
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    if (!provider) {
      return { eligible: false, reason: "Profil praticien introuvable" };
    }

    if (!isOperationalProfessional(provider, user)) {
      return { eligible: false, reason: "Compte praticien non encore validé ou accréditation en attente" };
    }

    if (!isEligibleCollector(provider, user)) {
      return {
        eligible: false,
        reason: `La spécialité '${provider.specialty}' n'est pas habilitée pour les missions de prélèvement à domicile (infirmier d'État ou médecin requis).`,
      };
    }

    return { eligible: true, providerId: provider._id };
  },
});

/**
 * Returns published HomeLab result for authorized caller with IDOR protection.
 * Circle members require explicit VIEW_SELECTED_HEALTH_DATA permission.
 */
export const getHomeLabResult = query({
  args: {
    requestId: v.id("homeLabRequests"),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) {
      throw new Error("Demande introuvable");
    }

    const result = await ctx.db
      .query("homeLabResults")
      .withIndex("by_request", (q: any) => q.eq("requestId", args.requestId))
      .filter((q: any) => q.neq(q.field("status"), "draft"))
      .order("desc")
      .first();

    if (!result) {
      return null;
    }

    // Permission check
    const isPatient = req.patientId === userId;
    let isAuthorizedCircleMember = false;

    if (!isPatient) {
      const membership = await ctx.db
        .query("circleMembers")
        .withIndex("by_patient_and_member", (q: any) =>
          q.eq("patientId", req.patientId).eq("memberUserId", userId)
        )
        .first();

      if (
        membership &&
        membership.status === "active" &&
        membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_SELECTED_HEALTH_DATA)
      ) {
        isAuthorizedCircleMember = true;
      }
    }

    const isAuthorizedProvider =
      user.role === ROLES.PROFESSIONNEL
        ? await verifyCareRelationship(ctx, userId, req.patientId)
        : false;

    const labCtx = await getLaboratoryContext(ctx, userId);
    const isProducingLab = Boolean(labCtx && labCtx.lab._id === result.laboratoryId);

    if (!isPatient && !isAuthorizedCircleMember && !isAuthorizedProvider && !isProducingLab) {
      throw new Error("Accès non autorisé à ce résultat d'analyse médicale");
    }

    let documentUrl: string | null = null;
    if (result.documentStorageId) {
      try {
        documentUrl = await ctx.storage.getUrl(result.documentStorageId);
      } catch {
        documentUrl = null;
      }
    }

    const lab = (await ctx.db.get(result.laboratoryId)) as Doc<"laboratoryPartners"> | null;

    return {
      ...result,
      documentUrl,
      laboratoryName: lab?.name || "Laboratoire Partenaire",
      laboratoryPhone: lab?.phone || null,
      sampleCode: req.sampleCode,
    };
  },
});

/**
 * Returns patient's HomeLab results timeline for medical record integration.
 */
export const getPatientHomeLabHistory = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);

    const isSelf = args.patientId === userId;
    let isAuthorizedCircleMember = false;

    if (!isSelf) {
      const membership = await ctx.db
        .query("circleMembers")
        .withIndex("by_patient_and_member", (q: any) =>
          q.eq("patientId", args.patientId).eq("memberUserId", userId)
        )
        .first();

      if (
        membership &&
        membership.status === "active" &&
        membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_SELECTED_HEALTH_DATA)
      ) {
        isAuthorizedCircleMember = true;
      }
    }

    const isAuthorizedProvider =
      user.role === ROLES.PROFESSIONNEL
        ? await verifyCareRelationship(ctx, userId, args.patientId)
        : false;

    if (!isSelf && !isAuthorizedCircleMember && !isAuthorizedProvider) {
      throw new Error("Non autorisé à consulter l'historique d'analyses de ce patient");
    }

    const results = await ctx.db
      .query("homeLabResults")
      .withIndex("by_patient", (q: any) => q.eq("patientId", args.patientId))
      .filter((q: any) => q.neq(q.field("status"), "draft"))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      results.map(async (r) => {
        const req = (await ctx.db.get(r.requestId)) as Doc<"homeLabRequests"> | null;
        const lab = (await ctx.db.get(r.laboratoryId)) as Doc<"laboratoryPartners"> | null;
        const items = await ctx.db
          .query("homeLabRequestItems")
          .withIndex("by_request", (q: any) => q.eq("requestId", r.requestId))
          .collect();

        return {
          _id: r._id,
          requestId: r.requestId,
          sampleCode: req?.sampleCode || "HL",
          publishedAt: r.publishedAt,
          version: r.version,
          status: r.status,
          laboratoryName: lab?.name || "Laboratoire Partenaire",
          analyses: items.map((i) => i.testName),
          generalConclusion: r.generalConclusion || null,
          hasDocument: Boolean(r.documentStorageId),
          structuredCount: r.structuredResults ? r.structuredResults.length : 0,
        };
      })
    );

    return enriched;
  },
});

// =========================================================================
// MUTATIONS
// =========================================================================

/**
 * Initializes default catalogue tests and standard partner laboratory if not present.
 */
export const initDefaultCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Check or seed laboratory partner
    let partner = await ctx.db
      .query("laboratoryPartners")
      .withIndex("by_code", (q: any) => q.eq("code", "lab-national-nkc"))
      .first();

    if (!partner) {
      const now = Date.now();
      const labId = await ctx.db.insert("laboratoryPartners", {
        name: "Laboratoire Central d'Analyses Médicales de Nouakchott",
        code: "lab-national-nkc",
        phone: "+222 45 25 12 34",
        email: "analyses@laboratoire-nkc.mr",
        address: "Avenue Gamal Abdel Nasser, Tevragh-Zeina",
        city: "Nouakchott",
        active: true,
        supportedCategories: ["hematologie", "biochimie", "metabolique", "lipidique", "autre"],
        openingHours: "7j/7 • Prélèvements 07h00 - 18h00",
        collectionFee: 400, // 400 MRU home collection fee
        createdAt: now,
        updatedAt: now,
      });
      partner = await ctx.db.get(labId);
    }

    // 2. Seed catalog tests
    let insertedCount = 0;
    const now = Date.now();
    for (const item of DEFAULT_CATALOG_TESTS) {
      const existing = await ctx.db
        .query("labTestCatalog")
        .withIndex("by_code", (q: any) => q.eq("code", item.code))
        .first();

      if (!existing) {
        await ctx.db.insert("labTestCatalog", {
          code: item.code,
          name: item.name,
          nameAr: item.nameAr,
          category: item.category,
          sampleType: item.sampleType,
          fastingRequired: item.fastingRequired,
          prescriptionRequired: item.prescriptionRequired,
          preparationInstructions: item.preparationInstructions,
          preparationInstructionsAr: item.preparationInstructionsAr,
          indicativePrice: item.indicativePrice,
          active: true,
          createdAt: now,
        });
        insertedCount++;
      }
    }

    return { success: true, insertedCount, partnerId: partner?._id };
  },
});

/**
 * Generates an upload URL for prescriptions or laboratory result documents.
 */
export const generateHomeLabUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a HomeLab request for analyses at home.
 * Supports:
 * - Direct Patient order
 * - Delegated Circle order (strictly requires MANAGE_HOMELAB)
 * - Healthcare Professional prescription order (within care relationship)
 */
export const createHomeLabRequest = mutation({
  args: {
    beneficiaryId: v.optional(v.id("users")), // If ordering for another patient
    testCodes: v.array(v.string()), // Codes from catalog
    laboratoryId: v.optional(v.id("laboratoryPartners")),
    appointmentId: v.optional(v.id("appointments")),
    scheduledDate: v.string(), // "YYYY-MM-DD"
    scheduledTimeSlot: v.string(), // "08:00 - 10:00"
    address: v.string(),
    city: v.string(),
    phone: v.string(),
    patientNotes: v.optional(v.string()),
    prescriptionStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);

    if (args.testCodes.length === 0) {
      throw new Error("Veuillez sélectionner au moins une analyse médicale");
    }

    // Determine beneficiary patient
    const patientId = args.beneficiaryId || userId;
    const isSelf = patientId === userId;

    let actorType: "patient" | "circle_member" | "professional" = "patient";

    if (!isSelf) {
      if (user.role === ROLES.PROFESSIONNEL) {
        actorType = "professional";
        const hasCare = await verifyCareRelationship(ctx, userId, patientId);
        if (!hasCare) {
          throw new Error("Relation de soin non confirmée avec ce patient");
        }
      } else {
        actorType = "circle_member";
        const membership = await ctx.db
          .query("circleMembers")
          .withIndex("by_patient_and_member", (q: any) =>
            q.eq("patientId", patientId).eq("memberUserId", userId)
          )
          .first();

        // Strict granular permission check: MANAGE_HOMELAB required (no BOOK_APPOINTMENTS fallback)
        const canOrder =
          membership &&
          membership.status === "active" &&
          (membership.permissions.includes(CIRCLE_PERMISSIONS.MANAGE_HOMELAB) ||
            membership.permissions.includes("manage_homelab"));

        if (!canOrder) {
          throw new Error("Vous ne disposez pas du mandat requis (MANAGE_HOMELAB) pour commander des analyses pour ce proche");
        }
      }
    }

    // Resolve tests from catalog
    const catalogItems: any[] = [];
    let analysesAmount = 0;
    let anyPrescriptionRequired = false;

    for (const code of args.testCodes) {
      const test = await ctx.db
        .query("labTestCatalog")
        .withIndex("by_code", (q: any) => q.eq("code", code))
        .first();

      if (!test || !test.active) {
        throw new Error(`Analyse non disponible dans le catalogue : ${code}`);
      }

      catalogItems.push(test);
      analysesAmount += test.indicativePrice || 0;
      if (test.prescriptionRequired) {
        anyPrescriptionRequired = true;
      }
    }

    if (anyPrescriptionRequired && !args.prescriptionStorageId) {
      throw new Error(
        "Une ou plusieurs analyses sélectionnées nécessitent le téléversement d'une ordonnance médicale"
      );
    }

    // Resolve laboratory partner
    let lab = args.laboratoryId
      ? ((await ctx.db.get(args.laboratoryId)) as Doc<"laboratoryPartners"> | null)
      : null;

    if (!lab) {
      lab = await ctx.db
        .query("laboratoryPartners")
        .withIndex("by_active", (q: any) => q.eq("active", true))
        .first();
    }

    if (!lab) {
      throw new Error("Aucun laboratoire partenaire actif disponible actuellement");
    }

    const collectionFee = lab.collectionFee || 400;
    const totalAmount = analysesAmount + collectionFee;

    const sampleCode = generateTrackingCode();
    const now = Date.now();

    const requestId = await ctx.db.insert("homeLabRequests", {
      sampleCode,
      patientId,
      actorUserId: userId,
      actorType,
      laboratoryId: lab._id,
      appointmentId: args.appointmentId,
      status: "scheduled",
      scheduledDate: args.scheduledDate,
      scheduledTimeSlot: args.scheduledTimeSlot,
      address: args.address.trim(),
      city: args.city.trim(),
      phone: args.phone.trim(),
      patientNotes: args.patientNotes?.trim(),
      prescriptionStorageId: args.prescriptionStorageId,
      pricingSnapshot: {
        collectionFee,
        analysesAmount,
        totalAmount,
        currency: "MRU",
      },
      createdAt: now,
      updatedAt: now,
    });

    // Insert items
    for (const item of catalogItems) {
      await ctx.db.insert("homeLabRequestItems", {
        requestId,
        testCatalogId: item._id,
        testCode: item.code,
        testName: item.name,
        category: item.category,
        indicativePrice: item.indicativePrice,
        fastingRequired: item.fastingRequired,
      });
    }

    // Log audit
    await logHomeLabAudit(ctx, {
      requestId,
      patientId,
      actorUserId: userId,
      action: "REQUEST_CREATED",
      metadata: {
        sampleCode,
        actorType,
        analysesCount: catalogItems.length,
        totalAmount,
      },
    });

    // Notify patient
    await createServerNotification(ctx, {
      userId: patientId,
      title: "Prélèvement HomeLab programmé",
      message: `Votre demande d'analyses (${sampleCode}) a été enregistrée pour le ${args.scheduledDate} (${args.scheduledTimeSlot}).`,
      type: "info",
      link: "/dashboard?tab=homelab",
    });

    return { requestId, sampleCode, success: true };
  },
});

/**
 * Assigns or accepts a healthcare professional/collector for the HomeLab request.
 * Can be called by an authorized collector (self-assignment) or laboratory/admin.
 */
export const assignCollector = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
    collectorProviderId: v.optional(v.id("providers")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) {
      throw new Error("Demande introuvable");
    }

    if (
      req.status !== "scheduled" &&
      req.status !== "requested" &&
      req.status !== "validated"
    ) {
      throw new Error(`Cette demande est au statut '${req.status}' et ne peut plus être assignée`);
    }

    // Determine target provider
    let provider: Doc<"providers"> | null = null;
    if (args.collectorProviderId) {
      provider = (await ctx.db.get(args.collectorProviderId)) as Doc<"providers"> | null;
    } else if (user.role === ROLES.PROFESSIONNEL) {
      provider = (await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first()) as Doc<"providers"> | null;
    }

    if (!provider) {
      throw new Error("Profil praticien préleveur introuvable");
    }

    const providerUser = (await ctx.db.get(provider.userId)) as Doc<"users"> | null;

    if (!isEligibleCollector(provider, providerUser)) {
      throw new Error("Soignant non habilité pour les prélèvements à domicile (infirmier d'État ou médecin requis)");
    }

    // Caller authorization: caller must be the collector themselves, the associated laboratory, or admin
    const isSelf = provider.userId === userId;
    let isAuthorizedLab = false;
    const labCtx = await getLaboratoryContext(ctx, userId);
    if (labCtx && req.laboratoryId && labCtx.lab._id === req.laboratoryId) {
      isAuthorizedLab = true;
    }

    if (!isSelf && !isAuthorizedLab && user.role !== ROLES.ADMIN) {
      throw new Error("Vous n'êtes pas autorisé à assigner cette mission");
    }

    const collectorName =
      `${providerUser?.firstName || ""} ${providerUser?.lastName || ""}`.trim() ||
      providerUser?.name ||
      "Soignant préleveur";

    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "collector_assigned",
      collectorId: provider._id,
      collectorName,
      updatedAt: now,
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: "COLLECTOR_ASSIGNED",
      metadata: { collectorName, collectorProviderId: provider._id },
    });

    // Notify patient
    await createServerNotification(ctx, {
      userId: req.patientId,
      title: "Préleveur assigné",
      message: `Votre soignant préleveur (${collectorName}) a pris en charge votre prélèvement (${req.sampleCode}) pour le ${req.scheduledDate}.`,
      type: "info",
      link: "/dashboard?tab=homelab",
    });

    // Notify collector if assigned by third-party
    if (!isSelf) {
      await createServerNotification(ctx, {
        userId: provider.userId,
        title: "Mission de prélèvement HomeLab",
        message: `Un prélèvement à domicile (${req.sampleCode}) vous a été confié pour le ${req.scheduledDate}.`,
        type: "info",
        link: "/dashboard?tab=homelab",
      });
    }

    return { success: true, collectorId: provider._id, collectorName };
  },
});

/**
 * Collector starts the collection tour for this request.
 */
export const startCollection = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Demande introuvable");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    const isAssignedCollector = provider && req.collectorId === provider._id;
    if (!isAssignedCollector && user.role !== ROLES.ADMIN) {
      throw new Error("Action réservée au soignant préleveur assigné à cette mission");
    }

    await ctx.db.patch(args.requestId, {
      status: "collection_in_progress",
      updatedAt: Date.now(),
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: "COLLECTION_IN_PROGRESS",
    });

    return { success: true };
  },
});

/**
 * Collector records successful home sample collection.
 */
export const confirmSampleCollected = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Demande introuvable");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    const isAssignedCollector = provider && req.collectorId === provider._id;
    if (!isAssignedCollector && user.role !== ROLES.ADMIN) {
      throw new Error("Action réservée au soignant préleveur assigné à cette mission");
    }

    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "sample_collected",
      collectedAt: now,
      updatedAt: now,
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: "SAMPLE_COLLECTED",
      metadata: { collectedAt: now },
    });

    // Notify patient
    await createServerNotification(ctx, {
      userId: req.patientId,
      title: "Échantillon prélevé",
      message: `Votre prélèvement HomeLab (${req.sampleCode}) a été réalisé avec succès et est en acheminement vers le laboratoire.`,
      type: "info",
      link: "/dashboard?tab=homelab",
    });

    return { success: true };
  },
});


/**
 * Collector records collection failure (absent, fasting violated, etc.).
 */
export const reportCollectionFailure = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Demande introuvable");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    const isAssignedCollector = provider && req.collectorId === provider._id;
    if (!isAssignedCollector && user.role !== ROLES.ADMIN) {
      throw new Error("Action réservée au soignant préleveur assigné à cette mission");
    }

    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "collection_failed",
      collectionFailureReason: args.reason.trim(),
      updatedAt: now,
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: "COLLECTION_FAILED",
      metadata: { reason: args.reason },
    });

    // Notify patient
    await createServerNotification(ctx, {
      userId: req.patientId,
      title: "Prélèvement non effectué",
      message: `Le prélèvement prévu n'a pas pu être réalisé (${args.reason}). Vous pouvez reprogrammer votre rendez-vous.`,
      type: "alert",
      link: "/dashboard?tab=homelab",
    });

    return { success: true };
  },
});


/**
 * Laboratory acknowledges reception of sample at the facility.
 */
export const receiveSampleAtLab = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const labCtx = await getLaboratoryContext(ctx, userId);
    if (!labCtx) throw new Error("Habilitation laboratoire requise");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Demande introuvable");

    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "processing",
      receivedByLabAt: now,
      updatedAt: now,
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: "RECEIVED_BY_LAB",
      metadata: { laboratoryId: labCtx.lab._id },
    });

    return { success: true };
  },
});


/**
 * Laboratory publishes verified medical results.
 * Can be a structured report, official PDF document, or both.
 * Implements safe amendment versioning if already published.
 */
export const publishResult = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
    documentStorageId: v.optional(v.string()),
    generalConclusion: v.optional(v.string()),
    amendmentReason: v.optional(v.string()),
    structuredResults: v.optional(
      v.array(
        v.object({
          testName: v.string(),
          analyte: v.string(),
          value: v.string(),
          unit: v.optional(v.string()),
          referenceRange: v.optional(v.string()),
          abnormalFlag: v.optional(v.boolean()),
          comment: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const labCtx = await getLaboratoryContext(ctx, userId);
    if (!labCtx) throw new Error("Habilitation laboratoire requise pour publier des résultats");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Demande introuvable");

    if (!args.documentStorageId && (!args.structuredResults || args.structuredResults.length === 0)) {
      throw new Error("Veuillez fournir au moins un compte-rendu PDF ou des résultats structurés");
    }

    // Check existing result version
    const existing = await ctx.db
      .query("homeLabResults")
      .withIndex("by_request", (q: any) => q.eq("requestId", args.requestId))
      .order("desc")
      .first();

    const isAmendment = Boolean(existing && existing.status !== "draft");
    const nextVersion = isAmendment ? existing!.version + 1 : 1;

    if (isAmendment && !args.amendmentReason) {
      throw new Error("Un motif explicite est obligatoire pour amender un résultat déjà publié");
    }

    const now = Date.now();

    const resultId = await ctx.db.insert("homeLabResults", {
      requestId: args.requestId,
      patientId: req.patientId,
      laboratoryId: labCtx.lab._id,
      status: isAmendment ? "amended" : "published",
      version: nextVersion,
      documentStorageId: args.documentStorageId,
      generalConclusion: args.generalConclusion?.trim(),
      structuredResults: args.structuredResults,
      publishedByUserId: userId,
      publishedAt: now,
      amendmentReason: args.amendmentReason?.trim(),
      previousResultId: existing?._id,
    });

    // Synchronisation idempotente vers healthObservations (write-path Module 6)
    await syncHomeLabResultToChronic(ctx, resultId);

    // Update request status to result_available / completed
    await ctx.db.patch(args.requestId, {
      status: "completed",
      resultPublishedAt: now,
      completedAt: now,
      updatedAt: now,
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: isAmendment ? "RESULT_AMENDED" : "RESULT_PUBLISHED",
      metadata: {
        resultId,
        version: nextVersion,
      },
    });

    // High-level safe notification to patient (NO raw values)
    await createServerNotification(ctx, {
      userId: req.patientId,
      title: isAmendment ? "Résultats HomeLab actualisés" : "Résultats d'analyses disponibles",
      message: `Les résultats de vos analyses (${req.sampleCode}) sont disponibles et consultables en toute sécurité dans votre espace santé.`,
      type: "info",
      link: "/dashboard?tab=homelab",
    });

    return { resultId, version: nextVersion, success: true };
  },
});

/**
 * Patient or initiator cancels request before collection starts.
 */
export const cancelHomeLabRequest = mutation({
  args: {
    requestId: v.id("homeLabRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Demande introuvable");

    if (req.patientId !== userId && req.actorUserId !== userId) {
      throw new Error("Seul l'initiateur ou le patient peut annuler cette demande");
    }

    // Cancellation is blocked once collection has been performed
    if (
      req.status === "sample_collected" ||
      req.status === "in_transit" ||
      req.status === "received_by_lab" ||
      req.status === "processing" ||
      req.status === "completed"
    ) {
      throw new Error("Impossible d'annuler une demande dont le prélèvement a déjà été effectué");
    }

    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      updatedAt: now,
    });

    await logHomeLabAudit(ctx, {
      requestId: args.requestId,
      patientId: req.patientId,
      actorUserId: userId,
      action: "REQUEST_CANCELLED",
      metadata: { reason: args.reason },
    });

    return { success: true };
  },
});


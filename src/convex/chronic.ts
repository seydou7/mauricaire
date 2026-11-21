import { mutation, query, internalMutation, DatabaseWriter } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import { createServerNotification } from "./notifications";
import { CIRCLE_PERMISSIONS } from "./circle";
import { isOperationalProfessional } from "./providers";

// =========================================================================
// CANONICAL DEFINITIONS & DEV CATALOGUE FIXTURES
// =========================================================================

export const DEFAULT_CONDITIONS = [
  {
    code: "hypertension",
    label: "Hypertension Artérielle (HTA)",
    labelAr: "ارتفاع ضغط الدم (HTA)",
    category: "chronique",
    description: "Surveillance de la pression artérielle systolique et diastolique et de la fréquence cardiaque.",
    defaultMeasurementCodes: ["bp", "pulse"],
  },
  {
    code: "diabete_t2",
    label: "Diabète de type 2 (Cardiométabolique)",
    labelAr: "داء السكري من النوع الثاني",
    category: "cardiometabolique",
    description: "Surveillance glycémique, hémoglobine glyquée (HbA1c) et suivi pondéral.",
    defaultMeasurementCodes: ["glucose", "hba1c", "weight"],
  },
  {
    code: "diabete_t1",
    label: "Diabète de type 1",
    labelAr: "داء السكري من النوع الأول",
    category: "cardiometabolique",
    description: "Auto-surveillance glycémique pluriquotidienne.",
    defaultMeasurementCodes: ["glucose", "hba1c"],
  },
  {
    code: "suivi_post_operatoire",
    label: "Surveillance Post-Opératoire",
    labelAr: "المتابعة والمراقبة بعد العمليات الجراحية",
    category: "post_operatoire",
    description: "Surveillance de la température, de l'évaluation de la douleur et des signes infectieux.",
    defaultMeasurementCodes: ["temperature", "pain_score", "pulse"],
  },
  {
    code: "insuffisance_cardiaque",
    label: "Insuffisance Cardiaque Chronique",
    labelAr: "قصور القلب المزمن",
    category: "chronique",
    description: "Surveillance de la prise de poids rapide (œdèmes), tension et saturation en oxygène.",
    defaultMeasurementCodes: ["weight", "bp", "pulse", "spo2"],
  },
  {
    code: "asthme_bpco",
    label: "Asthme & Affections Respiratoires",
    labelAr: "الربو وأمراض الجهاز التنفسي المزمنة",
    category: "respiratoire",
    description: "Surveillance de la saturation SpO2 et tolérance respiratoire.",
    defaultMeasurementCodes: ["spo2", "pulse"],
  },
  {
    code: "rehabilitation",
    label: "Programme de Réhabilitation & Récupération",
    labelAr: "برنامج التأهيل البدني والتعافي",
    category: "temporaire",
    description: "Suivi fonctionnel temporaire et tolérance à l'effort.",
    defaultMeasurementCodes: ["pain_score", "bp", "pulse"],
  },
];


// Helper to normalize measurement codes
export function normalizeMeasurementCode(code: string): string {
  if (!code) return "general";
  const c = code.toLowerCase().trim();
  switch (c) {
    case "blood_pressure":
    case "tension":
      return "bp";
    case "heart_rate":
    case "pouls":
      return "pulse";
    case "blood_glucose":
    case "glycemie":
      return "glucose";
    case "temp":
    case "temperature":
      return "temperature";
    case "poids":
      return "weight";
    case "oxygen":
      return "spo2";
    case "pain_level":
      return "pain_score";
    default:
      return c;
  }
}

export const DEFAULT_MEASUREMENTS = [
  {
    code: "bp",
    name: "Pression Artérielle (Tension)",
    nameAr: "ضغط الدم (الانقباضي / الانبساطي)",
    category: "vital",
    unit: "mmHg",
    isPaired: true,
    minPlausible: 40,
    maxPlausible: 260,
  },
  {
    code: "pulse",
    name: "Fréquence Cardiaque (Pouls)",
    nameAr: "النبض ومعدل ضربات القلب",
    category: "vital",
    unit: "bpm",
    minPlausible: 30,
    maxPlausible: 220,
  },
  {
    code: "glucose",
    name: "Glycémie (Sucre sanguin)",
    nameAr: "نسبة السكر في الدم",
    category: "metabolic",
    unit: "mg/dL",
    minPlausible: 20,
    maxPlausible: 600,
  },
  {
    code: "temperature",
    name: "Température Corporelle",
    nameAr: "درجة حرارة الجسم",
    category: "vital",
    unit: "°C",
    minPlausible: 34.0,
    maxPlausible: 43.0,
  },
  {
    code: "weight",
    name: "Poids Corporel",
    nameAr: "الوزن بالكيلوغرام",
    category: "vital",
    unit: "kg",
    minPlausible: 2.0,
    maxPlausible: 300.0,
  },
  {
    code: "spo2",
    name: "Saturation en Oxygène (SpO2)",
    nameAr: "تشبع الأكسجين في الدم (SpO2)",
    category: "respiratory",
    unit: "%",
    minPlausible: 50,
    maxPlausible: 100,
  },
  {
    code: "hba1c",
    name: "Hémoglobine Glyquée (HbA1c)",
    nameAr: "السكر التراكمي (HbA1c)",
    category: "metabolic",
    unit: "%",
    minPlausible: 3.5,
    maxPlausible: 18.0,
  },
  {
    code: "pain_score",
    name: "Évaluation de la Douleur (EN)",
    nameAr: "مقياس شدة الألم (من 0 إلى 10)",
    category: "symptom",
    unit: "score 0-10",
    minPlausible: 0,
    maxPlausible: 10,
  },
];

// =========================================================================
// AUTHORIZATION & VERIFICATION HELPERS
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
 * Checks if caller has legitimate care relationship with patient.
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

  const hasAppointment = appointments.some(
    (a: any) =>
      a.status === APPOINTMENT_STATUS.CONFIRMED ||
      a.status === APPOINTMENT_STATUS.COMPLETED
  );
  if (hasAppointment) return true;

  // Has HomeLab collection mission for this patient
  const homeLabMission = await ctx.db
    .query("homeLabRequests")
    .withIndex("by_collector", (q: any) => q.eq("collectorId", provider._id))
    .filter((q: any) => q.eq(q.field("patientId"), patientId))
    .first();
  if (homeLabMission) return true;

  // Has recorded patient vitals
  const vital = await ctx.db
    .query("patientVitals")
    .withIndex("by_patientId", (q: any) => q.eq("patientId", patientId))
    .filter((q: any) => q.eq(q.field("recordedBy"), professionalUserId))
    .first();
  if (vital) return true;

  // Has active or past monitoring program where this professional is responsible
  const program = await ctx.db
    .query("monitoringPrograms")
    .withIndex("by_patient", (q: any) => q.eq("patientId", patientId))
    .filter((q: any) => q.eq(q.field("responsibleProviderId"), provider._id))
    .first();
  if (program) return true;

  return false;
}

/**
 * Verifies access to longitudinal health data for patient, caregiver, or professional.
 * Prevents all-or-nothing access: Circle requires explicit VIEW_SELECTED_HEALTH_DATA.
 */
export async function authorizeHealthDataAccess(
  ctx: any,
  callerUserId: Id<"users">,
  patientId: Id<"users">
) {
  if (callerUserId === patientId) {
    return { isSelf: true, isProvider: false, isCircle: false };
  }

  const callerUser = (await ctx.db.get(callerUserId)) as Doc<"users"> | null;
  if (!callerUser) {
    throw new Error("Utilisateur introuvable");
  }

  if (callerUser.role === ROLES.PROFESSIONNEL) {
    const isCareProvider = await verifyCareRelationship(ctx, callerUserId, patientId);
    if (isCareProvider) {
      return { isSelf: false, isProvider: true, isCircle: false };
    }
  }

  // Circle check
  const membership = await ctx.db
    .query("circleMembers")
    .withIndex("by_patient_and_member", (q: any) =>
      q.eq("patientId", patientId).eq("memberUserId", callerUserId)
    )
    .first();

  if (
    membership &&
    membership.status === "active" &&
    (!membership.expiresAt || membership.expiresAt >= Date.now()) &&
    membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_SELECTED_HEALTH_DATA)
  ) {
    return { isSelf: false, isProvider: false, isCircle: true };
  }

  if (callerUser.role === ROLES.ADMIN) {
    return { isSelf: false, isProvider: false, isCircle: false, isAdmin: true };
  }

  throw new Error("Accès non autorisé aux données de santé de ce patient");
}

/**
 * Consistently logs longitudinal health audit events.
 */
async function logMonitoringAudit(
  ctx: any,
  args: {
    patientId: Id<"users">;
    actorUserId: Id<"users">;
    action: string;
    metadata?: any;
  }
) {
  await ctx.db.insert("monitoringAuditEvents", {
    patientId: args.patientId,
    actorUserId: args.actorUserId,
    action: args.action,
    timestamp: Date.now(),
    metadata: args.metadata,
  });
}

// =========================================================================
// DATA UNIFICATION & IDEMPOTENT SYNC HELPERS (WRITE-PATH ONLY)
// =========================================================================

/**
 * Idempotently synchronizes a patientVital record into healthObservations (write-path).
 * Handles blood pressure (bp), pulse, and temperature.
 * Guarantees duplicate-prevention via sourceReferenceId index.
 */
export async function syncPatientVitalToChronic(
  ctx: { db: DatabaseWriter },
  vital: {
    vitalId?: Id<"patientVitals">;
    patientId: Id<"users">;
    recordedBy: Id<"users">;
    bloodPressure?: string;
    pulse?: number;
    temperature?: number;
    recordedAt: number;
  }
) {
  const sourceRefBase = vital.vitalId ? `vital_${vital.vitalId}` : `vital_${vital.patientId}_${vital.recordedAt}`;
  const recordedByUser = (await ctx.db.get(vital.recordedBy)) as Doc<"users"> | null;
  const recordedByRole = recordedByUser?.role || "professionnel";

  // 1. Blood Pressure
  if (vital.bloodPressure) {
    const bpRef = `${sourceRefBase}_bp`;
    const alreadySynced = await ctx.db
      .query("healthObservations")
      .withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", bpRef))
      .first();

    const legacySynced = vital.vitalId
      ? await ctx.db
          .query("healthObservations")
          .withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", `vital_${vital.vitalId}`))
          .first()
      : null;

    if (!alreadySynced && !legacySynced) {
      const parts = vital.bloodPressure.split("/").map((p: string) => parseInt(p.trim(), 10));
      let sys: number | undefined;
      let dia: number | undefined;

      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // Normalize 12/8 to 120/80 mmHg if needed
        sys = parts[0] < 30 ? parts[0] * 10 : parts[0];
        dia = parts[1] < 20 ? parts[1] * 10 : parts[1];
      }

      await ctx.db.insert("healthObservations", {
        patientId: vital.patientId,
        measurementCode: "bp",
        numericValue: sys,
        secondaryNumericValue: dia,
        textValue: vital.bloodPressure,
        unit: "mmHg",
        observedAt: vital.recordedAt,
        recordedAt: vital.recordedAt,
        recordedByUserId: vital.recordedBy,
        recordedByRole,
        source: "consultation",
        sourceReferenceId: bpRef,
        notes: "Relevé lors d'une visite de soins",
        createdAt: vital.recordedAt,
      });
    }
  }

  // 2. Pulse
  if (vital.pulse) {
    const pulseRef = `${sourceRefBase}_pulse`;
    const alreadySynced = await ctx.db
      .query("healthObservations")
      .withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", pulseRef))
      .first();

    if (!alreadySynced) {
      await ctx.db.insert("healthObservations", {
        patientId: vital.patientId,
        measurementCode: "pulse",
        numericValue: vital.pulse,
        unit: "bpm",
        observedAt: vital.recordedAt,
        recordedAt: vital.recordedAt,
        recordedByUserId: vital.recordedBy,
        recordedByRole,
        source: "consultation",
        sourceReferenceId: pulseRef,
        notes: "Relevé lors d'une visite de soins",
        createdAt: vital.recordedAt,
      });
    }
  }

  // 3. Temperature
  if (vital.temperature !== undefined) {
    const tempRef = `${sourceRefBase}_temp`;
    const alreadySynced = await ctx.db
      .query("healthObservations")
      .withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", tempRef))
      .first();

    if (!alreadySynced) {
      await ctx.db.insert("healthObservations", {
        patientId: vital.patientId,
        measurementCode: "temperature",
        numericValue: vital.temperature,
        unit: "°C",
        observedAt: vital.recordedAt,
        recordedAt: vital.recordedAt,
        recordedByUserId: vital.recordedBy,
        recordedByRole,
        source: "consultation",
        sourceReferenceId: tempRef,
        notes: "Relevé lors d'une visite de soins",
        createdAt: vital.recordedAt,
      });
    }
  }
}

/**
 * Idempotently maps published HomeLab results (Module 7) into longitudinal healthObservations (write-path).
 */
export async function syncHomeLabResultToChronic(
  ctx: { db: DatabaseWriter },
  resultId: Id<"homeLabResults">
) {
  const res = (await ctx.db.get(resultId)) as Doc<"homeLabResults"> | null;
  if (!res || res.status === "draft") return;

  if (res.structuredResults && res.structuredResults.length > 0) {
    for (const item of res.structuredResults) {
      const analyteNormalized = item.analyte?.toLowerCase() || item.testName.toLowerCase();
      let measurementCode: string | null = null;

      if (analyteNormalized.includes("glyc") || analyteNormalized.includes("sugar")) {
        measurementCode = "glucose";
      } else if (analyteNormalized.includes("hba1c") || analyteNormalized.includes("glyquée")) {
        measurementCode = "hba1c";
      }

      if (measurementCode) {
        const sourceRef = `homelab_${res._id}_${item.analyte || item.testName}`;
        const existing = await ctx.db
          .query("healthObservations")
          .withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", sourceRef))
          .first();

        if (!existing) {
          const num = parseFloat(item.value.replace(",", "."));
          await ctx.db.insert("healthObservations", {
            patientId: res.patientId,
            measurementCode,
            numericValue: !isNaN(num) ? num : undefined,
            textValue: item.value,
            unit: item.unit || (measurementCode === "glucose" ? "mg/dL" : "%"),
            observedAt: res.publishedAt,
            recordedAt: res.publishedAt,
            recordedByUserId: res.publishedByUserId,
            recordedByRole: "laboratoire",
            source: "homelab",
            sourceReferenceId: sourceRef,
            notes: item.comment || "Résultat officiel validé par le laboratoire",
            attentionFlag: item.abnormalFlag,
            attentionSeverity: item.abnormalFlag ? "warning" : undefined,
            createdAt: res.publishedAt,
          });
        }
      }
    }
  }
}

/**
 * Internal-only reconciliation & backfill mutation for historical consultation vitals.
 * Safe, idempotent, non-destructive.
 */
export const backfillConsultationVitals = internalMutation({
  args: {
    patientId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const vitalsQuery = args.patientId
      ? ctx.db.query("patientVitals").withIndex("by_patientId", (q: any) => q.eq("patientId", args.patientId!))
      : ctx.db.query("patientVitals");

    const vitals = await vitalsQuery.collect();
    const scanned = vitals.length;
    let inserted = 0;
    let skipped = 0;

    for (const v of vitals) {
      const sourceRefBase = `vital_${v._id}`;
      let willInsert = false;

      if (v.bloodPressure) {
        const bpRef = `${sourceRefBase}_bp`;
        const already = (await ctx.db.query("healthObservations").withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", bpRef)).first()) ||
                        (await ctx.db.query("healthObservations").withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", sourceRefBase)).first());
        if (!already) willInsert = true;
      }
      if (v.pulse) {
        const pulseRef = `${sourceRefBase}_pulse`;
        const already = await ctx.db.query("healthObservations").withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", pulseRef)).first();
        if (!already) willInsert = true;
      }
      if ((v as any).temperature !== undefined) {
        const tempRef = `${sourceRefBase}_temp`;
        const already = await ctx.db.query("healthObservations").withIndex("by_source_ref", (q: any) => q.eq("sourceReferenceId", tempRef)).first();
        if (!already) willInsert = true;
      }

      if (willInsert) {
        inserted++;
      } else {
        skipped++;
      }

      await syncPatientVitalToChronic(ctx, {
        vitalId: v._id,
        patientId: v.patientId,
        recordedBy: v.recordedBy,
        bloodPressure: v.bloodPressure,
        pulse: v.pulse,
        temperature: (v as any).temperature,
        recordedAt: v.recordedAt,
      });
    }

    return { scanned, inserted, skipped };
  },
});

// =========================================================================
// QUERIES
// =========================================================================

/**
 * Returns canonical condition catalog.
 */
export const getConditionCatalog = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db
      .query("conditionCatalog")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();
    return list;
  },
});

/**
 * Returns canonical measurement definitions with plausibility ranges.
 */
export const getMeasurementDefinitions = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db
      .query("measurementDefinitions")
      .withIndex("by_category")
      .collect();
    return list;
  },
});

/**
 * Returns assigned conditions for a patient.
 */
export const getPatientConditions = query({
  args: {
    patientId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    await authorizeHealthDataAccess(ctx, userId, targetPatientId);

    const conditions = await ctx.db
      .query("patientConditions")
      .withIndex("by_patient", (q: any) => q.eq("patientId", targetPatientId))
      .order("desc")
      .collect();

    return conditions;
  },
});

/**
 * Returns active monitoring programs for a patient.
 */
export const getMonitoringPrograms = query({
  args: {
    patientId: v.optional(v.id("users")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    const authContext = await authorizeHealthDataAccess(ctx, userId, targetPatientId);

    let programs = await ctx.db
      .query("monitoringPrograms")
      .withIndex("by_patient", (q: any) => q.eq("patientId", targetPatientId))
      .order("desc")
      .collect();

    if (!args.includeInactive) {
      programs = programs.filter((p) => p.status === "active");
    }

    // Granular Circle Sharing: If accessed by Circle member, filter to shared programs
    if (authContext.isCircle) {
      programs = programs.filter((p) => p.shareWithCircle !== false);
    }

    // Enrich with responsible provider name
    const enriched = await Promise.all(
      programs.map(async (p) => {
        let responsibleName: string | null = null;
        if (p.responsibleUserId) {
          const u = (await ctx.db.get(p.responsibleUserId)) as Doc<"users"> | null;
          responsibleName = `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.name || null;
        }

        // Get latest observation for this program
        const latestObs = await ctx.db
          .query("healthObservations")
          .withIndex("by_program", (q: any) => q.eq("monitoringProgramId", p._id))
          .order("desc")
          .first();

        const measurementCodes = Array.isArray(p.measurementCodes)
          ? p.measurementCodes
          : Array.isArray((p as any).requiredMeasurementCodes)
          ? (p as any).requiredMeasurementCodes
          : [];
        const expectedFrequency = p.expectedFrequency || (p as any).frequency || "daily";

        return {
          ...p,
          measurementCodes,
          requiredMeasurementCodes: measurementCodes,
          expectedFrequency,
          frequency: expectedFrequency,
          description: p.notes || "",
          responsibleName,
          lastMeasurementAt: latestObs?.observedAt || null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Returns longitudinal health observations for graphing and time-series analysis.
 * Performs transparent, idempotent unification with consultation vitals and HomeLab data.
 */
export const getHealthObservations = query({
  args: {
    patientId: v.optional(v.id("users")),
    measurementCode: v.string(), // "bp", "pulse", "glucose", "temperature", "weight", "spo2", etc.
    monitoringProgramId: v.optional(v.id("monitoringPrograms")),
    startDate: v.optional(v.number()), // timestamp
    endDate: v.optional(v.number()), // timestamp
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    await authorizeHealthDataAccess(ctx, userId, targetPatientId);

    const now = Date.now();
    const defaultStart = now - 30 * 24 * 60 * 60 * 1000; // default 30 days
    const rangeStart = args.startDate || defaultStart;
    const rangeEnd = args.endDate || now;

    // Fetch observations for this patient and measurement
    let observations = await ctx.db
      .query("healthObservations")
      .withIndex("by_patient_measurement", (q: any) =>
        q.eq("patientId", targetPatientId).eq("measurementCode", args.measurementCode)
      )
      .filter((q: any) =>
        q.and(
          q.gte(q.field("observedAt"), rangeStart),
          q.lte(q.field("observedAt"), rangeEnd)
        )
      )
      .order("asc") // chronological for graph
      .collect();

    if (args.monitoringProgramId) {
      observations = observations.filter(
        (o) => o.monitoringProgramId === args.monitoringProgramId
      );
    }

    if (args.limit && observations.length > args.limit) {
      observations = observations.slice(-args.limit);
    }

    // Compute factual mathematical statistics without generative AI conclusions
    let stats: any = null;
    if (observations.length > 0) {
      const validNumerics = observations
        .map((o) => o.numericValue)
        .filter((v): v is number => typeof v === "number");

      if (validNumerics.length > 0) {
        const min = Math.min(...validNumerics);
        const max = Math.max(...validNumerics);
        const sum = validNumerics.reduce((a, b) => a + b, 0);
        const avg = Math.round((sum / validNumerics.length) * 10) / 10;
        const last = observations[observations.length - 1];

        stats = {
          count: observations.length,
          min,
          max,
          avg,
          lastValue: last.numericValue,
          lastSecondaryValue: last.secondaryNumericValue,
          lastObservedAt: last.observedAt,
          unit: last.unit,
        };
      }
    }

    return {
      measurementCode: args.measurementCode,
      rangeStart,
      rangeEnd,
      stats,
      points: observations.map((o) => ({
        _id: o._id,
        observedAt: o.observedAt,
        dateFormatted: new Date(o.observedAt).toLocaleDateString(),
        timeFormatted: new Date(o.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        numericValue: o.numericValue,
        secondaryNumericValue: o.secondaryNumericValue, // diastolic for BP
        textValue: o.textValue,
        unit: o.unit,
        source: o.source,
        context: o.context,
        notes: o.notes,
        attentionFlag: o.attentionFlag,
        attentionSeverity: o.attentionSeverity,
      })),
    };
  },
});

/**
 * Returns patient summary card metrics for Chronic Dashboard.
 */

export const getAllPatientObservations = query({
  args: {
    patientId: v.optional(v.id("users")),
    measurementCode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    await authorizeHealthDataAccess(ctx, userId, targetPatientId);

    const query = ctx.db
      .query("healthObservations")
      .withIndex("by_patient_observed", (q: any) => q.eq("patientId", targetPatientId))
      .order("desc");

    let observations = await query.collect();

    if (args.measurementCode && args.measurementCode !== "all") {
      const targetNormalized = normalizeMeasurementCode(args.measurementCode);
      observations = observations.filter((o) => {
        const obsNormalized = normalizeMeasurementCode(o.measurementCode);
        return (
          obsNormalized === targetNormalized ||
          o.measurementCode === args.measurementCode ||
          o.measurementCode === targetNormalized
        );
      });
    }

    if (args.limit) {
      observations = observations.slice(0, args.limit);
    }

    return observations;
  },
});


export const getPatientChronicSummary = query({
  args: {
    patientId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    await authorizeHealthDataAccess(ctx, userId, targetPatientId);

    const conditions = await ctx.db
      .query("patientConditions")
      .withIndex("by_patient_status", (q: any) =>
        q.eq("patientId", targetPatientId).eq("status", "active")
      )
      .collect();

    const programs = await ctx.db
      .query("monitoringPrograms")
      .withIndex("by_patient_status", (q: any) =>
        q.eq("patientId", targetPatientId).eq("status", "active")
      )
      .collect();

    // Fetch recent observations (read-only)
    const observations = await ctx.db
      .query("healthObservations")
      .withIndex("by_patient_observed", (q: any) => q.eq("patientId", targetPatientId))
      .order("desc")
      .take(100);

    const latestByCode: Record<string, any> = {};
    const attentionFlags: Array<{ measurementCode: string; message: string; severity: string }> = [];

    for (const obs of observations) {
      if (!latestByCode[obs.measurementCode]) {
        latestByCode[obs.measurementCode] = {
          numericValue: obs.numericValue,
          secondaryNumericValue: obs.secondaryNumericValue,
          unit: obs.unit,
          observedAt: obs.observedAt,
        };
      }
      if (obs.attentionFlag && attentionFlags.length < 5) {
        attentionFlags.push({
          measurementCode: obs.measurementCode,
          message: "Mesure méritant l'attention de votre soignant traitant.",
          severity: obs.attentionSeverity || "info",
        });
      }
    }

    // Latest Blood Pressure (with aliases)
    const latestBp = latestByCode["bp"] || latestByCode["blood_pressure"] || latestByCode["tension"];
    const latestGlucose = latestByCode["glucose"] || latestByCode["blood_glucose"] || latestByCode["glycemie"];
    const latestPulse = latestByCode["pulse"] || latestByCode["heart_rate"] || latestByCode["pouls"];
    const latestTemp = latestByCode["temperature"] || latestByCode["temp"];
    const latestWeight = latestByCode["weight"] || latestByCode["poids"];
    const latestSpo2 = latestByCode["spo2"] || latestByCode["oxygen"];

    return {
      totalObservations: observations.length,
      activeConditionsCount: conditions.length,
      activeProgramsCount: programs.length,
      hasRecentAttentionFlag: attentionFlags.length > 0,
      attentionFlags,
      latestByCode,
      conditions: conditions.map((c) => ({
        code: c.conditionCode,
        name: c.conditionName,
        type: c.type,
      })),
      latestVitals: {
        bp: latestBp
          ? {
              sys: latestBp.numericValue,
              dia: latestBp.secondaryNumericValue,
              text: `${latestBp.numericValue}/${latestBp.secondaryNumericValue || 80}`,
              observedAt: latestBp.observedAt,
              source: "synced",
              attentionFlag: false,
            }
          : null,
        glucose: latestGlucose
          ? {
              value: latestGlucose.numericValue,
              unit: latestGlucose.unit || "mg/dL",
              observedAt: latestGlucose.observedAt,
              source: "synced",
              context: undefined,
              attentionFlag: false,
            }
          : null,
        pulse: latestPulse
          ? {
              value: latestPulse.numericValue,
              unit: latestPulse.unit || "bpm",
              observedAt: latestPulse.observedAt,
              source: "synced",
              attentionFlag: false,
            }
          : null,
        temperature: latestTemp
          ? {
              value: latestTemp.numericValue,
              unit: latestTemp.unit || "°C",
              observedAt: latestTemp.observedAt,
              source: "synced",
              attentionFlag: false,
            }
          : null,
        weight: latestWeight
          ? {
              value: latestWeight.numericValue,
              unit: latestWeight.unit || "kg",
              observedAt: latestWeight.observedAt,
              source: "synced",
              attentionFlag: false,
            }
          : null,
        spo2: latestSpo2
          ? {
              value: latestSpo2.numericValue,
              unit: latestSpo2.unit || "%",
              observedAt: latestSpo2.observedAt,
              source: "synced",
              attentionFlag: false,
            }
          : null,
      },
    };
  },
});

/**
 * Returns formatted data subset for inclusion in a Module 6 Relay consultation.
 * Upholds minimum necessary data principle.
 */
export const getObservationsForRelay = query({
  args: {
    patientId: v.id("users"),
    measurementCode: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    if (user.role !== ROLES.PROFESSIONNEL) {
      throw new Error("Réservé aux soignants traitants");
    }

    const hasCare = await verifyCareRelationship(ctx, userId, args.patientId);
    if (!hasCare) {
      throw new Error("Relation de soin non confirmée avec ce patient");
    }

    const daysCount = args.days || 7;
    const since = Date.now() - daysCount * 24 * 60 * 60 * 1000;

    const obs = await ctx.db
      .query("healthObservations")
      .withIndex("by_patient_measurement", (q: any) =>
        q.eq("patientId", args.patientId).eq("measurementCode", args.measurementCode)
      )
      .filter((q: any) => q.gte(q.field("observedAt"), since))
      .order("desc")
      .take(15);

    return obs.map((o) => ({
      date: new Date(o.observedAt).toLocaleDateString(),
      value: o.secondaryNumericValue
        ? `${o.numericValue}/${o.secondaryNumericValue} ${o.unit}`
        : `${o.numericValue} ${o.unit}`,
      source: o.source,
      notes: o.notes || undefined,
    }));
  },
});

/**
 * Returns monitored patients queue for a Healthcare Professional.
 */
export const getProfessionalMonitoredPatients = query({
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

    if (!isOperationalProfessional(provider)) {
      return [];
    }

    // Patients with confirmed/completed appointments
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), APPOINTMENT_STATUS.CONFIRMED),
          q.eq(q.field("status"), APPOINTMENT_STATUS.COMPLETED)
        )
      )
      .collect();

    const patientIds = appointments.map((a: any) => a.patientId);

    // Patients with patientVitals recorded by this professional
    const vitalsRecorded = await ctx.db
      .query("patientVitals")
      .filter((q: any) => q.eq(q.field("recordedBy"), userId))
      .collect();
    for (const v of vitalsRecorded) {
      if (v.patientId) patientIds.push(v.patientId);
    }

    // Patients with healthObservations recorded by this professional
    const obsRecorded = await ctx.db
      .query("healthObservations")
      .filter((q: any) => q.eq(q.field("recordedByUserId"), userId))
      .collect();
    for (const o of obsRecorded) {
      if (o.patientId) patientIds.push(o.patientId);
    }

    // Patients with HomeLab missions assigned to this professional
    const homeLabMissions = await ctx.db
      .query("homeLabRequests")
      .withIndex("by_collector", (q: any) => q.eq("collectorId", provider._id))
      .collect();
    for (const m of homeLabMissions) {
      if (m.patientId) patientIds.push(m.patientId);
    }

    // Patients with monitoring programs where this professional is responsible
    const programsAssigned = await ctx.db
      .query("monitoringPrograms")
      .withIndex("by_provider", (q: any) => q.eq("responsibleProviderId", provider._id))
      .collect();
    for (const p of programsAssigned) {
      if (p.patientId) patientIds.push(p.patientId);
    }

    const uniquePatientIds = Array.from(new Set(patientIds));

    const patientsData = await Promise.all(
      uniquePatientIds.map(async (pid: any) => {
        const patient = (await ctx.db.get(pid)) as Doc<"users"> | null;
        if (!patient) return null;

        const activePrograms = await ctx.db
          .query("monitoringPrograms")
          .withIndex("by_patient_status", (q: any) =>
            q.eq("patientId", pid).eq("status", "active")
          )
          .collect();

        // Check recent attention flag in past 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentAlertObs = await ctx.db
          .query("healthObservations")
          .withIndex("by_patient_observed", (q: any) =>
            q.eq("patientId", pid).gte("observedAt", sevenDaysAgo)
          )
          .filter((q: any) => q.eq(q.field("attentionFlag"), true))
          .first();

        // Latest observation
        const latestObs = await ctx.db
          .query("healthObservations")
          .withIndex("by_patient_observed", (q: any) => q.eq("patientId", pid))
          .order("desc")
          .first();

        const obsList = await ctx.db
          .query("healthObservations")
          .withIndex("by_patient_observed", (q: any) => q.eq("patientId", pid))
          .collect();

        const patientName =
          `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || patient.name || "Patient";

        return {
          _id: patient._id,
          patientId: patient._id,
          name: patientName,
          patientName,
          relationship: "Patient suivi",
          phone: patient.phone || "",
          observationCount: obsList.length,
          activeProgramsCount: activePrograms.length,
          programTitles: activePrograms.map((p) => p.title),
          hasRecentAttentionFlag: Boolean(recentAlertObs),
          lastMeasurementAt: latestObs?.observedAt || null,
        };
      })
    );

    return patientsData.filter(Boolean);
  },
});

// =========================================================================
// MUTATIONS
// =========================================================================

/**
 * Ensures condition catalog and measurement definitions are initialized.
 */
export const initChronicCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let conditionsInserted = 0;
    let measurementsInserted = 0;

    for (const c of DEFAULT_CONDITIONS) {
      const existing = await ctx.db
        .query("conditionCatalog")
        .withIndex("by_code", (q: any) => q.eq("code", c.code))
        .first();

      if (!existing) {
        await ctx.db.insert("conditionCatalog", {
          code: c.code,
          label: c.label,
          labelAr: c.labelAr,
          category: c.category,
          description: c.description,
          defaultMeasurementCodes: c.defaultMeasurementCodes,
          active: true,
          createdAt: now,
        });
        conditionsInserted++;
      }
    }

    for (const m of DEFAULT_MEASUREMENTS) {
      const existing = await ctx.db
        .query("measurementDefinitions")
        .withIndex("by_code", (q: any) => q.eq("code", m.code))
        .first();

      if (!existing) {
        await ctx.db.insert("measurementDefinitions", {
          code: m.code,
          name: m.name,
          nameAr: m.nameAr,
          category: m.category,
          unit: m.unit,
          isPaired: m.isPaired,
          minPlausible: m.minPlausible,
          maxPlausible: m.maxPlausible,
          active: true,
          createdAt: now,
        });
        measurementsInserted++;
      }
    }

    return { success: true, conditionsInserted, measurementsInserted };
  },
});

/**
 * Records a new health observation (Patient self-measurement or Professional recording).
 * Enforces plausibility validation (rejects physically impossible values).
 * Triggers non-alarmist attention alerts according to configured monitoring rules.
 */
export const recordObservation = mutation({
  args: {
    patientId: v.optional(v.id("users")),
    monitoringProgramId: v.optional(v.id("monitoringPrograms")),
    programId: v.optional(v.id("monitoringPrograms")),
    measurementCode: v.string(), // "bp", "pulse", "glucose", "temperature", "weight", "spo2", "pain_score", or aliases
    numericValue: v.optional(v.number()),
    secondaryNumericValue: v.optional(v.number()), // diastolic for BP
    textValue: v.optional(v.string()),
    unit: v.optional(v.string()),
    observedAt: v.optional(v.number()), // defaults to Date.now()
    context: v.optional(v.string()), // "a_jeun", "apres_repas", "au_repos", "apres_effort", "resting", "fasting"
    notes: v.optional(v.string()),
    clinicalNotes: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    const isSelf = targetPatientId === userId;
    const code = normalizeMeasurementCode(args.measurementCode);
    const progId = args.monitoringProgramId || args.programId;
    const finalNotes = (args.clinicalNotes || args.notes || "").trim() || undefined;

    let recordedByRole = "patient";
    let defaultSource: "patient_manual" | "professional_manual" = "patient_manual";

    if (!isSelf) {
      if (user.role === ROLES.PROFESSIONNEL) {
        const hasCare = await verifyCareRelationship(ctx, userId, targetPatientId);
        if (!hasCare) {
          throw new Error("Relation de soin non confirmée avec ce patient");
        }
        recordedByRole = "professionnel";
        defaultSource = "professional_manual";
      } else {
        // Circle member check
        const membership = await ctx.db
          .query("circleMembers")
          .withIndex("by_patient_and_member", (q: any) =>
            q.eq("patientId", targetPatientId).eq("memberUserId", userId)
          )
          .first();

        if (!membership || membership.status !== "active") {
          throw new Error("Non autorisé à enregistrer une mesure pour ce proche");
        }
        recordedByRole = "circle_member";
        defaultSource = "patient_manual";
      }
    }

    const finalSource = (args.source as any) || defaultSource;

    // Measurement plausibility bounds check
    const def = await ctx.db
      .query("measurementDefinitions")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();

    const unit = args.unit || def?.unit || "";

    if (def && typeof args.numericValue === "number") {
      if (def.minPlausible !== undefined && args.numericValue < def.minPlausible) {
        throw new Error(
          `Valeur invraisemblable : ${args.numericValue} ${unit}. Minimum physiologique acceptable : ${def.minPlausible}`
        );
      }
      if (def.maxPlausible !== undefined && args.numericValue > def.maxPlausible) {
        throw new Error(
          `Valeur invraisemblable : ${args.numericValue} ${unit}. Maximum physiologique acceptable : ${def.maxPlausible}`
        );
      }
    }

    // Configured Attention Rule check (Non-alarmist)
    let attentionFlag = false;
    let attentionSeverity: "info" | "warning" | undefined = undefined;
    let attentionMessage: string | null = null;

    if (typeof args.numericValue === "number") {
      // Query validated clinical rules configured in the platform
      const activeRules = await ctx.db
        .query("monitoringRules")
        .withIndex("by_measurement", (q: any) => q.eq("measurementCode", code))
        .filter((q: any) => q.eq(q.field("enabled"), true))
        .collect();

      // Program-specific rule takes precedence over general rule
      const applicableRule = activeRules.find((r) => r.monitoringProgramId && r.monitoringProgramId === progId)
        || activeRules.find((r) => !r.monitoringProgramId);

      // STRICT CLINICAL RULE GOVERNANCE (Module 10 Preflight B):
      // No validated rule configured in monitoringRules => NO clinical attention conclusion.
      // Arbitrary developer fallbacks are strictly prohibited.
      if (applicableRule) {
        const val = args.numericValue;
        const secVal = args.secondaryNumericValue;

        const isOutOfUpper = applicableRule.upperBound !== undefined && val >= applicableRule.upperBound;
        const isOutOfLower = applicableRule.lowerBound !== undefined && val <= applicableRule.lowerBound;
        const isOutOfSecUpper = secVal !== undefined && applicableRule.secondaryUpperBound !== undefined && secVal >= applicableRule.secondaryUpperBound;
        const isOutOfSecLower = secVal !== undefined && applicableRule.secondaryLowerBound !== undefined && secVal <= applicableRule.secondaryLowerBound;

        if (isOutOfUpper || isOutOfLower || isOutOfSecUpper || isOutOfSecLower) {
          attentionFlag = true;
          attentionSeverity = applicableRule.severity;
          attentionMessage = applicableRule.messageFr;
        }
      }
    }

    const now = Date.now();
    const observedAt = args.observedAt || now;

    const observationId = await ctx.db.insert("healthObservations", {
      patientId: targetPatientId,
      monitoringProgramId: progId,
      measurementCode: code,
      numericValue: args.numericValue,
      secondaryNumericValue: args.secondaryNumericValue,
      textValue: args.textValue?.trim(),
      unit,
      observedAt,
      recordedAt: now,
      recordedByUserId: userId,
      recordedByRole,
      source: finalSource,
      context: args.context,
      notes: finalNotes,
      attentionFlag,
      attentionSeverity,
      createdAt: now,
    });

    // Log audit
    await logMonitoringAudit(ctx, {
      patientId: targetPatientId,
      actorUserId: userId,
      action: "OBSERVATION_RECORDED",
      metadata: {
        measurementCode: code,
        attentionFlag,
        source: finalSource,
      },
    });

    // If an attention rule fired, send a calm, non-alarmist notification
    if (attentionFlag) {
      await createServerNotification(ctx, {
        userId: targetPatientId,
        title: "Suivi de santé — Mesure enregistrée",
        message: "Cette mesure récente mérite d'être signalée lors de votre prochain échange avec votre soignant traitant.",
        type: "info",
        link: "/dashboard?tab=chronic",
      });
    }

    return {
      observationId,
      success: true,
      attentionFlag: attentionFlag
        ? {
            severity: attentionSeverity || "info",
            message: "Cette mesure mérite l'attention de votre professionnel de santé.",
          }
        : null,
    };
  },
});

/**
 * Creates a monitoring program for a patient.
 */
export const createMonitoringProgram = mutation({
  args: {
    patientId: v.optional(v.id("users")),
    conditionCode: v.optional(v.string()),
    conditionId: v.optional(v.id("conditionCatalog")),
    title: v.string(),
    description: v.optional(v.string()),
    programType: v.optional(
      v.union(
        v.literal("clinical_followup"),
        v.literal("self_monitoring"),
        v.literal("post_operative"),
        v.literal("temporary_rehab")
      )
    ),
    measurementCodes: v.optional(v.array(v.string())),
    requiredMeasurementCodes: v.optional(v.array(v.string())),
    expectedFrequency: v.optional(v.string()), // "daily", "twice_daily", "weekly", "as_needed"
    frequency: v.optional(v.string()),
    startDate: v.optional(v.string()), // "YYYY-MM-DD"
    endDate: v.optional(v.string()),
    expectedEndAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    shareWithCircle: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const targetPatientId = args.patientId || userId;
    const isSelf = targetPatientId === userId;

    let responsibleProviderId: Id<"providers"> | undefined;
    let responsibleUserId: Id<"users"> | undefined;

    if (!isSelf) {
      if (user.role === ROLES.PROFESSIONNEL) {
        const hasCare = await verifyCareRelationship(ctx, userId, targetPatientId);
        if (!hasCare) {
          throw new Error("Relation de soin non confirmée avec ce patient");
        }
        const provider = (await ctx.db
          .query("providers")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first()) as Doc<"providers"> | null;

        responsibleProviderId = provider?._id;
        responsibleUserId = userId;
      } else {
        throw new Error("Seul un soignant ou le patient lui-même peut initier un programme de suivi");
      }
    }

    const now = Date.now();
    const codes = args.requiredMeasurementCodes || args.measurementCodes || ["bp"];
    const normalizedCodes = codes.map(normalizeMeasurementCode);
    const freq = args.frequency || args.expectedFrequency || "daily";
    const type = args.programType || (user.role === ROLES.PROFESSIONNEL ? "clinical_followup" : "self_monitoring");
    const sDate = args.startDate || new Date().toISOString().slice(0, 10);
    const eDate = args.endDate || (args.expectedEndAt ? new Date(args.expectedEndAt).toISOString().slice(0, 10) : undefined);
    const finalNotes = (args.description || args.notes || "").trim() || undefined;

    let codeCond = args.conditionCode;
    if (args.conditionId) {
      const condDoc = await ctx.db.get(args.conditionId);
      if (condDoc) codeCond = condDoc.code;
    }

    const programId = await ctx.db.insert("monitoringPrograms", {
      patientId: targetPatientId,
      conditionCode: codeCond,
      title: args.title.trim(),
      programType: type,
      measurementCodes: normalizedCodes,
      expectedFrequency: freq,
      status: "active",
      responsibleProviderId,
      responsibleUserId,
      startDate: sDate,
      endDate: eDate,
      notes: finalNotes,
      shareWithCircle: args.shareWithCircle ?? true,
      createdAt: now,
      updatedAt: now,
    });

    await logMonitoringAudit(ctx, {
      patientId: targetPatientId,
      actorUserId: userId,
      action: "PROGRAM_CREATED",
      metadata: { programId, title: args.title },
    });

    // Notify patient if created by professional
    if (!isSelf) {
      await createServerNotification(ctx, {
        userId: targetPatientId,
        title: "Nouveau protocole de suivi",
        message: `Votre soignant a activé le suivi "${args.title}" dans votre espace santé.`,
        type: "info",
        link: "/dashboard?tab=chronic",
      });
    }

    return { programId, success: true };
  },
});

/**
 * Assigns or confirms a condition for a patient.
 */
export const assignPatientCondition = mutation({
  args: {
    patientId: v.id("users"),
    conditionCode: v.string(),
    type: v.union(v.literal("clinical_confirmed"), v.literal("self_monitoring")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const isSelf = args.patientId === userId;

    if (!isSelf && user.role !== ROLES.PROFESSIONNEL) {
      throw new Error("Non autorisé à déclarer une condition médicale pour ce patient");
    }

    // Resolve condition name
    const catalogItem = await ctx.db
      .query("conditionCatalog")
      .withIndex("by_code", (q: any) => q.eq("code", args.conditionCode))
      .first();

    const conditionName = catalogItem?.label || args.conditionCode;
    const now = Date.now();

    const conditionId = await ctx.db.insert("patientConditions", {
      patientId: args.patientId,
      conditionCode: args.conditionCode,
      conditionName,
      type: user.role === ROLES.PROFESSIONNEL ? "clinical_confirmed" : "self_monitoring",
      status: "active",
      diagnosedAt: user.role === ROLES.PROFESSIONNEL ? now : undefined,
      confirmedByUserId: user.role === ROLES.PROFESSIONNEL ? userId : undefined,
      notes: args.notes?.trim(),
      createdAt: now,
      updatedAt: now,
    });

    await logMonitoringAudit(ctx, {
      patientId: args.patientId,
      actorUserId: userId,
      action: "CONDITION_ASSIGNED",
      metadata: { conditionCode: args.conditionCode, type: args.type },
    });

    return { conditionId, success: true };
  },
});

/**
 * Updates status of a monitoring program (active, paused, completed, cancelled).
 * Preserves historical observations intact.
 */
export const updateProgramStatus = mutation({
  args: {
    programId: v.id("monitoringPrograms"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Programme introuvable");

    const isPatient = program.patientId === userId;
    const isResponsible = program.responsibleUserId === userId;

    if (!isPatient && !isResponsible && user.role !== ROLES.ADMIN) {
      throw new Error("Non autorisé à modifier ce programme de surveillance");
    }

    const now = Date.now();
    await ctx.db.patch(args.programId, {
      status: args.status,
      updatedAt: now,
    });

    await logMonitoringAudit(ctx, {
      patientId: program.patientId,
      actorUserId: userId,
      action: "PROGRAM_STATUS_UPDATED",
      metadata: { status: args.status },
    });

    return { success: true };
  },
});

/**
 * Safe correction of an entered observation (with audit trail and mandatory reason).
 * Does not allow modifying HomeLab observations (which follow HomeLab amendment lifecycle).
 */
export const correctObservation = mutation({
  args: {
    observationId: v.id("healthObservations"),
    correctedNumericValue: v.optional(v.number()),
    correctedSecondaryValue: v.optional(v.number()),
    correctionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const obs = await ctx.db.get(args.observationId);
    if (!obs) throw new Error("Mesure introuvable");

    if (obs.source === "homelab") {
      throw new Error("Les résultats de laboratoire ne peuvent être corrigés que par le laboratoire partenaire agréé");
    }

    if (obs.patientId !== userId && obs.recordedByUserId !== userId) {
      throw new Error("Non autorisé à rectifier cette mesure");
    }

    if (args.correctionReason.trim().length < 5) {
      throw new Error("Veuillez motiver la rectification de la mesure");
    }

    const now = Date.now();
    await ctx.db.patch(args.observationId, {
      numericValue: args.correctedNumericValue,
      secondaryNumericValue: args.correctedSecondaryValue,
      isCorrected: true,
      correctionReason: args.correctionReason.trim(),
    });

    await logMonitoringAudit(ctx, {
      patientId: obs.patientId,
      actorUserId: userId,
      action: "OBSERVATION_CORRECTED",
      metadata: { reason: args.correctionReason },
    });

    return { success: true };
  },
});

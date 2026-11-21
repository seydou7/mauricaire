import { Doc, Id } from "./_generated/dataModel";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import { AssistantPlan, AssistantPlanStep } from "./assistantPlanner";

export interface ExecutionResult {
  status: "EXECUTE_DIRECT" | "NEED_CONFIRMATION" | "NEEDS_CLARIFICATION" | "COMPLETED" | "DENIED";
  responseMessage: string;
  actionPreview: any | null;
  actionPayload: any | null;
  executedTools: string[];
}

// Helpers dates
function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTomorrowDateString(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Vérifie l'existence d'une relation de soin légitime (consultation confirmée ou terminée)
 */
async function verifyCareRelationship(
  ctx: any,
  professionalUserId: Id<"users">,
  patientId: Id<"users">
): Promise<boolean> {
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

/**
 * Exécuteur d'outils et compositeur de réponses ancrées
 */
export async function executeAssistantPlan(
  ctx: any,
  plan: AssistantPlan,
  userId: Id<"users">,
  user: Doc<"users">,
  lang: string = "fr"
): Promise<ExecutionResult> {
  const userRole = user.role || ROLES.PATIENT;
  const executedTools: string[] = [];

  // Cas 1 : Bloqué par les règles de sécurité
  if (plan.type === "BLOCKED") {
    return {
      status: "COMPLETED",
      responseMessage:
        lang === "ar"
          ? plan.clarificationPromptAr || "طلب محظور وفقاً لسياسات الأمان."
          : plan.clarificationPromptFr || "Cette commande ne peut pas être traitée en raison des règles de sécurité.",
      actionPreview: null,
      actionPayload: null,
      executedTools: [],
    };
  }

  // Cas 2 : Réponse documentaire issue de la base de connaissances
  if (plan.type === "KNOWLEDGE" && plan.knowledgeAnswer) {
    return {
      status: "COMPLETED",
      responseMessage: plan.knowledgeAnswer,
      actionPreview: null,
      actionPayload: null,
      executedTools: ["knowledge_base"],
    };
  }

  // Cas 3 : Clarification requise
  if (plan.type === "CLARIFICATION") {
    return {
      status: "NEEDS_CLARIFICATION",
      responseMessage:
        lang === "ar"
          ? plan.clarificationPromptAr || "يرجى توضيح طلبكم."
          : plan.clarificationPromptFr || "Pouvez-vous préciser votre demande ?",
      actionPreview: null,
      actionPayload: null,
      executedTools: [],
    };
  }

  // Cas 4 : Navigation directe
  if (plan.type === "FAST_PATH" && plan.fastPathIntent === "NAVIGATE_TAB") {
    const targetSection = plan.steps[0]?.parameters?.section || "planning";
    return {
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
    };
  }

  // Protection contre les boucles d'appels d'outils (Max 5 étapes)
  const MAX_STEPS = 5;
  const stepsToRun = plan.steps.slice(0, MAX_STEPS);

  // Exécution séquentielle ou multi-outils
  const intermediateData: any = {};

  for (const step of stepsToRun) {
    executedTools.push(step.capabilityName);

    // OUTIL 1 : Recherche de soignants disponibles
    if (step.capabilityName === "find_available_providers") {
      const allVerified = await ctx.db
        .query("providers")
        .withIndex("by_verified", (q: any) => q.eq("verified", true))
        .collect();

      let available = allVerified.filter(
        (p: any) =>
          (p.onboardingStatus === "approved" ||
            p.verificationStatus === "approved" ||
            p.verified === true) &&
          p.deactivated !== true &&
          p.isPublic !== false &&
          (p.availabilityStatus === "available" || p.available === true)
      );

      // Filtre spécialité
      if (step.parameters.specialty) {
        available = available.filter((p: any) => p.specialty === step.parameters.specialty);
      }

      // Filtre zone
      if (step.parameters.zone) {
        const targetZone = step.parameters.zone.toLowerCase().replace(/[-_]/g, " ").trim();
        available = available.filter((p: any) => {
          if (!p.interventionZones || p.interventionZones.length === 0) return true;
          return p.interventionZones.some((z: string) => {
            const zNorm = z.toLowerCase().replace(/[-_]/g, " ").trim();
            return zNorm === targetZone || zNorm.includes(targetZone) || targetZone.includes(zNorm);
          });
        });
      }

      // Récupération des informations utilisateurs liées
      const enriched = [];
      for (const p of available.slice(0, 5)) {
        const u = await ctx.db.get(p.userId);
        enriched.push({
          providerId: p._id,
          name: u?.name || `Praticien (${p.specialty})`,
          specialty: p.specialty,
          city: p.city || "Nouakchott",
          consultationFee: p.consultationFee,
          rating: p.rating || 4.8,
        });
      }

      intermediateData.providers = enriched;
      intermediateData.totalFound = available.length;
    }

    // OUTIL 2 : Consultation de mes rendez-vous
    else if (step.capabilityName === "get_my_appointments") {
      const todayStr = getTodayDateString();
      const tomorrowStr = getTomorrowDateString();
      const targetDate =
        step.parameters.date === "tomorrow"
          ? tomorrowStr
          : step.parameters.date === "today"
          ? todayStr
          : undefined;

      if (userRole === ROLES.PROFESSIONNEL) {
        const provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first();

        if (!provider) {
          intermediateData.appointmentsError = "provider_not_found";
          continue;
        }

        const appts = await ctx.db
          .query("appointments")
          .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
          .collect();

        let filtered = appts.filter(
          (a: any) => a.status !== APPOINTMENT_STATUS.CANCELLED
        );
        if (targetDate) {
          filtered = filtered.filter((a: any) => a.date === targetDate);
        } else {
          filtered = filtered.filter((a: any) => a.date >= todayStr);
        }
        if (step.parameters.status) {
          filtered = filtered.filter((a: any) => a.status === step.parameters.status);
        }
        filtered.sort((a: any, b: any) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

        const enrichedAppts = [];
        for (const a of filtered) {
          const patientUser = await ctx.db.get(a.patientId);
          enrichedAppts.push({
            id: a._id,
            patientId: a.patientId,
            patientName: patientUser?.name || "Patient",
            date: a.date,
            time: a.time,
            service: a.serviceType || a.serviceSnapshot?.name || "Consultation",
            status: a.status,
          });
        }

        intermediateData.appointments = enrichedAppts;
      } else {
        // Patient
        const appts = await ctx.db
          .query("appointments")
          .withIndex("by_patient", (q: any) => q.eq("patientId", userId))
          .collect();

        let filtered = appts.filter((a: any) => a.status !== APPOINTMENT_STATUS.CANCELLED);
        if (targetDate) {
          filtered = filtered.filter((a: any) => a.date === targetDate);
        } else {
          filtered = filtered.filter((a: any) => a.date >= todayStr);
        }
        filtered.sort((a: any, b: any) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

        const enrichedAppts = [];
        for (const a of filtered) {
          const prov = await ctx.db.get(a.providerId);
          const provUser = prov ? await ctx.db.get(prov.userId) : null;
          enrichedAppts.push({
            id: a._id,
            providerName: provUser?.name || "Soignant",
            date: a.date,
            time: a.time,
            service: a.serviceType || "Soin",
            status: a.status,
          });
        }

        intermediateData.appointments = enrichedAppts;
      }
    }

    // OUTIL 3 : Demandes en attente du Professionnel
    else if (step.capabilityName === "get_pending_appointment_requests") {
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!provider) {
        intermediateData.appointmentsError = "provider_not_found";
        continue;
      }

      const todayStr = getTodayDateString();
      const tomorrowStr = getTomorrowDateString();
      const targetDate =
        step.parameters.date === "tomorrow"
          ? tomorrowStr
          : step.parameters.date === "today"
          ? todayStr
          : undefined;

      const appts = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
        .collect();

      let pending = appts.filter((a: any) => a.status === APPOINTMENT_STATUS.PENDING);
      if (targetDate) {
        pending = pending.filter((a: any) => a.date === targetDate);
      } else {
        pending = pending.filter((a: any) => a.date >= todayStr);
      }
      pending.sort((a: any, b: any) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

      const enriched = [];
      for (const a of pending) {
        const patient = await ctx.db.get(a.patientId);
        enriched.push({
          id: a._id,
          patientName: patient?.name || "Patient",
          date: a.date,
          time: a.time,
          service: a.serviceType || "Consultation",
        });
      }

      intermediateData.pendingRequests = enriched;
    }

    // OUTIL 4 : Mes patients suivis (Professionnel)
    else if (step.capabilityName === "get_my_patients") {
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!provider) {
        intermediateData.patientsError = "provider_not_found";
        continue;
      }

      const appts = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
        .collect();

      const validAppts = appts.filter(
        (a: any) =>
          a.status === APPOINTMENT_STATUS.CONFIRMED ||
          a.status === APPOINTMENT_STATUS.COMPLETED
      );

      const patientIdSet = new Set<string>();
      validAppts.forEach((a: any) => patientIdSet.add(String(a.patientId)));

      const patientList = [];
      for (const pId of patientIdSet) {
        const pUser = await ctx.db.get(pId as Id<"users">);
        if (pUser) {
          const obsCount = (
            await ctx.db
              .query("healthObservations")
              .withIndex("by_patient", (q: any) => q.eq("patientId", pUser._id))
              .collect()
          ).length;

          if (!step.parameters.withChronicOnly || obsCount > 0) {
            patientList.push({
              id: pUser._id,
              name: pUser.name,
              observationsCount: obsCount,
            });
          }
        }
      }

      intermediateData.patients = patientList;
    }

    // OUTIL 5 : Résumé clinique / multi-outils
    else if (step.capabilityName === "get_patient_care_summary") {
      // Si multi-outils : vérifier les patients issus des rendez-vous de demain
      if (step.parameters.checkAllUpcomingPatients && intermediateData.appointments) {
        const summaryResults = [];
        for (const appt of intermediateData.appointments) {
          const hasRel = await verifyCareRelationship(ctx, userId, appt.patientId);
          const obs = await ctx.db
            .query("healthObservations")
            .withIndex("by_patient", (q: any) => q.eq("patientId", appt.patientId))
            .collect();

          summaryResults.push({
            patientName: appt.patientName,
            time: appt.time,
            hasLegitimateRelationship: hasRel,
            observationsCount: obs.length,
            recentCodes: obs.slice(-3).map((o: any) => o.measurementCode),
          });
        }
        intermediateData.multiPatientCareSummary = summaryResults;
      } else if (step.parameters.patientId) {
        // Accès ciblé à un patient particulier
        const targetPatientId = step.parameters.patientId as Id<"users">;
        const hasRel = await verifyCareRelationship(ctx, userId, targetPatientId);
        if (!hasRel && userRole === ROLES.PROFESSIONNEL) {
          return {
            status: "DENIED",
            responseMessage:
              lang === "ar"
                ? "عذراً، لا تملكون تصريحاً للاطلاع على هذا الملف الصحي نظراً لعدم وجود علاقة علاجية مؤكدة مع المريض."
                : "Accès refusé : vous ne disposez pas d'une relation de soins confirmée avec ce patient pour consulter son dossier.",
            actionPreview: null,
            actionPayload: null,
            executedTools,
          };
        }

        const obs = await ctx.db
          .query("healthObservations")
          .withIndex("by_patient", (q: any) => q.eq("patientId", targetPatientId))
          .collect();

        intermediateData.singlePatientCareSummary = {
          observationsCount: obs.length,
          observations: obs.slice(-5),
        };
      }
    }

    // OUTIL 6 : Constantes du patient connecté
    else if (step.capabilityName === "get_my_health_observations") {
      const obs = await ctx.db
        .query("healthObservations")
        .withIndex("by_patient", (q: any) => q.eq("patientId", userId))
        .collect();

      obs.sort((a: any, b: any) => b.observedAt - a.observedAt);
      intermediateData.myObservations = obs.slice(0, 5);
    }

    // OUTIL 7 : Statut HomeLab
    else if (step.capabilityName === "get_homelab_status") {
      const reqs = await ctx.db
        .query("homeLabRequests")
        .withIndex("by_patient", (q: any) => q.eq("patientId", userId))
        .collect();

      reqs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      intermediateData.homeLabRequests = reqs.slice(0, 3);
    }

    // OUTIL 8 : Confirmation d'action sensible
    else if (step.capabilityName === "confirm_appointment") {
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!provider) {
        return {
          status: "EXECUTE_DIRECT",
          responseMessage: "Profil praticien introuvable.",
          actionPreview: null,
          actionPayload: null,
          executedTools,
        };
      }

      const pending = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
        .filter((q: any) => q.eq(q.field("status"), APPOINTMENT_STATUS.PENDING))
        .collect();

      pending.sort((a: any, b: any) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const targetAppt = pending[0];

      if (!targetAppt) {
        return {
          status: "EXECUTE_DIRECT",
          responseMessage:
            lang === "ar"
              ? "لا توجد أي طلبات مواعيد معلقة لتأكيدها حالياً."
              : "Vous n'avez aucune demande en attente à confirmer actuellement.",
          actionPreview: null,
          actionPayload: null,
          executedTools,
        };
      }

      const patient = await ctx.db.get(targetAppt.patientId);
      return {
        status: "NEED_CONFIRMATION",
        responseMessage:
          lang === "ar"
            ? `هل ترغبون في تأكيد موعد ${patient?.name || "المريض"} بتاريخ ${targetAppt.date} الساعة ${targetAppt.time} ؟`
            : `Confirmez-vous le rendez-vous de ${patient?.name || "Patient"} le ${targetAppt.date} à ${targetAppt.time} pour ${targetAppt.serviceType || "Consultation"} ?`,
        actionPreview: {
          type: "appointment_confirmation",
          appointmentId: targetAppt._id,
          patientName: patient?.name || "Patient",
          date: targetAppt.date,
          time: targetAppt.time,
          service: targetAppt.serviceType || "Consultation",
        },
        actionPayload: {
          type: "CONFIRM_APPOINTMENT",
          appointmentId: targetAppt._id,
        },
        executedTools,
      };
    }
  }

  // ==========================================================================
  // COMPOSITION DE LA RÉPONSE ANCRÉE
  // ==========================================================================

  // Cas A : Découverte de soignants
  if (intermediateData.providers !== undefined) {
    const list = intermediateData.providers;
    if (list.length === 0) {
      const msg =
        lang === "ar"
          ? "لم يتم العثور على أي ممارس صحي متاح حالياً يطابق هذه المعايير."
          : "Aucun soignant disponible ne correspond à ces critères actuellement dans l'annuaire.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    if (userRole === ROLES.PROFESSIONNEL) {
      // Pour les soignants : information collégiale et collaboration Relay
      const details = list
        .map((p: any) => `${p.name} (${p.specialty}, ${p.city})`)
        .join(", ");
      const msg =
        lang === "ar"
          ? `${list.length} من الزملاء متاحون حالياً في الدليل : ${details}. يمكنكم التواصل أو طلب استشارة عبر MauriCare Relay.`
          : `${list.length} soignant(s) sont actuellement disponibles dans le réseau : ${details}. Vous pouvez solliciter un confrère via MauriCare Relay.`;
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    } else {
      // Pour les patients / proches : présentation pour réservation
      const details = list
        .map((p: any) => `${p.name} (${p.specialty} à ${p.city} - ${p.consultationFee} MRU)`)
        .join("; ");
      const msg =
        lang === "ar"
          ? `يوجد ${list.length} ممارس صحي متاح حالياً : ${details}. هل ترغبون في حجز موعد مع أحدهم؟`
          : `${list.length} soignant(s) vérifié(s) sont actuellement disponibles : ${details}. Souhaitez-vous planifier un rendez-vous ?`;
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }
  }

  // Cas B : Multi-outils (Patients prévus demain avec suivi de constantes)
  if (intermediateData.multiPatientCareSummary !== undefined) {
    const sum = intermediateData.multiPatientCareSummary;
    if (sum.length === 0) {
      const msg =
        lang === "ar"
          ? "ليس لديكم أي مواعيد مبرمجة ليوم الغد."
          : "Vous n'avez aucun rendez-vous programmé pour demain.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    const tracked = sum.filter((p: any) => p.observationsCount > 0);
    const details = sum
      .map(
        (p: any) =>
          `${p.patientName} à ${p.time} (${p.observationsCount > 0 ? `${p.observationsCount} constante(s) enregistrée(s)` : "aucune constante"})`
      )
      .join(", ");

    const msg =
      lang === "ar"
        ? `لديكم ${sum.length} مريض غداً (${details}). ${tracked.length} لديهم مؤشرات حيوية مسجلة.`
        : `Demain, vous avez ${sum.length} consultation(s) : ${details}. ${tracked.length > 0 ? `${tracked.length} patient(s) ont un suivi de constantes actif.` : "Aucune constante enregistrée pour l'instant."}`;

    return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
  }

  // Cas C : Rendez-vous du professionnel ou patient
  if (intermediateData.appointments !== undefined) {
    const list = intermediateData.appointments;
    if (list.length === 0) {
      const msg =
        lang === "ar"
          ? "ليس لديكم أي مواعيد قادمة مسجلة حالياً."
          : "Vous n'avez aucun rendez-vous programmé pour le moment.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    const details = list
      .slice(0, 4)
      .map((a: any) =>
        userRole === ROLES.PROFESSIONNEL
          ? `${a.date} à ${a.time} avec ${a.patientName} (${a.service} - ${a.status})`
          : `${a.date} à ${a.time} avec ${a.providerName} (${a.service})`
      )
      .join(" ; ");

    const msg =
      lang === "ar"
        ? `لديكم ${list.length} موعد(مواعيد) : ${details}.`
        : `Vous avez ${list.length} rendez-vous : ${details}.`;

    return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
  }

  // Cas D : Demandes en attente
  if (intermediateData.pendingRequests !== undefined) {
    const list = intermediateData.pendingRequests;
    if (list.length === 0) {
      const msg =
        lang === "ar"
          ? "لا توجد لديكم أي طلبات مواعيد معلقة في الانتظار."
          : "Vous n'avez aucune demande de rendez-vous en attente pour le moment.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    const details = list
      .map((a: any) => `le ${a.date} à ${a.time} pour ${a.patientName} (${a.service})`)
      .join(" ; ");

    const msg =
      lang === "ar"
        ? `لديكم ${list.length} طلب(طلبات) معلقة : ${details}. هل ترغبون في تأكيد أحدها؟`
        : `Vous avez ${list.length} demande(s) en attente : ${details}. Vous pouvez me demander de confirmer l'une d'entre elles.`;

    return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
  }

  // Cas E : Mes patients suivis
  if (intermediateData.patients !== undefined) {
    const list = intermediateData.patients;
    if (list.length === 0) {
      const msg =
        lang === "ar"
          ? "لم يتم العثور على أي مريض في قائمة المتابعة السريرية الحالية."
          : "Vous n'avez pas encore de patients avec consultation validée dans votre dossier.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    const details = list
      .map((p: any) => `${p.name} (${p.observationsCount} constante(s))`)
      .join(", ");

    const msg =
      lang === "ar"
        ? `قائمة مرضاكم المتابعين تضم ${list.length} مريض : ${details}.`
        : `Vous suivez actuellement ${list.length} patient(s) : ${details}.`;

    return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
  }

  // Cas F : Mes constantes (Patient)
  if (intermediateData.myObservations !== undefined) {
    const list = intermediateData.myObservations;
    if (list.length === 0) {
      const msg =
        lang === "ar"
          ? "لم يتم تسجيل أي مؤشرات حيوية في حسابكم حتى الآن."
          : "Vous n'avez aucune constante vitale enregistrée pour l'instant.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    const details = list
      .map((o: any) => {
        if (o.measurementCode === "blood_pressure") {
          return `Tension ${o.numericValue}/${o.secondaryNumericValue || 80} mmHg`;
        }
        return `${o.measurementCode} : ${o.numericValue} ${o.unit || ""}`;
      })
      .join(", ");

    const msg =
      lang === "ar"
        ? `آخر القياسات المسجلة في ملفكم : ${details}.`
        : `Voici vos dernières constantes enregistrées : ${details}.`;

    return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
  }

  // Cas G : Suivi HomeLab
  if (intermediateData.homeLabRequests !== undefined) {
    const list = intermediateData.homeLabRequests;
    if (list.length === 0) {
      const msg =
        lang === "ar"
          ? "لا توجد لديكم أي طلبات تحاليل HomeLab جارية."
          : "Vous n'avez aucune demande HomeLab en cours.";
      return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
    }

    const latest = list[0];
    const msg =
      lang === "ar"
        ? `طلب التحليل المنزلي (${latest.sampleCode}) في حالة : ${latest.status}، بتاريخ : ${latest.scheduledDate}.`
        : `Votre demande HomeLab (${latest.sampleCode}) est actuellement au statut : ${latest.status}, prévue le ${latest.scheduledDate}.`;

    return { status: "EXECUTE_DIRECT", responseMessage: msg, actionPreview: null, actionPayload: null, executedTools };
  }

  // Cas par défaut
  return {
    status: "COMPLETED",
    responseMessage:
      lang === "ar"
        ? "تمت معالجة استفساركم بنجاح."
        : "Votre demande a été traitée.",
    actionPreview: null,
    actionPayload: null,
    executedTools,
  };
}

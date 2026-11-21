import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { APPOINTMENT_STATUS } from "./schema";
import { getIsoDayOfWeek, timeToMinutes, DEFAULT_WEEKLY_SCHEDULE } from "./availability";
import { createServerNotification } from "./notifications";
import {
  verifyCirclePermission,
  getOrCreateCircle,
  logCircleAuditEvent,
  notifyCircleMembers,
  CIRCLE_PERMISSIONS,
} from "./circle";
import { CANONICAL_SERVICES } from "./serviceCatalog";

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Calcule et vérifie la disponibilité de l'ensemble des occurrences demandées
 * pour un protocole de soins récurrents (Section 19).
 */
export const validateRecurringSeries = query({
  args: {
    providerId: v.id("providers"),
    serviceId: v.optional(v.id("providerServices")),
    rule: v.union(v.literal("daily"), v.literal("weekly"), v.literal("custom_weekdays")),
    weekdays: v.optional(v.array(v.number())), // 1=Lundi ... 7=Dimanche
    startDate: v.string(), // "YYYY-MM-DD"
    time: v.string(), // "HH:mm"
    totalOccurrences: v.number(), // max 14 pour daily, max 8 pour weekly
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    const provider = await ctx.db.get(args.providerId);
    if (!provider || !provider.available || !provider.verified) {
      return {
        total: 0,
        availableCount: 0,
        allAvailable: false,
        occurrences: [],
        error: "Soignant non disponible pour de nouvelles prises en charge récurrentes",
      };
    }

    let durationMinutes = 30;
    if (args.serviceId) {
      const s = await ctx.db.get(args.serviceId);
      if (s?.duration) durationMinutes = s.duration;
    }

    // Récupérer les données de planning du soignant
    const availabilityRecord = await ctx.db
      .query("providerAvailability")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();

    const weeklySchedule = availabilityRecord?.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE;
    const leaves = await ctx.db
      .query("providerLeaves")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();

    const exceptions = await ctx.db
      .query("providerExceptions")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();
    const exceptionMap = new Map(exceptions.map((e) => [e.date, e]));

    // Générer la liste des dates requises selon la règle
    const targetDates: string[] = [];
    const maxOccurrences = Math.min(Math.max(1, args.totalOccurrences), 20);

    if (args.rule === "daily") {
      for (let i = 0; i < maxOccurrences; i++) {
        targetDates.push(addDaysToDateStr(args.startDate, i));
      }
    } else if (args.rule === "weekly") {
      for (let i = 0; i < maxOccurrences; i++) {
        targetDates.push(addDaysToDateStr(args.startDate, i * 7));
      }
    } else if (args.rule === "custom_weekdays") {
      const selectedDays = (args.weekdays && args.weekdays.length > 0) ? args.weekdays : [1, 4];
      let cursorDate = args.startDate;
      let count = 0;
      let safetyCounter = 0;

      while (count < maxOccurrences && safetyCounter < 120) {
        safetyCounter++;
        const isoDay = getIsoDayOfWeek(cursorDate);
        if (selectedDays.includes(isoDay)) {
          targetDates.push(cursorDate);
          count++;
        }
        cursorDate = addDaysToDateStr(cursorDate, 1);
      }
    }

    // Vérifier chaque occurrence
    const slotStartMins = timeToMinutes(args.time);
    const slotEndMins = slotStartMins + durationMinutes;

    const occurrences: Array<{
      date: string;
      time: string;
      occurrenceIndex: number;
      available: boolean;
      conflictReason?: string;
    }> = [];

    for (let index = 0; index < targetDates.length; index++) {
      const date = targetDates[index];

      // 1. Congés
      const onLeave = leaves.find((l) => date >= l.startDate && date <= l.endDate);
      if (onLeave) {
        occurrences.push({
          date,
          time: args.time,
          occurrenceIndex: index + 1,
          available: false,
          conflictReason: `Soignant en congé (${onLeave.reason || "Indisponible"})`,
        });
        continue;
      }

      // 2. Exceptions
      const exc = exceptionMap.get(date);
      let operationalPeriods: Array<{ start: string; end: string }> = [];

      if (exc) {
        if (exc.isUnavailable) {
          occurrences.push({
            date,
            time: args.time,
            occurrenceIndex: index + 1,
            available: false,
            conflictReason: exc.reason || "Indisponible ce jour",
          });
          continue;
        }
        operationalPeriods = exc.periods || [];
      } else {
        const isoDay = getIsoDayOfWeek(date);
        const daySched = weeklySchedule.find((d) => d.dayOfWeek === isoDay);
        if (!daySched || !daySched.enabled) {
          occurrences.push({
            date,
            time: args.time,
            occurrenceIndex: index + 1,
            available: false,
            conflictReason: "Jour non ouvré pour ce praticien",
          });
          continue;
        }
        operationalPeriods = daySched.periods;
      }

      // 3. Dans les heures ouvrées
      const isWithinHours = operationalPeriods.some((p) => {
        const pStart = timeToMinutes(p.start);
        const pEnd = timeToMinutes(p.end);
        return slotStartMins >= pStart && slotEndMins <= pEnd;
      });

      if (!isWithinHours) {
        occurrences.push({
          date,
          time: args.time,
          occurrenceIndex: index + 1,
          available: false,
          conflictReason: "Hors des horaires de disponibilité habituels",
        });
        continue;
      }

      // 4. Conflit de rendez-vous existant (Soignant & Patient)
      const existingAppts = await ctx.db
        .query("appointments")
        .withIndex("by_provider_date", (q) =>
          q.eq("providerId", args.providerId).eq("date", date)
        )
        .collect();

      const hasProviderConflict = existingAppts.some((a) => {
        if (a.status !== APPOINTMENT_STATUS.PENDING && a.status !== APPOINTMENT_STATUS.CONFIRMED) {
          return false;
        }
        const aStart = timeToMinutes(a.time);
        const aEnd = aStart + (a.duration || 60);
        return slotStartMins < aEnd && slotEndMins > aStart;
      });

      let hasPatientConflict = false;
      if (currentUserId) {
        const existingPatientAppts = await ctx.db
          .query("appointments")
          .withIndex("by_patient_date", (q) =>
            q.eq("patientId", currentUserId).eq("date", date)
          )
          .collect();

        hasPatientConflict = existingPatientAppts.some((a) => {
          if (a.status !== APPOINTMENT_STATUS.PENDING && a.status !== APPOINTMENT_STATUS.CONFIRMED) {
            return false;
          }
          const aStart = timeToMinutes(a.time);
          const aEnd = aStart + (a.duration || 60);
          return slotStartMins < aEnd && slotEndMins > aStart;
        });
      }

      if (hasProviderConflict) {
        occurrences.push({
          date,
          time: args.time,
          occurrenceIndex: index + 1,
          available: false,
          conflictReason: "Soignant non disponible sur ce créneau",
        });
      } else if (hasPatientConflict) {
        occurrences.push({
          date,
          time: args.time,
          occurrenceIndex: index + 1,
          available: false,
          conflictReason: "Le patient a déjà un rendez-vous prévu sur ce créneau",
        });
      } else {
        occurrences.push({
          date,
          time: args.time,
          occurrenceIndex: index + 1,
          available: true,
        });
      }
    }

    const availableCount = occurrences.filter((o) => o.available).length;

    return {
      total: occurrences.length,
      availableCount,
      allAvailable: availableCount === occurrences.length,
      occurrences,
    };
  },
});

/**
 * Crée une série de soins récurrents et génère les rendez-vous individuels correspondants.
 */
export const createRecurringSeries = mutation({
  args: {
    providerId: v.id("providers"),
    serviceId: v.optional(v.id("providerServices")),
    rule: v.union(v.literal("daily"), v.literal("weekly"), v.literal("custom_weekdays")),
    weekdays: v.optional(v.array(v.number())),
    startDate: v.string(),
    time: v.string(),
    totalOccurrences: v.number(),
    address: v.string(),
    notes: v.optional(v.string()),
    allowPartial: v.optional(v.boolean()), // si true, réserve uniquement les dates sans conflit
    beneficiaryId: v.optional(v.id("users")), // Délégation de réservation (Module 5)
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise pour planifier des soins récurrents");
    }

    const caller = await ctx.db.get(userId);
    if (!caller) throw new Error("Profil utilisateur introuvable");

    const isDelegated = args.beneficiaryId && args.beneficiaryId !== userId;
    let targetPatientId = userId;
    let targetPatient = caller;

    if (isDelegated) {
      await verifyCirclePermission(
        ctx,
        userId,
        args.beneficiaryId!,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS
      );
      const ben = await ctx.db.get(args.beneficiaryId!);
      if (!ben) throw new Error("Patient bénéficiaire introuvable");
      targetPatientId = args.beneficiaryId!;
      targetPatient = ben;
    }

    const provider = await ctx.db.get(args.providerId);
    if (!provider || !provider.available || !provider.verified) {
      throw new Error("Ce soignant n'est pas disponible pour des soins récurrents");
    }

    // Récupérer le snapshot du service faisant autorité
    let serviceSnapshot: { name: string; price: number; duration: number } = {
      name: provider.specialty || "Soin récurrent à domicile",
      price: provider.consultationFee || 500,
      duration: 30,
    };

    if (args.serviceId) {
      const s = await ctx.db.get(args.serviceId);
      if (s) {
        serviceSnapshot = {
          name: s.customLabel || s.canonicalServiceId,
          price: s.price,
          duration: s.duration,
        };
      }
    }

    // Vérifier les occurrences
    const maxOccurrences = Math.min(Math.max(1, args.totalOccurrences), 20);
    const targetDates: string[] = [];

    if (args.rule === "daily") {
      for (let i = 0; i < maxOccurrences; i++) {
        targetDates.push(addDaysToDateStr(args.startDate, i));
      }
    } else if (args.rule === "weekly") {
      for (let i = 0; i < maxOccurrences; i++) {
        targetDates.push(addDaysToDateStr(args.startDate, i * 7));
      }
    } else if (args.rule === "custom_weekdays") {
      const selectedDays = (args.weekdays && args.weekdays.length > 0) ? args.weekdays : [1, 4];
      let cursorDate = args.startDate;
      let count = 0;
      let safety = 0;
      while (count < maxOccurrences && safety < 120) {
        safety++;
        if (selectedDays.includes(getIsoDayOfWeek(cursorDate))) {
          targetDates.push(cursorDate);
          count++;
        }
        cursorDate = addDaysToDateStr(cursorDate, 1);
      }
    }

    const slotStartMins = timeToMinutes(args.time);
    const slotEndMins = slotStartMins + serviceSnapshot.duration;

    const validDates: string[] = [];
    const conflictDates: string[] = [];

    for (const date of targetDates) {
      const existing = await ctx.db
        .query("appointments")
        .withIndex("by_provider_date", (q) =>
          q.eq("providerId", args.providerId).eq("date", date)
        )
        .collect();

      const providerConflict = existing.some((a) => {
        if (a.status !== APPOINTMENT_STATUS.PENDING && a.status !== APPOINTMENT_STATUS.CONFIRMED) {
          return false;
        }
        const aStart = timeToMinutes(a.time);
        const aEnd = aStart + (a.duration || 60);
        return slotStartMins < aEnd && slotEndMins > aStart;
      });

      const existingPatient = await ctx.db
        .query("appointments")
        .withIndex("by_patient_date", (q) =>
          q.eq("patientId", targetPatientId).eq("date", date)
        )
        .collect();

      const patientConflict = existingPatient.some((a) => {
        if (a.status !== APPOINTMENT_STATUS.PENDING && a.status !== APPOINTMENT_STATUS.CONFIRMED) {
          return false;
        }
        const aStart = timeToMinutes(a.time);
        const aEnd = aStart + (a.duration || 60);
        return slotStartMins < aEnd && slotEndMins > aStart;
      });

      if (providerConflict || patientConflict) {
        conflictDates.push(date);
      } else {
        validDates.push(date);
      }
    }

    if (conflictDates.length > 0 && !args.allowPartial) {
      throw new Error(
        `Conflit de planning sur ${conflictDates.length} séance(s) (${conflictDates.slice(0, 3).join(", ")}...). Veuillez choisir un autre horaire ou confirmer l'exclusion des séances en conflit.`
      );
    }

    if (validDates.length === 0) {
      throw new Error("Aucune séance disponible sur les dates demandées");
    }

    // 1. Créer la fiche série récurrente
    const seriesId = await ctx.db.insert("recurrenceSeries", {
      patientId: targetPatientId,
      providerId: args.providerId,
      serviceId: args.serviceId,
      serviceSnapshot,
      rule: args.rule,
      weekdays: args.weekdays,
      startDate: args.startDate,
      time: args.time,
      totalOccurrences: validDates.length,
      address: args.address.trim(),
      notes: args.notes?.trim() || undefined,
      status: "active",
      beneficiaryId: targetPatientId,
      bookedByUserId: userId,
      createdAt: Date.now(),
    });

    // 2. Insérer les rendez-vous individuels liés
    const createdAppointmentIds = [];
    for (let i = 0; i < validDates.length; i++) {
      const date = validDates[i];
      const apptId = await ctx.db.insert("appointments", {
        patientId: targetPatientId,
        providerId: args.providerId,
        serviceType: serviceSnapshot.name,
        serviceId: args.serviceId,
        serviceSnapshot,
        date,
        time: args.time,
        status: APPOINTMENT_STATUS.PENDING,
        paymentMethod: "cash",
        notes: args.notes?.trim() || undefined,
        address: args.address.trim(),
        duration: serviceSnapshot.duration,
        beneficiaryId: targetPatientId,
        bookedByUserId: userId,
        recurrenceSeriesId: seriesId,
        occurrenceIndex: i + 1,
      });
      createdAppointmentIds.push(apptId);
    }

    const patientDisplayName = targetPatient.name || "Un patient";
    const actorDisplayName = caller.name || caller.firstName || caller.email || "Un proche";

    if (isDelegated) {
      const circle = await getOrCreateCircle(ctx, targetPatientId);
      await logCircleAuditEvent(ctx, {
        circleId: circle._id,
        patientId: targetPatientId,
        actorUserId: userId,
        action: "delegated_booking_created",
        metadata: {
          seriesId,
          totalOccurrences: validDates.length,
          serviceName: serviceSnapshot.name,
          startDate: args.startDate,
        },
      });

      const canonicalSvc = CANONICAL_SERVICES.find(
        (s) => s.label.toLowerCase() === serviceSnapshot.name.toLowerCase() || s.id === serviceSnapshot.name
      );
      const serviceNameAr = canonicalSvc ? canonicalSvc.labelAr : serviceSnapshot.name;

      await createServerNotification(ctx, {
        userId: targetPatientId,
        title: "Série de soins réservée par votre proche",
        titleAr: "سلسلة رعاية برمجها قريبك",
        message: `${actorDisplayName} a planifié un protocole de ${validDates.length} séances (${serviceSnapshot.name}) débutant le ${args.startDate}.`,
        messageAr: `قام ${actorDisplayName} ببرمجة بروتوكول من ${validDates.length} جلسات (${serviceNameAr}) يبدأ في ${args.startDate}.`,
        type: "info",
        link: "/dashboard",
      });
    }

    const canonicalSvc = CANONICAL_SERVICES.find(
      (s) => s.label.toLowerCase() === serviceSnapshot.name.toLowerCase() || s.id === serviceSnapshot.name
    );
    const serviceNameAr = canonicalSvc ? canonicalSvc.labelAr : serviceSnapshot.name;

    // Notification au professionnel
    const delegatedNotice = isDelegated ? ` (réservé par son proche ${actorDisplayName})` : "";
    const delegatedNoticeAr = isDelegated ? ` (برمجه قريبه ${actorDisplayName})` : "";
    await createServerNotification(ctx, {
      userId: provider.userId,
      title: "Nouvelle série de soins récurrents",
      titleAr: "سلسلة رعاية دورية جديدة",
      message: `${patientDisplayName}${delegatedNotice} a programmé une série de ${validDates.length} séances (${serviceSnapshot.name}) à partir du ${args.startDate} à ${args.time}.`,
      messageAr: `${patientDisplayName}${delegatedNoticeAr} برمج سلسلة من ${validDates.length} جلسات (${serviceNameAr}) ابتداءً من ${args.startDate} في ${args.time}.`,
      type: "info",
      link: "/dashboard",
    });

    // Notification aux autres membres du Cercle
    await notifyCircleMembers(ctx, targetPatientId, {
      title: "Nouveau protocole récurrent programmé",
      message: `Une série de ${validDates.length} séances (${serviceSnapshot.name}) a été planifiée pour ${patientDisplayName}.`,
      type: "info",
      link: "/dashboard",
      excludedUserId: userId,
    });

    return {
      success: true,
      seriesId,
      createdCount: validDates.length,
      conflictCount: conflictDates.length,
      appointmentIds: createdAppointmentIds,
    };
  },
});

/**
 * Annule une séance d'une série de soins, soit isolément, soit pour l'ensemble des séances futures (Section 21).
 * Règle clinique stricte : ne réécrit jamais les consultations déjà terminées (statut 'termine').
 */
export const cancelRecurringAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    mode: v.union(v.literal("single"), v.literal("this_and_future")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Rendez-vous introuvable");

    const provider = await ctx.db.get(appointment.providerId);
    const isPatient = appointment.patientId === userId;
    const isProvider = provider?.userId === userId;

    let isCircleManager = false;
    if (!isPatient && !isProvider) {
      try {
        await verifyCirclePermission(
          ctx,
          userId,
          appointment.patientId,
          CIRCLE_PERMISSIONS.MANAGE_APPOINTMENTS
        );
        isCircleManager = true;
      } catch {
        isCircleManager = false;
      }
    }

    if (!isPatient && !isProvider && !isCircleManager) {
      throw new Error("Action non autorisée sur ce rendez-vous");
    }

    if (isCircleManager) {
      const circle = await getOrCreateCircle(ctx, appointment.patientId);
      await logCircleAuditEvent(ctx, {
        circleId: circle._id,
        patientId: appointment.patientId,
        actorUserId: userId,
        action: "delegated_appointment_cancelled",
        metadata: {
          appointmentId: args.appointmentId,
          mode: args.mode,
          reason: args.reason,
        },
      });

      const actor = await ctx.db.get(userId);
      const actorName = actor?.name || actor?.firstName || "Votre proche";
      await createServerNotification(ctx, {
        userId: appointment.patientId,
        title: "Séance(s) annulée(s) par votre proche",
        message: `${actorName} a annulé des séances d'un protocole récurrent (${args.reason || "Sans motif"}).`,
        type: "alert",
        link: "/dashboard",
      });
    }

    if (!appointment.recurrenceSeriesId) {
      // Si ce n'est pas une série, annulation simple
      await ctx.db.patch(args.appointmentId, {
        status: APPOINTMENT_STATUS.CANCELLED,
        cancellationReason: args.reason?.trim() || "Annulé par l'utilisateur",
      });
      return { success: true, cancelledCount: 1 };
    }

    const seriesId = appointment.recurrenceSeriesId;
    const currentOccurrence = appointment.occurrenceIndex || 1;

    if (args.mode === "single") {
      if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
        throw new Error("Impossible d'annuler une consultation déjà effectuée et clôturée");
      }
      await ctx.db.patch(args.appointmentId, {
        status: APPOINTMENT_STATUS.CANCELLED,
        cancellationReason: args.reason?.trim() || "Séance individuelle annulée",
      });
      return { success: true, cancelledCount: 1 };
    } else {
      // "this_and_future" : annuler cette séance et toutes les futures non encore terminées
      const seriesAppointments = await ctx.db
        .query("appointments")
        .withIndex("by_recurrence", (q) => q.eq("recurrenceSeriesId", seriesId))
        .collect();

      let cancelledCount = 0;
      for (const appt of seriesAppointments) {
        const occ = appt.occurrenceIndex || 0;
        if (
          occ >= currentOccurrence &&
          (appt.status === APPOINTMENT_STATUS.PENDING || appt.status === APPOINTMENT_STATUS.CONFIRMED)
        ) {
          await ctx.db.patch(appt._id, {
            status: APPOINTMENT_STATUS.CANCELLED,
            cancellationReason: args.reason?.trim() || "Série interrompue à partir de cette séance",
          });
          cancelledCount++;
        }
      }

      // Vérifier s'il reste des séances actives dans la série
      const remainingActive = await ctx.db
        .query("appointments")
        .withIndex("by_recurrence", (q) => q.eq("recurrenceSeriesId", seriesId))
        .collect();

      const hasActive = remainingActive.some(
        (a) => a.status === APPOINTMENT_STATUS.PENDING || a.status === APPOINTMENT_STATUS.CONFIRMED
      );

      if (!hasActive) {
        await ctx.db.patch(seriesId, { status: "cancelled" });
      }

      return { success: true, cancelledCount };
    }
  },
});

/**
 * Récupère les séries de soins récurrents du patient connecté.
 */
export const getPatientRecurringSeries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const series = await ctx.db
      .query("recurrenceSeries")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      series.map(async (s) => {
        const provider = await ctx.db.get(s.providerId);
        const providerUser = provider ? await ctx.db.get(provider.userId) : null;
        const appts = await ctx.db
          .query("appointments")
          .withIndex("by_recurrence", (q) => q.eq("recurrenceSeriesId", s._id))
          .collect();

        return {
          ...s,
          providerName: providerUser?.name || "Soignant MauriCare",
          providerSpecialty: provider?.specialty || "Soins à domicile",
          appointmentsCount: appts.length,
          completedCount: appts.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETED).length,
          pendingCount: appts.filter((a) => a.status === APPOINTMENT_STATUS.PENDING).length,
          confirmedCount: appts.filter((a) => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
          cancelledCount: appts.filter((a) => a.status === APPOINTMENT_STATUS.CANCELLED).length,
        };
      })
    );
  },
});

import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { auth } from "./auth";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import { parseAppointmentUtcTimestamp } from "./careRelationship";
import { createServerNotification } from "./notifications";
import { timeToMinutes } from "./availability";
import { isOperationalProfessional } from "./providers";
import {
  verifyCirclePermission,
  getOrCreateCircle,
  logCircleAuditEvent,
  notifyCircleMembers,
  CIRCLE_PERMISSIONS,
} from "./circle";
import { syncPatientVitalToChronic } from "./chronic";
import { CANONICAL_SERVICES } from "./serviceCatalog";

/**
 * Création d'un rendez-vous par un patient authentifié.
 * Règle de sécurité : patientId TOUJOURS résolu côté serveur via la session d'authentification.
 * Module 4 : Snapshot de tarif faisant autorité, vérification des congés/exceptions,
 * détection de collision stricte et validation des zones d'intervention.
 */
export const create = mutation({
  args: {
    providerId: v.id("providers"),
    serviceType: v.string(),
    serviceId: v.optional(v.id("providerServices")),
    date: v.string(),
    time: v.string(),
    address: v.string(),
    zone: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentMethod: v.literal("cash"),
    duration: v.optional(v.number()),
    beneficiaryId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise pour effectuer une réservation");
    }

    const caller = await ctx.db.get(userId);
    if (!caller) {
      throw new Error("Profil utilisateur introuvable");
    }

    // Gestion du bénéficiaire délégué (MauriCare Circle - Module 5)
    const isDelegated = args.beneficiaryId && args.beneficiaryId !== userId;
    let targetPatientId = userId;
    let targetPatient = caller;

    if (isDelegated) {
      // Vérification autoritaire de l'habilitation BOOK_APPOINTMENTS
      await verifyCirclePermission(
        ctx,
        userId,
        args.beneficiaryId!,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS
      );
      const beneficiary = await ctx.db.get(args.beneficiaryId!);
      if (!beneficiary) {
        throw new Error("Patient bénéficiaire introuvable");
      }
      targetPatientId = args.beneficiaryId!;
      targetPatient = beneficiary;
    } else {
      if (caller.role !== ROLES.PATIENT) {
        throw new Error("Seul un utilisateur avec le rôle patient peut réserver une consultation pour lui-même");
      }
    }

    const provider = await ctx.db.get(args.providerId);
    if (!provider) {
      throw new Error("Professionnel de santé introuvable");
    }

    if (!provider.verified) {
      throw new Error("Ce professionnel de santé n'est pas encore vérifié");
    }

    if (!provider.available) {
      throw new Error("Ce professionnel de santé n'est pas disponible pour de nouvelles réservations");
    }

    if (provider.userId === userId || provider.userId === targetPatientId) {
      throw new Error("Vous ne pouvez pas réserver de consultation avec vous-même");
    }

    // Gestion de l'adresse de prise en charge (Section 30)
    let cleanAddress = (args.address || "").trim();
    if (!cleanAddress && targetPatient.address) {
      cleanAddress = targetPatient.address.trim();
    }
    if (!cleanAddress && targetPatient.neighborhood) {
      cleanAddress = `${targetPatient.neighborhood}${targetPatient.city ? `, ${targetPatient.city}` : ""}`;
    }
    if (!args.date || !args.time || !cleanAddress) {
      throw new Error("La date, l'heure et l'adresse de prise en charge sont obligatoires");
    }

    // 1. Snapshot du service faisant autorité (Section 14)
    // Le praticien doit obligatoirement avoir configuré au moins une prestation active
    const activeProviderServices = await ctx.db
      .query("providerServices")
      .withIndex("by_provider_active", (q) =>
        q.eq("providerId", provider._id).eq("active", true)
      )
      .collect();

    if (activeProviderServices.length === 0) {
      throw new Error("Ce professionnel n'a pas encore configuré ses prestations de soins.");
    }

    let serviceSnapshot = {
      name: args.serviceType,
      price: provider.consultationFee || 0,
      duration: args.duration || 60,
    };

    if (args.serviceId) {
      const service = await ctx.db.get(args.serviceId);
      if (!service || service.providerId !== provider._id || !service.active) {
        throw new Error("La prestation sélectionnée n'est pas disponible auprès de ce praticien.");
      }
      serviceSnapshot = {
        name: service.customLabel || args.serviceType,
        price: service.price,
        duration: service.duration,
      };
    } else {
      throw new Error("Veuillez sélectionner une prestation de soins active proposée par ce praticien.");
    }

    // 1b. Vérifier que le soignant a configuré un planning hebdomadaire actif
    const availabilityRecord = await ctx.db
      .query("providerAvailability")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .first();

    const hasActiveSchedule =
      availabilityRecord?.weeklySchedule &&
      availabilityRecord.weeklySchedule.some(
        (d: any) => d.enabled && d.periods && d.periods.length > 0
      );

    if (!hasActiveSchedule) {
      throw new Error("Ce professionnel n'a pas encore configuré ses disponibilités.");
    }

    // 2. Vérification des congés du praticien (Section 8)
    const leaves = await ctx.db
      .query("providerLeaves")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();

    const onLeave = leaves.find(
      (l) => args.date >= l.startDate && args.date <= l.endDate
    );
    if (onLeave) {
      throw new Error(
        `Ce professionnel de santé est en congé du ${onLeave.startDate} au ${onLeave.endDate} (${onLeave.reason || "Indisponible"}).`
      );
    }

    // 3. Vérification des exceptions de date (Section 7)
    const exception = await ctx.db
      .query("providerExceptions")
      .withIndex("by_provider_date", (q) =>
        q.eq("providerId", args.providerId).eq("date", args.date)
      )
      .first();

    if (exception && exception.isUnavailable) {
      throw new Error(
        `Ce praticien est indisponible le ${args.date} (${exception.reason || "Jour non travaillé"}).`
      );
    }

    // 4. Détection transactionnelle de collision / chevauchement (Patient & Soignant)
    const slotStartMins = timeToMinutes(args.time);
    const duration = serviceSnapshot.duration;
    const slotEndMins = slotStartMins + duration;

    // 4a. Conflit patient / bénéficiaire : un patient ne peut avoir deux consultations simultanées
    const existingPatientAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_patient_date", (q) =>
        q.eq("patientId", targetPatientId).eq("date", args.date)
      )
      .collect();

    const hasPatientConflict = existingPatientAppointments.some((a) => {
      if (a.status !== APPOINTMENT_STATUS.PENDING && a.status !== APPOINTMENT_STATUS.CONFIRMED) {
        return false;
      }
      const aStart = timeToMinutes(a.time);
      const aEnd = aStart + (a.duration || 60);
      return slotStartMins < aEnd && slotEndMins > aStart;
    });

    if (hasPatientConflict) {
      throw new Error("Ce patient a déjà un rendez-vous sur ce créneau.");
    }

    // 4b. Conflit soignant : le professionnel ne peut être réservé deux fois sur le même créneau
    const existingProviderAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider_date", (q) =>
        q.eq("providerId", args.providerId).eq("date", args.date)
      )
      .collect();

    const hasProviderConflict = existingProviderAppointments.some((a) => {
      if (a.status !== APPOINTMENT_STATUS.PENDING && a.status !== APPOINTMENT_STATUS.CONFIRMED) {
        return false;
      }
      const aStart = timeToMinutes(a.time);
      const aEnd = aStart + (a.duration || 60);
      return slotStartMins < aEnd && slotEndMins > aStart;
    });

    if (hasProviderConflict) {
      throw new Error("Ce soignant n'est plus disponible sur ce créneau.");
    }

    // 5. Validation géographique de la zone d'intervention (Section 12)
    const normalizeZone = (z: string) => z.toLowerCase().replace(/[-_]/g, " ").trim();
    if (provider.interventionZones && provider.interventionZones.length > 0) {
      const allowedZonesNorm = provider.interventionZones.map(normalizeZone);

      if (args.zone) {
        const targetZoneNorm = normalizeZone(args.zone);
        const matches = allowedZonesNorm.some(
          (az) => az === targetZoneNorm || az.includes(targetZoneNorm) || targetZoneNorm.includes(az)
        );
        if (!matches) {
          throw new Error(
            `Ce praticien n'intervient que dans les zones suivantes : ${provider.interventionZones.join(", ")}.`
          );
        }
      } else {
        const lowerAddress = cleanAddress.toLowerCase();
        const normCleanAddress = normalizeZone(cleanAddress);
        const inAddress = provider.interventionZones.some((zone) => {
          const normZone = normalizeZone(zone);
          return lowerAddress.includes(zone.toLowerCase()) || normCleanAddress.includes(normZone);
        });

        if (!inAddress) {
          const userCity = (targetPatient.city || "").toLowerCase();
          const userNeigh = (targetPatient.neighborhood || "").toLowerCase();
          const inCityOrNeigh = provider.interventionZones.some((zone) => {
            const normZone = normalizeZone(zone);
            return (
              userCity.includes(zone.toLowerCase()) ||
              userNeigh.includes(zone.toLowerCase()) ||
              normalizeZone(userCity).includes(normZone) ||
              normalizeZone(userNeigh).includes(normZone)
            );
          });

          if (!inCityOrNeigh) {
            throw new Error(
              `Ce praticien n'intervient que dans les zones suivantes : ${provider.interventionZones.join(", ")}.`
            );
          }
        }
      }
    }

    const appointmentId = await ctx.db.insert("appointments", {
      patientId: targetPatientId,
      providerId: args.providerId,
      serviceType: serviceSnapshot.name,
      serviceId: args.serviceId,
      serviceSnapshot,
      date: args.date,
      time: args.time,
      status: APPOINTMENT_STATUS.PENDING,
      paymentMethod: args.paymentMethod,
      notes: args.notes,
      address: cleanAddress,
      zone: args.zone,
      duration: serviceSnapshot.duration,
      beneficiaryId: targetPatientId,
      bookedByUserId: userId,
    });

    const patientDisplayName = targetPatient.name || "Un patient";
    const actorDisplayName = caller.name || caller.firstName || caller.email || "Un proche";

    // En cas de réservation déléguée : journalisation d'audit & notification au bénéficiaire
    if (isDelegated) {
      const circle = await getOrCreateCircle(ctx, targetPatientId);
      await logCircleAuditEvent(ctx, {
        circleId: circle._id,
        patientId: targetPatientId,
        actorUserId: userId,
        action: "delegated_booking_created",
        metadata: {
          appointmentId,
          providerId: args.providerId,
          serviceName: serviceSnapshot.name,
          date: args.date,
          time: args.time,
        },
      });

      const canonicalSvc = CANONICAL_SERVICES.find(
        (s) => s.label.toLowerCase() === serviceSnapshot.name.toLowerCase() || s.id === serviceSnapshot.name
      );
      const serviceNameAr = canonicalSvc ? canonicalSvc.labelAr : serviceSnapshot.name;

      // Notification transactionnelle pour le patient bénéficiaire
      await createServerNotification(ctx, {
        userId: targetPatientId,
        title: "Nouvelle réservation par votre proche",
        titleAr: "حجز موعد جديد من قبل قريبك",
        message: `${actorDisplayName} a réservé une consultation (${serviceSnapshot.name}) pour vous le ${args.date} à ${args.time}.`,
        messageAr: `قام ${actorDisplayName} بحجز استشارة (${serviceNameAr}) لك ليوم ${args.date} في ${args.time}.`,
        type: "info",
        link: "/dashboard",
      });
    }

    const canonicalSvc = CANONICAL_SERVICES.find(
      (s) => s.label.toLowerCase() === serviceSnapshot.name.toLowerCase() || s.id === serviceSnapshot.name
    );
    const serviceNameAr = canonicalSvc ? canonicalSvc.labelAr : serviceSnapshot.name;

    // Notification transactionnelle pour le professionnel de santé
    const delegatedNotice = isDelegated ? ` (réservé par son proche ${actorDisplayName})` : "";
    const delegatedNoticeAr = isDelegated ? ` (حجزه قريبه ${actorDisplayName})` : "";
    await createServerNotification(ctx, {
      userId: provider.userId,
      title: "Nouvelle demande de rendez-vous",
      titleAr: "طلب موعد جديد",
      message: `${patientDisplayName}${delegatedNotice} a réservé une consultation (${serviceSnapshot.name}) pour le ${args.date} à ${args.time}.`,
      messageAr: `${patientDisplayName}${delegatedNoticeAr} حجز استشارة (${serviceNameAr}) ليوم ${args.date} في ${args.time}.`,
      type: "info",
      link: "/dashboard",
    });

    // Notification aux autres membres du Cercle ayant l'autorisation RECEIVE_APPOINTMENT_NOTIFICATIONS
    await notifyCircleMembers(ctx, targetPatientId, {
      title: "Nouveau rendez-vous planifié",
      message: `Un rendez-vous (${serviceSnapshot.name}) a été réservé pour ${patientDisplayName} le ${args.date} à ${args.time}.`,
      type: "info",
      link: "/dashboard",
      excludedUserId: userId,
    });

    return appointmentId;
  },
});

/**
 * Liste des rendez-vous du patient actuellement connecté.
 */
export const getPatientAppointments = query({
  args: {
    beneficiaryId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    let targetPatientId = userId;
    if (args.beneficiaryId && args.beneficiaryId !== userId) {
      await verifyCirclePermission(
        ctx,
        userId,
        args.beneficiaryId,
        CIRCLE_PERMISSIONS.VIEW_APPOINTMENTS
      );
      targetPatientId = args.beneficiaryId;
    }

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_patient", (q) => q.eq("patientId", targetPatientId))
      .order("desc")
      .collect();

    const joined = await Promise.all(
      appointments.map(async (appt) => {
        const provider = await ctx.db.get(appt.providerId);
        const providerUser = provider ? await ctx.db.get(provider.userId) : null;

        let bookedByName: string | undefined;
        if (appt.bookedByUserId && appt.bookedByUserId !== appt.patientId) {
          const booker = await ctx.db.get(appt.bookedByUserId);
          bookedByName = booker ? booker.name || booker.firstName || booker.email : undefined;
        }

        return {
          _id: appt._id,
          id: appt._id,
          providerId: appt.providerId,
          providerName: providerUser?.name || "Soignant MauriCare",
          name: providerUser?.name || "Soignant MauriCare",
          specialty: provider?.specialty || "Soins à domicile",
          image: providerUser?.image || "",
          phone: providerUser?.phone || "",
          consultationFee: appt.serviceSnapshot?.price ?? provider?.consultationFee ?? 0,
          servicePrice: appt.serviceSnapshot?.price ?? provider?.consultationFee ?? 0,
          serviceType: appt.serviceType || provider?.specialty || "Consultation",
          type: appt.serviceType || provider?.specialty || "Consultation",
          date: appt.date,
          time: appt.time,
          duration: appt.duration ? `${appt.duration}min` : "1h",
          address: appt.address || "Nouakchott",
          status: appt.status,
          notes: appt.notes || "",
          paymentMethod: appt.paymentMethod || "cash",
          cancellationReason: appt.cancellationReason,
          clinicalReport: appt.clinicalReport,
          serviceSnapshot: appt.serviceSnapshot,
          serviceId: appt.serviceId,
          recurrenceSeriesId: appt.recurrenceSeriesId,
          occurrenceIndex: appt.occurrenceIndex,
          beneficiaryId: appt.beneficiaryId,
          bookedByUserId: appt.bookedByUserId,
          bookedByName,
          _creationTime: appt._creationTime,
        };
      })
    );

    return joined;
  },
});

/**
 * Demandes en attente pour le professionnel de santé connecté.
 */
export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!isOperationalProfessional(provider)) {
      return [];
    }

    const requests = await ctx.db
      .query("appointments")
      .withIndex("by_provider_status", (q) =>
        q.eq("providerId", provider._id).eq("status", APPOINTMENT_STATUS.PENDING)
      )
      .order("desc")
      .collect();

    const joined = await Promise.all(
      requests.map(async (appt) => {
        const patientUser = await ctx.db.get(appt.patientId);

        return {
          _id: appt._id,
          id: appt._id,
          patientId: appt.patientId,
          patientName: patientUser?.name || "Patient",
          patientPhone: patientUser?.phone || "",
          patientEmail: patientUser?.email || "",
          patientImage: patientUser?.image || "",
          serviceType: appt.serviceType || "Consultation à domicile",
          type: appt.serviceType || "Consultation à domicile",
          date: appt.date,
          time: appt.time,
          duration: appt.duration ? `${appt.duration}min` : "45min",
          address: appt.address || patientUser?.city || "Nouakchott",
          notes: appt.notes || "",
          message: appt.notes || "Demande de prise en charge à domicile",
          status: appt.status,
          paymentMethod: appt.paymentMethod || "cash",
          servicePrice: appt.serviceSnapshot?.price,
          serviceSnapshot: appt.serviceSnapshot,
          serviceId: appt.serviceId,
          recurrenceSeriesId: appt.recurrenceSeriesId,
          occurrenceIndex: appt.occurrenceIndex,
          _creationTime: appt._creationTime,
        };
      })
    );

    return joined;
  },
});

/**
 * Planning/Agenda du professionnel de santé connecté (rendez-vous confirmés, terminés, etc.).
 */
export const getProviderSchedule = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!isOperationalProfessional(provider)) {
      return [];
    }

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
      .order("desc")
      .collect();

    const joined = await Promise.all(
      appointments.map(async (appt) => {
        const patientUser = await ctx.db.get(appt.patientId);

        let bookedByName: string | undefined;
        if (appt.bookedByUserId && appt.bookedByUserId !== appt.patientId) {
          const booker = await ctx.db.get(appt.bookedByUserId);
          bookedByName = booker ? booker.name || booker.firstName || booker.email : undefined;
        }

        return {
          _id: appt._id,
          id: appt._id,
          patientId: appt.patientId,
          patient: patientUser?.name || "Patient",
          name: patientUser?.name || "Patient",
          patientName: patientUser?.name || "Patient",
          patientPhone: patientUser?.phone || "",
          type: appt.serviceType || "Consultation",
          day: appt.date,
          date: appt.date,
          time: appt.time,
          duration: appt.duration ? `${appt.duration}min` : "1h",
          address: appt.address || "Nouakchott",
          status: appt.status,
          notes: appt.notes || "",
          clinicalReport: appt.clinicalReport,
          cancellationReason: appt.cancellationReason,
          servicePrice: appt.serviceSnapshot?.price,
          serviceSnapshot: appt.serviceSnapshot,
          serviceId: appt.serviceId,
          recurrenceSeriesId: appt.recurrenceSeriesId,
          occurrenceIndex: appt.occurrenceIndex,
          beneficiaryId: appt.beneficiaryId,
          bookedByUserId: appt.bookedByUserId,
          bookedByName,
          _creationTime: appt._creationTime,
        };
      })
    );

    return joined;
  },
});

/**
 * Acceptation d'un rendez-vous par le professionnel propriétaire.
 * Transition canonique : en_attente -> confirme
 */
export const accept = mutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Profil professionnel de santé introuvable");
    }

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Rendez-vous introuvable");
    }

    if (appointment.providerId !== provider._id) {
      throw new Error("Ce rendez-vous ne vous est pas assigné");
    }

    if (appointment.status !== APPOINTMENT_STATUS.PENDING) {
      throw new Error("Seul un rendez-vous en attente peut être accepté");
    }

    await ctx.db.patch(args.appointmentId, {
      status: APPOINTMENT_STATUS.CONFIRMED,
    });

    // Notification transactionnelle pour le patient
    await createServerNotification(ctx, {
      userId: appointment.patientId,
      title: "Rendez-vous confirmé",
      message: `Votre demande de consultation pour le ${appointment.date} à ${appointment.time} a été confirmée par votre soignant.`,
      type: "info",
      link: "/dashboard",
    });

    // Notification aux proches du Cercle ayant l'autorisation RECEIVE_APPOINTMENT_NOTIFICATIONS
    await notifyCircleMembers(ctx, appointment.patientId, {
      title: "Rendez-vous confirmé",
      message: `La consultation prévue le ${appointment.date} à ${appointment.time} a été confirmée par le praticien.`,
      type: "info",
      link: "/dashboard",
    });

    // Planification du rappel 24h avant le rendez-vous (si > 24h)
    try {
      const appointmentUtc = parseAppointmentUtcTimestamp(appointment.date, appointment.time);
      const now = Date.now();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (appointmentUtc - now > twentyFourHoursMs) {
        const reminderTime = appointmentUtc - twentyFourHoursMs;
        await ctx.scheduler.runAt(reminderTime, internal.appointments.send24hReminder, {
          appointmentId: args.appointmentId,
        });
      }
    } catch {
      // Ignorer silencieusement les erreurs de parsing en production
    }

    return {
      success: true,
      appointmentId: args.appointmentId,
      status: APPOINTMENT_STATUS.CONFIRMED,
    };
  },
});

/**
 * Refus d'un rendez-vous par le professionnel propriétaire.
 * Transition canonique : en_attente -> annule
 */
export const reject = mutation({
  args: {
    appointmentId: v.id("appointments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Profil professionnel de santé introuvable");
    }

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Rendez-vous introuvable");
    }

    if (appointment.providerId !== provider._id) {
      throw new Error("Ce rendez-vous ne vous est pas assigné");
    }

    if (appointment.status !== APPOINTMENT_STATUS.PENDING) {
      throw new Error("Seul un rendez-vous en attente peut être refusé");
    }

    const reasonText = args.reason || "Refusé par le professionnel";

    await ctx.db.patch(args.appointmentId, {
      status: APPOINTMENT_STATUS.CANCELLED,
      cancellationReason: reasonText,
    });

    // Notification transactionnelle pour le patient
    await createServerNotification(ctx, {
      userId: appointment.patientId,
      title: "Demande de rendez-vous refusée",
      message: `Votre demande pour le ${appointment.date} à ${appointment.time} n'a pas pu être acceptée (${reasonText}).`,
      type: "alert",
      link: "/dashboard",
    });

    // Notification aux proches du Cercle
    await notifyCircleMembers(ctx, appointment.patientId, {
      title: "Rendez-vous non accepté",
      message: `La demande de consultation du ${appointment.date} à ${appointment.time} n'a pas pu être acceptée par le professionnel.`,
      type: "alert",
      link: "/dashboard",
    });

    return {
      success: true,
      appointmentId: args.appointmentId,
      status: APPOINTMENT_STATUS.CANCELLED,
    };
  },
});

/**
 * Annulation d'un rendez-vous par le patient concerné OU le professionnel assigné.
 * Transition canonique : en_attente / confirme -> annule
 */
export const cancel = mutation({
  args: {
    appointmentId: v.id("appointments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Rendez-vous introuvable");
    }

    const isPatient = appointment.patientId === userId;

    let isProvider = false;
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (provider && appointment.providerId === provider._id) {
      isProvider = true;
    }

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
      throw new Error("Vous n'êtes pas autorisé à annuler ce rendez-vous");
    }

    if (
      appointment.status !== APPOINTMENT_STATUS.PENDING &&
      appointment.status !== APPOINTMENT_STATUS.CONFIRMED
    ) {
      throw new Error(
        `Impossible d'annuler un rendez-vous avec le statut: ${appointment.status}`
      );
    }

    const fallbackReason = isPatient
      ? "Annulé par le patient"
      : isCircleManager
      ? "Annulé par un proche mandaté"
      : "Annulé par le professionnel";
    const reasonText = args.reason || fallbackReason;

    await ctx.db.patch(args.appointmentId, {
      status: APPOINTMENT_STATUS.CANCELLED,
      cancellationReason: reasonText,
    });

    if (isCircleManager) {
      const circle = await getOrCreateCircle(ctx, appointment.patientId);
      await logCircleAuditEvent(ctx, {
        circleId: circle._id,
        patientId: appointment.patientId,
        actorUserId: userId,
        action: "delegated_appointment_cancelled",
        metadata: {
          appointmentId: args.appointmentId,
          date: appointment.date,
          time: appointment.time,
          reason: reasonText,
        },
      });

      // Notification transactionnelle pour le patient
      const actor = await ctx.db.get(userId);
      const actorName = actor?.name || actor?.firstName || "Votre proche";
      await createServerNotification(ctx, {
        userId: appointment.patientId,
        title: "Rendez-vous annulé par votre proche",
        message: `${actorName} a annulé votre consultation du ${appointment.date} à ${appointment.time} (${reasonText}).`,
        type: "alert",
        link: "/dashboard",
      });
    }

    // Notifier le praticien si l'annulation provient du patient ou d'un proche
    if (isPatient || isCircleManager) {
      if (provider?.userId) {
        await createServerNotification(ctx, {
          userId: provider.userId,
          title: "Rendez-vous annulé",
          message: `La consultation prévue le ${appointment.date} à ${appointment.time} a été annulée (${reasonText}).`,
          type: "alert",
          link: "/dashboard",
        });
      }
    } else {
      // Annulation par le soignant -> notifie le patient
      await createServerNotification(ctx, {
        userId: appointment.patientId,
        title: "Rendez-vous annulé par le soignant",
        message: `Le soignant a annulé la consultation du ${appointment.date} à ${appointment.time} (${reasonText}).`,
        type: "alert",
        link: "/dashboard",
      });
    }

    // Notifier les autres proches du Cercle
    await notifyCircleMembers(ctx, appointment.patientId, {
      title: "Rendez-vous annulé",
      message: `La consultation du ${appointment.date} à ${appointment.time} a été annulée (${reasonText}).`,
      type: "alert",
      link: "/dashboard",
      excludedUserId: userId,
    });

    return {
      success: true,
      appointmentId: args.appointmentId,
      status: APPOINTMENT_STATUS.CANCELLED,
    };
  },
});

/**
 * Créneaux horaires déjà occupés pour un soignant et une date donnés.
 * Seuls les rendez-vous "en_attente" ou "confirme" bloquent le créneau.
 */
export const getProviderBookedSlots = query({
  args: {
    providerId: v.id("providers"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider_date", (q) =>
        q.eq("providerId", args.providerId).eq("date", args.date)
      )
      .collect();

    const activeSlots = appointments
      .filter(
        (a) =>
          a.status === APPOINTMENT_STATUS.PENDING ||
          a.status === APPOINTMENT_STATUS.CONFIRMED
      )
      .map((a) => a.time);

    return activeSlots;
  },
});

/**
 * Clôture d'une consultation confirmée par le professionnel avec compte-rendu clinique.
 * Transition canonique : confirme -> termine
 */
export const complete = mutation({
  args: {
    appointmentId: v.id("appointments"),
    clinicalReport: v.string(),
    vitals: v.optional(
      v.object({
        bloodPressure: v.optional(v.string()),
        pulse: v.optional(v.number()),
        temperature: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise pour clôturer la consultation");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Profil professionnel de santé introuvable");
    }

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Rendez-vous introuvable");
    }

    if (appointment.providerId !== provider._id) {
      throw new Error("Ce rendez-vous ne vous est pas assigné");
    }

    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) {
      throw new Error("Seul un rendez-vous confirmé peut être clôturé et validé");
    }

    // RÈGLE CRITIQUE SPRINT 03/04: Interdiction formelle de clôturer un rendez-vous dans le futur
    const scheduledTimestamp = parseAppointmentUtcTimestamp(appointment.date, appointment.time);
    if (scheduledTimestamp > Date.now()) {
      throw new Error(
        "Impossible de clôturer une consultation dont la date et l'heure sont dans le futur"
      );
    }

    const cleanReport = args.clinicalReport.trim();
    if (!cleanReport) {
      throw new Error("Le compte-rendu clinique est obligatoire pour clôturer la consultation");
    }

    // Mettre à jour le rendez-vous vers le statut final termine
    await ctx.db.patch(args.appointmentId, {
      status: APPOINTMENT_STATUS.COMPLETED,
      clinicalReport: cleanReport,
    });

    // Enregistrer les constantes si fournies
    if (args.vitals && (args.vitals.bloodPressure || args.vitals.pulse || args.vitals.temperature !== undefined)) {
      const now = Date.now();
      const vitalId = await ctx.db.insert("patientVitals", {
        patientId: appointment.patientId,
        recordedBy: userId,
        appointmentId: appointment._id,
        bloodPressure: args.vitals.bloodPressure,
        pulse: args.vitals.pulse,
        temperature: args.vitals.temperature,
        recordedAt: now,
      });

      // Synchronisation idempotente vers healthObservations (write-path Module 6)
      await syncPatientVitalToChronic(ctx, {
        vitalId,
        patientId: appointment.patientId,
        recordedBy: userId,
        bloodPressure: args.vitals.bloodPressure,
        pulse: args.vitals.pulse,
        temperature: args.vitals.temperature,
        recordedAt: now,
      });
    }

    // Notification transactionnelle pour le patient l'invitant à laisser un avis
    await createServerNotification(ctx, {
      userId: appointment.patientId,
      title: "Consultation terminée",
      message: "Votre soignant a validé le compte-rendu de votre soin. Vous pouvez maintenant consulter vos documents et laisser un avis.",
      type: "info",
      link: "/dashboard",
    });

    // Notification de visite complétée aux membres autorisés du Cercle (Section 21)
    // Règle de confidentialité : aucun détail médical ou diagnostique sensible
    const patientUser = await ctx.db.get(appointment.patientId);
    const patientName = patientUser?.name || "votre proche";
    await notifyCircleMembers(ctx, appointment.patientId, {
      title: "Visite de soins terminée",
      message: `Le professionnel de santé a terminé la visite à domicile pour ${patientName}.`,
      type: "info",
      link: "/dashboard",
    });

    return {
      success: true,
      appointmentId: args.appointmentId,
      status: APPOINTMENT_STATUS.COMPLETED,
    };
  },
});

/**
 * Mutation interne planifiée : rappel 24h avant la consultation.
 * Vérifie que le rendez-vous est toujours en état 'confirme' avant d'émettre la notification.
 * Règle de confidentialité : ne contient aucun détail médical sensible.
 */
export const send24hReminder = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return;

    // Règle stricte : notifier UNIQUEMENT si toujours confirmé
    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) {
      return;
    }

    // Rappel au patient
    await createServerNotification(ctx, {
      userId: appointment.patientId,
      title: "Rappel de consultation",
      message: `Rappel : votre soin à domicile (${appointment.serviceType || "Consultation"}) est prévu demain à ${appointment.time}.`,
      type: "reminder",
      link: "/dashboard",
    });

    // Rappel au soignant
    const provider = await ctx.db.get(appointment.providerId);
    if (provider) {
      await createServerNotification(ctx, {
        userId: provider.userId,
        title: "Rappel de consultation",
        message: `Rappel : vous avez une intervention prévue demain à ${appointment.time}.`,
        type: "reminder",
        link: "/dashboard",
      });
    }
  },
});


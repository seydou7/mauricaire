import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { APPOINTMENT_STATUS } from "./schema";
import { isOperationalProfessional } from "./providers";

export const DEFAULT_WEEKLY_SCHEDULE = [
  {
    dayOfWeek: 1, // Lundi
    enabled: true,
    periods: [
      { start: "08:30", end: "12:30" },
      { start: "14:30", end: "18:00" },
    ],
  },
  {
    dayOfWeek: 2, // Mardi
    enabled: true,
    periods: [
      { start: "08:30", end: "12:30" },
      { start: "14:30", end: "18:00" },
    ],
  },
  {
    dayOfWeek: 3, // Mercredi
    enabled: true,
    periods: [
      { start: "08:30", end: "12:30" },
      { start: "14:30", end: "18:00" },
    ],
  },
  {
    dayOfWeek: 4, // Jeudi
    enabled: true,
    periods: [
      { start: "08:30", end: "12:30" },
      { start: "14:30", end: "18:00" },
    ],
  },
  {
    dayOfWeek: 5, // Vendredi
    enabled: true,
    periods: [
      { start: "08:30", end: "12:00" },
      { start: "15:00", end: "18:30" },
    ],
  },
  {
    dayOfWeek: 6, // Samedi
    enabled: true,
    periods: [{ start: "09:00", end: "13:30" }],
  },
  {
    dayOfWeek: 7, // Dimanche
    enabled: false,
    periods: [],
  },
];

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Calcule le jour de la semaine ISO (1 = Lundi, ..., 7 = Dimanche)
 * de manière déterministe en UTC pour une chaîne "YYYY-MM-DD".
 */
export function getIsoDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateUtc = new Date(Date.UTC(y, m - 1, d));
  const day = dateUtc.getUTCDay(); // 0 = Dimanche, 1 = Lundi ... 6 = Samedi
  return day === 0 ? 7 : day;
}

/**
 * Récupère les paramètres complets d'horaires et de congés du soignant connecté.
 */
export const getMyAvailabilitySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) return null;

    const availabilityRecord = await ctx.db
      .query("providerAvailability")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .first();

    const exceptions = await ctx.db
      .query("providerExceptions")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .collect();

    const leaves = await ctx.db
      .query("providerLeaves")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .collect();

    return {
      providerId: provider._id,
      available: provider.available,
      weeklySchedule: availabilityRecord?.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
      leadTimeMinutes: availabilityRecord?.leadTimeMinutes ?? 60,
      slotDurationMinutes: availabilityRecord?.slotDurationMinutes ?? 30,
      exceptions,
      leaves,
    };
  },
});

/**
 * Sauvegarde la grille d'horaires hebdomadaires récurrents.
 */
export const saveWeeklySchedule = mutation({
  args: {
    weeklySchedule: v.array(
      v.object({
        dayOfWeek: v.number(),
        enabled: v.boolean(),
        periods: v.array(
          v.object({
            start: v.string(),
            end: v.string(),
          })
        ),
      })
    ),
    leadTimeMinutes: v.optional(v.number()),
    slotDurationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) throw new Error("Profil professionnel introuvable");

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    // Valider la cohérence des périodes
    for (const day of args.weeklySchedule) {
      for (const p of day.periods) {
        if (timeToMinutes(p.start) >= timeToMinutes(p.end)) {
          throw new Error(`Période invalide (${p.start} -> ${p.end}) : l'heure de début doit précéder l'heure de fin`);
        }
      }
    }

    const existing = await ctx.db
      .query("providerAvailability")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        weeklySchedule: args.weeklySchedule,
        leadTimeMinutes: args.leadTimeMinutes ?? existing.leadTimeMinutes ?? 60,
        slotDurationMinutes: args.slotDurationMinutes ?? existing.slotDurationMinutes ?? 30,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("providerAvailability", {
        providerId: provider._id,
        weeklySchedule: args.weeklySchedule,
        leadTimeMinutes: args.leadTimeMinutes ?? 60,
        slotDurationMinutes: args.slotDurationMinutes ?? 30,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Définit une exception d'indisponibilité ou d'horaires modifiés pour une date spécifique.
 */
export const saveDateException = mutation({
  args: {
    date: v.string(), // "YYYY-MM-DD"
    isUnavailable: v.boolean(),
    periods: v.optional(
      v.array(
        v.object({
          start: v.string(),
          end: v.string(),
        })
      )
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) throw new Error("Profil soignant introuvable");

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    const existing = await ctx.db
      .query("providerExceptions")
      .withIndex("by_provider_date", (q) =>
        q.eq("providerId", provider._id).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isUnavailable: args.isUnavailable,
        periods: args.periods,
        reason: args.reason?.trim() || undefined,
      });
    } else {
      await ctx.db.insert("providerExceptions", {
        providerId: provider._id,
        date: args.date,
        isUnavailable: args.isUnavailable,
        periods: args.periods,
        reason: args.reason?.trim() || undefined,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Supprime une exception de date.
 */
export const deleteDateException = mutation({
  args: {
    exceptionId: v.id("providerExceptions"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) throw new Error("Profil soignant introuvable");

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    const exc = await ctx.db.get(args.exceptionId);
    if (!exc || exc.providerId !== provider._id) {
      throw new Error("Exception introuvable ou non autorisée");
    }

    await ctx.db.delete(args.exceptionId);
    return { success: true };
  },
});

/**
 * Enregistre une période de congé ou d'indisponibilité prolongée.
 * Règle métier : n'annule pas silencieusement les rendez-vous existants ;
 * retourne la liste des conflits éventuels pour arbitrage explicite par le soignant.
 */
export const saveLeave = mutation({
  args: {
    startDate: v.string(), // "YYYY-MM-DD"
    endDate: v.string(),   // "YYYY-MM-DD"
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) throw new Error("Profil soignant introuvable");

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    if (args.startDate > args.endDate) {
      throw new Error("La date de début du congé doit être antérieure ou égale à la date de fin");
    }

    const leaveId = await ctx.db.insert("providerLeaves", {
      providerId: provider._id,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason?.trim() || undefined,
      createdAt: Date.now(),
    });

    // Détecter d'éventuels rendez-vous actifs déjà réservés sur cette période
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
      .collect();

    const conflicts = appointments.filter(
      (a) =>
        a.date >= args.startDate &&
        a.date <= args.endDate &&
        (a.status === APPOINTMENT_STATUS.PENDING || a.status === APPOINTMENT_STATUS.CONFIRMED)
    );

    return {
      success: true,
      leaveId,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts: conflicts.map((c) => ({
        id: c._id,
        date: c.date,
        time: c.time,
        status: c.status,
      })),
    };
  },
});

/**
 * Supprime une période de congé.
 */
export const deleteLeave = mutation({
  args: {
    leaveId: v.id("providerLeaves"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) throw new Error("Profil soignant introuvable");

    if (!isOperationalProfessional(provider)) {
      throw new Error("Action réservée aux professionnels accrédités et validés");
    }

    const leave = await ctx.db.get(args.leaveId);
    if (!leave || leave.providerId !== provider._id) {
      throw new Error("Période de congé introuvable");
    }

    await ctx.db.delete(args.leaveId);
    return { success: true };
  },
});

/**
 * Génération déterministe et autoritaire des créneaux horaires disponibles côté serveur (Section 9).
 * Tient compte :
 * - Du statut d'accréditation et de disponibilité globale du soignant
 * - Des périodes de congé (leaves)
 * - Des exceptions de date
 * - De la grille hebdomadaire de disponibilité
 * - De la durée de la prestation choisie (ou durée par défaut)
 * - Du délai minimum de préavis (leadTimeMinutes)
 * - Des rendez-vous déjà réservés (en_attente ou confirme)
 */
export const getAvailableSlots = query({
  args: {
    providerId: v.id("providers"),
    date: v.string(), // "YYYY-MM-DD"
    serviceId: v.optional(v.id("providerServices")),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db.get(args.providerId);
    if (!provider || !provider.available || !provider.verified) {
      return {
        available: false,
        reason: "Soignant non disponible pour de nouvelles réservations",
        slots: [],
      };
    }

    // 1. Vérifier si la date est couverte par un congé
    const leaves = await ctx.db
      .query("providerLeaves")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();

    const onLeave = leaves.find(
      (l) => args.date >= l.startDate && args.date <= l.endDate
    );
    if (onLeave) {
      return {
        available: false,
        isLeave: true,
        reason: onLeave.reason || "En congé",
        slots: [],
      };
    }

    // 2. Déterminer la durée requise du soin
    let requiredDuration = args.durationMinutes || 30;
    if (args.serviceId) {
      const s = await ctx.db.get(args.serviceId);
      if (s?.duration) {
        requiredDuration = s.duration;
      }
    }

    // 3. Récupérer les paramètres d'horaires réels
    const availabilityRecord = await ctx.db
      .query("providerAvailability")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();

    if (
      !availabilityRecord ||
      !availabilityRecord.weeklySchedule ||
      availabilityRecord.weeklySchedule.length === 0
    ) {
      return {
        available: false,
        hasSchedule: false,
        reason: "Ce professionnel n'a pas encore configuré ses disponibilités.",
        slots: [],
      };
    }

    const hasActiveDays = availabilityRecord.weeklySchedule.some(
      (d) => d.enabled && d.periods && d.periods.length > 0
    );
    if (!hasActiveDays) {
      return {
        available: false,
        hasSchedule: false,
        reason: "Ce professionnel n'a pas encore configuré ses disponibilités.",
        slots: [],
      };
    }

    const weeklySchedule = availabilityRecord.weeklySchedule;
    const leadTimeMinutes = availabilityRecord.leadTimeMinutes ?? 60;
    const slotStepMinutes = 30; // Granularité des débuts de créneau (ex: 08:30, 09:00, 09:30)

    // 4. Vérifier les exceptions de date
    const exception = await ctx.db
      .query("providerExceptions")
      .withIndex("by_provider_date", (q) =>
        q.eq("providerId", args.providerId).eq("date", args.date)
      )
      .first();

    let operationalPeriods: Array<{ start: string; end: string }> = [];

    if (exception) {
      if (exception.isUnavailable) {
        return {
          available: false,
          isUnavailable: true,
          reason: exception.reason || "Indisponible à cette date",
          slots: [],
        };
      }
      if (exception.periods && exception.periods.length > 0) {
        operationalPeriods = exception.periods;
      }
    } else {
      const isoDay = getIsoDayOfWeek(args.date);
      const daySchedule = weeklySchedule.find((d) => d.dayOfWeek === isoDay);
      if (!daySchedule || !daySchedule.enabled || daySchedule.periods.length === 0) {
        return {
          available: false,
          reason: "Aucun horaire d'intervention configuré pour ce jour",
          slots: [],
        };
      }
      operationalPeriods = daySchedule.periods;
    }

    // 5. Calculer le timestamp UTC actuel pour le filtre de préavis
    const nowUtc = new Date();
    const todayStrUtc = nowUtc.toISOString().split("T")[0];
    const currentMinsUtc = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
    const minBookingMinsUtc = currentMinsUtc + leadTimeMinutes;

    // 6. Récupérer les rendez-vous existants bloquants (en_attente ou confirme)
    const existingAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider_date", (q) =>
        q.eq("providerId", args.providerId).eq("date", args.date)
      )
      .collect();

    const activeAppointments = existingAppointments.filter(
      (a) =>
        a.status === APPOINTMENT_STATUS.PENDING ||
        a.status === APPOINTMENT_STATUS.CONFIRMED
    );

    const bookedIntervals = activeAppointments.map((a) => {
      const start = timeToMinutes(a.time);
      const duration = a.duration || 60;
      return { start, end: start + duration };
    });

    // 7. Générer les créneaux éligibles sans chevauchement
    const validSlots: string[] = [];

    for (const period of operationalPeriods) {
      const periodStartMins = timeToMinutes(period.start);
      const periodEndMins = timeToMinutes(period.end);

      for (
        let slotStart = periodStartMins;
        slotStart + requiredDuration <= periodEndMins;
        slotStart += slotStepMinutes
      ) {
        const slotEnd = slotStart + requiredDuration;

        // Si la date demandée est aujourd'hui, vérifier le délai de préavis en UTC
        if (args.date === todayStrUtc && slotStart < minBookingMinsUtc) {
          continue;
        }

        // Vérifier le chevauchement avec un rendez-vous actif
        const hasCollision = bookedIntervals.some(
          (booked) => Math.max(slotStart, booked.start) < Math.min(slotEnd, booked.end)
        );

        if (!hasCollision) {
          validSlots.push(minutesToTime(slotStart));
        }
      }
    }

    return {
      available: validSlots.length > 0,
      slots: validSlots,
      totalSlots: validSlots.length,
      leadTimeMinutes,
      requiredDuration,
    };
  },
});

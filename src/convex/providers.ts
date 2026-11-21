import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { specialtyValidator, APPOINTMENT_STATUS } from "./schema";
import { parseAppointmentUtcTimestamp } from "./careRelationship";
import {
  DEFAULT_WEEKLY_SCHEDULE,
  timeToMinutes,
  minutesToTime,
  getIsoDayOfWeek,
} from "./availability";

// Helper function to calculate distance using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 10) / 10; // 1 decimal precision
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

/**
 * Helper to compute real-time next availability preview over 7 days for a provider.
 * Strictly checks actual configured schedules — never fabricates fake slots or schedules.
 */
async function computeProviderAvailabilityPreview(
  ctx: any,
  provider: any
): Promise<{
  hasSlots: boolean;
  hasSchedule: boolean;
  nextSlotText: string;
  nextSlots: Array<{ date: string; time: string; label: string }>;
}> {
  // 1. Fetch provider availability settings
  const availabilityRecord = await ctx.db
    .query("providerAvailability")
    .withIndex("by_providerId", (q: any) => q.eq("providerId", provider._id))
    .first();

  // If no schedule record exists or no days configured, availability is unconfigured
  if (
    !availabilityRecord ||
    !availabilityRecord.weeklySchedule ||
    availabilityRecord.weeklySchedule.length === 0
  ) {
    return {
      hasSlots: false,
      hasSchedule: false,
      nextSlotText: "Disponibilités non configurées",
      nextSlots: [],
    };
  }

  const hasActiveDays = availabilityRecord.weeklySchedule.some(
    (d: any) => d.enabled && d.periods && d.periods.length > 0
  );
  if (!hasActiveDays) {
    return {
      hasSlots: false,
      hasSchedule: false,
      nextSlotText: "Disponibilités non configurées",
      nextSlots: [],
    };
  }

  // If schedule exists but provider toggled availability off
  if (!provider.available) {
    return {
      hasSlots: false,
      hasSchedule: true,
      nextSlotText: "Indisponible pour réservations",
      nextSlots: [],
    };
  }

  // 2. Fetch provider leaves
  const leaves = await ctx.db
    .query("providerLeaves")
    .withIndex("by_providerId", (q: any) => q.eq("providerId", provider._id))
    .collect();

  const weeklySchedule = availabilityRecord.weeklySchedule;
  const leadTimeMinutes = availabilityRecord.leadTimeMinutes ?? 60;
  const slotDuration = 30;

  // 3. Scan the next 7 days starting from today (UTC)
  const nowUtc = new Date();
  const todayStr = nowUtc.toISOString().split("T")[0];
  const currentMinsUtc = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const minBookingMinsUtc = currentMinsUtc + leadTimeMinutes;

  const foundSlots: Array<{ date: string; time: string; label: string }> = [];

  for (let dayOffset = 0; dayOffset < 7 && foundSlots.length < 3; dayOffset++) {
    const targetDateObj = new Date(nowUtc.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = targetDateObj.toISOString().split("T")[0];

    // Check leave
    const onLeave = leaves.some(
      (l: any) => dateStr >= l.startDate && dateStr <= l.endDate
    );
    if (onLeave) continue;

    // Check exception
    const exception = await ctx.db
      .query("providerExceptions")
      .withIndex("by_provider_date", (q: any) =>
        q.eq("providerId", provider._id).eq("date", dateStr)
      )
      .first();

    if (exception && exception.isUnavailable) continue;

    let operationalPeriods: Array<{ start: string; end: string }> = [];
    if (exception && exception.periods && exception.periods.length > 0) {
      operationalPeriods = exception.periods;
    } else {
      const isoDay = getIsoDayOfWeek(dateStr);
      const daySchedule = weeklySchedule.find((d: any) => d.dayOfWeek === isoDay);
      if (!daySchedule || !daySchedule.enabled || daySchedule.periods.length === 0) {
        continue;
      }
      operationalPeriods = daySchedule.periods;
    }

    // Check booked appointments for that date
    const existingAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider_date", (q: any) =>
        q.eq("providerId", provider._id).eq("date", dateStr)
      )
      .collect();

    const activeAppointments = existingAppointments.filter(
      (a: any) =>
        a.status === APPOINTMENT_STATUS.PENDING ||
        a.status === APPOINTMENT_STATUS.CONFIRMED
    );

    const bookedIntervals = activeAppointments.map((a: any) => {
      const start = timeToMinutes(a.time);
      const duration = a.duration || 60;
      return { start, end: start + duration };
    });

    for (const period of operationalPeriods) {
      const periodStartMins = timeToMinutes(period.start);
      const periodEndMins = timeToMinutes(period.end);

      for (
        let slotStart = periodStartMins;
        slotStart + slotDuration <= periodEndMins;
        slotStart += 30
      ) {
        const slotEnd = slotStart + slotDuration;

        if (dateStr === todayStr && slotStart < minBookingMinsUtc) {
          continue;
        }

        const hasCollision = bookedIntervals.some(
          (b: any) => Math.max(slotStart, b.start) < Math.min(slotEnd, b.end)
        );

        if (!hasCollision) {
          const slotTime = minutesToTime(slotStart);
          let dayLabel = dateStr;
          if (dayOffset === 0) {
            dayLabel = `Aujourd'hui ${slotTime}`;
          } else if (dayOffset === 1) {
            dayLabel = `Demain ${slotTime}`;
          } else {
            const [, m, d] = dateStr.split("-");
            dayLabel = `${d}/${m} ${slotTime}`;
          }

          foundSlots.push({
            date: dateStr,
            time: slotTime,
            label: dayLabel,
          });

          if (foundSlots.length >= 3) break;
        }
      }
      if (foundSlots.length >= 3) break;
    }
  }

  if (foundSlots.length > 0) {
    return {
      hasSlots: true,
      hasSchedule: true,
      nextSlotText: foundSlots[0].label,
      nextSlots: foundSlots,
    };
  }

  return {
    hasSlots: false,
    hasSchedule: true,
    nextSlotText: "Aucun créneau disponible (7j)",
    nextSlots: [],
  };
}

/**
 * Query public directory of verified and approved healthcare providers.
 * - Decouples directory visibility (public by default for approved providers)
 *   from real-time slot availability.
 * - Enforces verified === true, approved status, and !deactivated.
 * - Calculates Haversine distance ONLY if real coordinates are provided.
 * - Provides availability preview over 7 days for every provider.
 */
export const getNearbyProviders = query({
  args: {
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    specialty: v.optional(specialtyValidator),
    city: v.optional(v.string()),
    zone: v.optional(v.string()),
    maxPrice: v.optional(v.number()),
    serviceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // All verified providers in the database
    const allVerifiedProviders = await ctx.db
      .query("providers")
      .withIndex("by_verified", (q) => q.eq("verified", true))
      .collect();

    // Filter approved and active providers (Public by default)
    const providers = allVerifiedProviders.filter(
      (p) =>
        (p.onboardingStatus === "approved" ||
          p.verificationStatus === "approved" ||
          p.verified === true) &&
        p.deactivated !== true &&
        p.isPublic !== false
    );

    // Filter by specialty if requested
    let filtered = providers;
    if (args.specialty) {
      filtered = filtered.filter((p) => p.specialty === args.specialty);
    }

    // Filter by city if requested
    if (args.city) {
      const targetCity = args.city.toLowerCase().trim();
      filtered = filtered.filter((p) => p.city && p.city.toLowerCase().trim() === targetCity);
    }

    // Filter by intervention zone if requested (handles space/hyphen variations)
    if (args.zone) {
      const targetZone = args.zone.toLowerCase().replace(/[-_]/g, " ").trim();
      filtered = filtered.filter((p) => {
        if (!p.interventionZones || p.interventionZones.length === 0) return true;
        return p.interventionZones.some((z) => {
          const zNorm = z.toLowerCase().replace(/[-_]/g, " ").trim();
          return zNorm === targetZone || zNorm.includes(targetZone) || targetZone.includes(zNorm);
        });
      });
    }

    // Filter by maximum price if requested
    if (args.maxPrice !== undefined) {
      filtered = filtered.filter(
        (p) => p.consultationFee === undefined || p.consultationFee <= args.maxPrice!
      );
    }

    const hasPatientCoords = args.latitude !== undefined && args.longitude !== undefined;

    const result = [];
    for (const provider of filtered) {
      const user = await ctx.db.get(provider.userId);
      const publicUser = user
        ? {
            _id: user._id,
            name: user.name || "Professionnel de santé",
            image: user.image,
            phone: user.phone,
            city: user.city || provider.city,
          }
        : null;

      let distance: number | undefined = undefined;
      if (hasPatientCoords && user?.latitude !== undefined && user?.longitude !== undefined) {
        distance = getDistanceFromLatLonInKm(
          args.latitude!,
          args.longitude!,
          user.latitude,
          user.longitude
        );
      }

      const availabilityPreview = await computeProviderAvailabilityPreview(ctx, provider);

      result.push({
        _id: provider._id,
        _creationTime: provider._creationTime,
        userId: provider.userId,
        specialty: provider.specialty,
        licenseNumber: provider.licenseNumber,
        professionalTitle: provider.professionalTitle,
        bio: provider.bio,
        yearsOfExperience: provider.yearsOfExperience,
        verified: provider.verified,
        city: provider.city,
        interventionZones: provider.interventionZones,
        available: provider.available,
        isPublic: provider.isPublic !== false,
        consultationFee: provider.consultationFee,
        languages: provider.languages,
        rating: provider.rating,
        reviewCount: provider.reviewCount,
        availabilityPreview,
        user: publicUser,
        distance,
      });
    }

    // If patient coordinates exist, sort by distance ascending
    if (hasPatientCoords) {
      result.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    } else {
      // Default sort by rating descending
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    return result;
  },
});

/**
 * Get single provider by canonical Convex ID (v.id("providers")).
 * Enforces verification visibility for public viewers.
 */
export const getById = query({
  args: {
    id: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db.get(args.id);
    if (!provider) {
      return null;
    }

    const viewerId = await getAuthUserId(ctx);
    const isOwner = viewerId === provider.userId;

    // If not verified, only allow the owner to view it
    if (!provider.verified && !isOwner) {
      return null; // Hidden from public
    }

    const user = await ctx.db.get(provider.userId);
    const publicUser = user
      ? {
          _id: user._id,
          name: user.name || "Professionnel de santé",
          image: user.image,
          phone: user.phone,
          city: user.city || provider.city,
          latitude: user.latitude,
          longitude: user.longitude,
        }
      : null;

    const services = await ctx.db
      .query("providerServices")
      .withIndex("by_provider_active", (q) =>
        q.eq("providerId", provider._id).eq("active", true)
      )
      .collect();

    const formattedServices = services.map((s) => ({
      _id: s._id,
      id: s._id,
      canonicalServiceId: s.canonicalServiceId,
      title: s.customLabel || s.canonicalServiceId,
      price: s.price,
      duration: s.duration,
      description: s.description,
    }));

    const availabilityPreview = await computeProviderAvailabilityPreview(ctx, provider);

    if (!isOwner) {
      // Exclude private document storage IDs, admin comments, and verification internals from public view
      return {
        _id: provider._id,
        _creationTime: provider._creationTime,
        userId: provider.userId,
        specialty: provider.specialty,
        licenseNumber: provider.licenseNumber,
        professionalTitle: provider.professionalTitle,
        bio: provider.bio,
        yearsOfExperience: provider.yearsOfExperience,
        verified: provider.verified,
        city: provider.city,
        interventionZones: provider.interventionZones,
        available: provider.available,
        consultationFee: provider.consultationFee,
        languages: provider.languages,
        rating: provider.rating,
        reviewCount: provider.reviewCount,
        availabilityPreview,
        user: publicUser,
        services: formattedServices,
      };
    }

    return {
      ...provider,
      availabilityPreview,
      user: publicUser,
      services: formattedServices,
    };
  },
});

/**
 * Get provider profile for current authenticated professional.
 */
/**
 * Canonical operational eligibility rule for Healthcare Professionals.
 * Matches Product Owner canonical definition:
 * - user.role === "professionnel"
 * - provider exists
 * - provider.verified === true
 * - provider.onboardingStatus === "approved" (or legacy fallback verificationStatus === "approved")
 * - !user.deactivatedAt
 * - !provider.deactivated
 */
export function isOperationalProfessional(
  provider: {
    _id?: any;
    verified?: boolean;
    onboardingStatus?: string;
    verificationStatus?: string;
    deactivated?: boolean;
  } | null | undefined,
  user?: {
    role?: string;
    deactivatedAt?: number | null;
  } | null | undefined
): provider is NonNullable<typeof provider> {
  if (!provider) return false;
  if (user && user.role !== "professionnel") return false;
  if (user?.deactivatedAt) return false;
  if (provider.deactivated) return false;
  if (provider.verified !== true) return false;

  const effectiveStatus =
    provider.onboardingStatus ??
    (provider.verificationStatus === "approved" ? "approved" : "submitted");

  return effectiveStatus === "approved";
}

/**
 * Guard that enforces that the caller is an authenticated, approved, verified,
 * non-deactivated healthcare professional.
 * Throws a clear user-facing error if any condition is not met.
 */
export async function requireApprovedProvider(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentification requise");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.role !== "professionnel" || user.deactivatedAt) {
    throw new Error("Accès réservé aux professionnels de santé actifs");
  }

  const provider = await ctx.db
    .query("providers")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  if (!isOperationalProfessional(provider, user)) {
    throw new Error(
      "Accès restreint : Votre compte professionnel est en attente d'approbation administrative."
    );
  }

  return { userId, user, provider: provider! };
}

/**
 * Get current authenticated user's provider profile with canonical status fallback.
 */
export const getCurrentProvider = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) return null;

    const user = await ctx.db.get(userId);

    // Canonical onboarding status fallback: if verified === true, onboardingStatus is always "approved"
    const onboardingStatus =
      provider.onboardingStatus ??
      (provider.verified && provider.verificationStatus === "approved" ? "approved" : "submitted");

    const isOperational = isOperationalProfessional(
      { ...provider, onboardingStatus },
      user
    );

    return {
      ...provider,
      onboardingStatus,
      isOperational,
    };
  },
});

/**
 * Update professional settings.
 * Strictly updates PROVIDER domain fields.
 * Client CANNOT submit `verified`.
 */
export const updateProviderSettings = mutation({
  args: {
    specialty: v.optional(specialtyValidator),
    licenseNumber: v.optional(v.string()),
    bio: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    available: v.optional(v.boolean()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Non authentifié");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Profil professionnel introuvable");
    }

    const updates: Record<string, any> = {};
    if (args.specialty !== undefined) updates.specialty = args.specialty;
    if (args.licenseNumber !== undefined) updates.licenseNumber = args.licenseNumber;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.yearsOfExperience !== undefined) updates.yearsOfExperience = args.yearsOfExperience;
    if (args.consultationFee !== undefined) updates.consultationFee = args.consultationFee;
    if (args.languages !== undefined) updates.languages = args.languages;
    if (args.available !== undefined) updates.available = args.available;
    if (args.city !== undefined) updates.city = args.city;

    await ctx.db.patch(provider._id, updates);

    return { success: true };
  },
});

/**
 * Query caregivers for the authenticated patient.
 * Canonical rule:
 * A provider belongs to "Mes soignants" ONLY if they have actually completed
 * at least one consultation with the authenticated patient:
 * appointment.patientId === authenticated Patient && appointment.status === "termine".
 *
 * Grouped by provider (appears only once).
 * Sorted by most recent completed consultation (descending).
 * 100% dynamic, persisted data only.
 */
export const getMyCaregivers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const patientAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_patient", (q) => q.eq("patientId", userId))
      .collect();

    const completedAppointments = patientAppointments.filter(
      (a) => a.status === "termine"
    );

    if (completedAppointments.length === 0) {
      return [];
    }

    // Map by providerId to aggregate and find the latest consultation
    const map = new Map<
      string,
      {
        providerId: typeof completedAppointments[0]["providerId"];
        lastAppointment: typeof completedAppointments[0];
        lastTimestamp: number;
        completedCount: number;
      }
    >();

    for (const app of completedAppointments) {
      let ts = 0;
      try {
        ts = parseAppointmentUtcTimestamp(app.date, app.time);
      } catch {
        ts = app._creationTime;
      }

      const pKey = app.providerId.toString();
      const existing = map.get(pKey);
      if (!existing) {
        map.set(pKey, {
          providerId: app.providerId,
          lastAppointment: app,
          lastTimestamp: ts,
          completedCount: 1,
        });
      } else {
        existing.completedCount += 1;
        if (ts >= existing.lastTimestamp) {
          existing.lastAppointment = app;
          existing.lastTimestamp = ts;
        }
      }
    }

    const caregivers = [];
    for (const entry of map.values()) {
      const provider = await ctx.db.get(entry.providerId);
      if (!provider) continue;

      const user = await ctx.db.get(provider.userId);

      caregivers.push({
        _id: provider._id,
        userId: provider.userId,
        specialty: provider.specialty,
        city: provider.city,
        consultationFee: provider.consultationFee,
        rating: provider.rating ?? null,
        reviewCount: provider.reviewCount ?? 0,
        available: provider.available,
        verified: provider.verified,
        lastConsultationDate: entry.lastAppointment.date,
        lastConsultationTime: entry.lastAppointment.time,
        lastConsultationType: entry.lastAppointment.serviceType,
        completedCount: entry.completedCount,
        lastTimestamp: entry.lastTimestamp,
        user: user
          ? {
              _id: user._id,
              name: user.name || "Professionnel de santé",
              image: user.image,
              phone: user.phone,
            }
          : null,
      });
    }

    // Sort by latest completed consultation timestamp descending
    caregivers.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    return caregivers;
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { ROLES, ONBOARDING_STATUS } from "./schema";
import { CANONICAL_SERVICES, getCanonicalServicesForSpecialty, findCanonicalService } from "./serviceCatalog";

/**
 * Récupère les prestations actives et publiées d'un soignant (vue publique patient).
 */
export const getProviderServices = query({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const services = await ctx.db
      .query("providerServices")
      .withIndex("by_provider_active", (q) =>
        q.eq("providerId", args.providerId).eq("active", true)
      )
      .collect();

    return services.map((s) => {
      const canonical = findCanonicalService(s.canonicalServiceId);
      return {
        _id: s._id,
        id: s._id,
        providerId: s.providerId,
        canonicalServiceId: s.canonicalServiceId,
        title: s.customLabel || canonical?.label || "Soin de santé à domicile",
        titleAr: canonical?.labelAr || s.customLabel || "رعاية صحية منزلية",
        description: s.description || canonical?.description || "",
        descriptionAr: canonical?.descriptionAr || "",
        price: s.price,
        duration: s.duration,
        active: s.active,
      };
    });
  },
});

/**
 * Récupère le catalogue complet des services pour le professionnel connecté :
 * les services déjà configurés + les modèles canoniques suggérés pour sa spécialité.
 */
export const getMyServices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) return null;

    const configuredServices = await ctx.db
      .query("providerServices")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .collect();

    const canonicalList = getCanonicalServicesForSpecialty(provider.specialty);

    const configuredMap = new Map(configuredServices.map((s) => [s.canonicalServiceId, s]));

    const merged = canonicalList.map((canonical) => {
      const configured = configuredMap.get(canonical.id);
      return {
        canonicalId: canonical.id,
        specialty: canonical.specialty,
        canonicalLabel: canonical.label,
        canonicalLabelAr: canonical.labelAr,
        canonicalDescription: canonical.description,
        defaultMinPrice: canonical.defaultMinPrice,
        defaultDuration: canonical.defaultDuration,
        isConfigured: !!configured,
        serviceId: configured?._id,
        customLabel: configured?.customLabel || canonical.label,
        price: configured?.price ?? canonical.defaultMinPrice,
        duration: configured?.duration ?? canonical.defaultDuration,
        active: configured?.active ?? false,
        description: configured?.description || canonical.description,
      };
    });

    return {
      providerId: provider._id,
      specialty: provider.specialty,
      verified: provider.verified,
      onboardingStatus: provider.onboardingStatus,
      services: merged,
    };
  },
});

/**
 * Sauvegarde ou met à jour une prestation médicale pour le soignant connecté.
 * Règle de sécurité : seuls les praticiens agréés et vérifiés peuvent publier des services actifs.
 */
export const saveService = mutation({
  args: {
    canonicalServiceId: v.string(),
    customLabel: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.number(),
    duration: v.number(),
    active: v.boolean(),
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
      throw new Error("Profil professionnel introuvable");
    }

    // Contrôle d'habilitation : le soignant doit être approuvé et vérifié pour activer un service
    if (args.active && (!provider.verified || provider.onboardingStatus !== ONBOARDING_STATUS.APPROVED)) {
      throw new Error("Seul un soignant dûment vérifié et agréé peut publier des prestations actives");
    }

    if (args.price <= 0) {
      throw new Error("Le tarif de la consultation doit être supérieur à zéro");
    }

    if (args.duration <= 0 || args.duration > 240) {
      throw new Error("La durée de la prestation doit être comprise entre 5 et 240 minutes");
    }

    const existing = await ctx.db
      .query("providerServices")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .filter((q) => q.eq(q.field("canonicalServiceId"), args.canonicalServiceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customLabel: args.customLabel?.trim() || undefined,
        description: args.description?.trim() || undefined,
        price: Math.round(args.price),
        duration: Math.round(args.duration),
        active: args.active,
        updatedAt: now,
      });
      return { success: true, serviceId: existing._id, action: "updated" };
    } else {
      const newId = await ctx.db.insert("providerServices", {
        providerId: provider._id,
        canonicalServiceId: args.canonicalServiceId,
        customLabel: args.customLabel?.trim() || undefined,
        description: args.description?.trim() || undefined,
        price: Math.round(args.price),
        duration: Math.round(args.duration),
        active: args.active,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, serviceId: newId, action: "created" };
    }
  },
});

/**
 * Supprime ou désactive une prestation du catalogue du soignant.
 */
export const deleteService = mutation({
  args: {
    serviceId: v.id("providerServices"),
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
      throw new Error("Profil professionnel introuvable");
    }

    const service = await ctx.db.get(args.serviceId);
    if (!service || service.providerId !== provider._id) {
      throw new Error("Prestation introuvable ou vous n'en êtes pas le propriétaire");
    }

    await ctx.db.delete(args.serviceId);
    return { success: true };
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

/**
 * Alterne l'état de favori d'un soignant pour le patient connecté.
 */
export const toggleFavorite = mutation({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise pour ajouter aux favoris");
    }

    const provider = await ctx.db.get(args.providerId);
    if (!provider) {
      throw new Error("Professionnel de santé introuvable");
    }

    const existing = await ctx.db
      .query("patientFavorites")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("providerId", args.providerId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { isFavorite: false };
    } else {
      await ctx.db.insert("patientFavorites", {
        userId,
        providerId: args.providerId,
        createdAt: Date.now(),
      });
      return { isFavorite: true };
    }
  },
});

/**
 * Vérifie si un soignant spécifique est dans les favoris du patient connecté.
 */
export const isFavorite = query({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;

    const existing = await ctx.db
      .query("patientFavorites")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("providerId", args.providerId)
      )
      .first();

    return !!existing;
  },
});

/**
 * Récupère la liste complète des soignants mis en favoris par le patient connecté.
 */
export const getFavorites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const favorites = await ctx.db
      .query("patientFavorites")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const results = await Promise.all(
      favorites.map(async (fav) => {
        const provider = await ctx.db.get(fav.providerId);
        if (!provider || !provider.verified) return null;

        const user = await ctx.db.get(provider.userId);
        if (!user || user.deactivatedAt) return null;

        return {
          favoriteId: fav._id,
          providerId: provider._id,
          name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Soignant MauriCare",
          specialty: provider.specialty,
          image: user.image || "",
          phone: user.phone || "",
          city: provider.city,
          interventionZones: provider.interventionZones || [],
          consultationFee: provider.consultationFee,
          rating: provider.rating || 5.0,
          reviewCount: provider.reviewCount || 0,
          available: provider.available,
          savedAt: fav.createdAt,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

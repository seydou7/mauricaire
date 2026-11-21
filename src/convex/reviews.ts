import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { APPOINTMENT_STATUS } from "./schema";

/**
 * Création d'un avis patient suite à une consultation terminée.
 * Règle de sécurité : Uniquement le patient concerné, statut termine obligatoire, exactement un avis par rendez-vous.
 * Met à jour le rating et le reviewCount du soignant de façon autoritaire côté serveur.
 */
export const create = mutation({
  args: {
    appointmentId: v.id("appointments"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise pour laisser un avis");
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Rendez-vous introuvable");
    }

    if (appointment.patientId !== userId) {
      throw new Error("Vous n'êtes pas autorisé à laisser un avis pour cette consultation");
    }

    if (appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
      throw new Error("Seule une consultation terminée peut faire l'objet d'un avis patient");
    }

    if (args.rating < 1 || args.rating > 5 || !Number.isFinite(args.rating)) {
      throw new Error("La note doit être comprise entre 1 et 5");
    }

    // Vérifier si un avis existe déjà pour ce rendez-vous
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .first();

    if (existingReview) {
      throw new Error("Un avis a déjà été publié pour cette consultation");
    }

    const cleanComment = args.comment?.trim() || undefined;

    const reviewId = await ctx.db.insert("reviews", {
      patientId: userId,
      providerId: appointment.providerId,
      appointmentId: args.appointmentId,
      rating: Math.round(args.rating),
      comment: cleanComment,
    });

    // Recalcul autoritaire serveur du rating et reviewCount du soignant
    const allProviderReviews = await ctx.db
      .query("reviews")
      .withIndex("by_provider", (q) => q.eq("providerId", appointment.providerId))
      .collect();

    const reviewCount = allProviderReviews.length;
    const totalScore = allProviderReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating =
      reviewCount > 0 ? Math.round((totalScore / reviewCount) * 10) / 10 : 5.0;

    await ctx.db.patch(appointment.providerId, {
      rating: averageRating,
      reviewCount: reviewCount,
    });

    return {
      success: true,
      reviewId,
      rating: averageRating,
      reviewCount,
    };
  },
});

/**
 * Liste publique des avis d'un soignant.
 * Masque les informations privées des patients (email, téléphone, adresse).
 */
export const getByProvider = query({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_provider", (q) => q.eq("providerId", args.providerId))
      .order("desc")
      .collect();

    const formattedReviews = await Promise.all(
      reviews.map(async (r) => {
        const patient = await ctx.db.get(r.patientId);

        let safeName = "Patient vérifié";
        if (patient?.name) {
          const parts = patient.name.trim().split(" ");
          if (parts.length > 1) {
            safeName = `${parts[0]} ${parts[1][0]}.`;
          } else {
            safeName = parts[0];
          }
        }

        return {
          _id: r._id,
          id: r._id,
          rating: r.rating,
          comment: r.comment || "Soin réalisé avec professionnalisme.",
          authorName: safeName,
          date: new Date(r._creationTime).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          _creationTime: r._creationTime,
        };
      })
    );

    return formattedReviews;
  },
});

/**
 * Vérifie si un avis existe déjà pour un rendez-vous donné.
 */
export const getByAppointment = query({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const review = await ctx.db
      .query("reviews")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", args.appointmentId))
      .first();

    return review;
  },
});

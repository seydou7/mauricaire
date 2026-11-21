import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const RELATIONSHIP_OPTIONS = [
  "conjoint",
  "parent",
  "enfant",
  "frere_soeur",
  "ami",
  "proche",
  "autre",
] as const;

/**
 * Get all emergency contacts for the authenticated user.
 * Strictly private to the user.
 */
export const getEmergencyContacts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const contacts = await ctx.db
      .query("emergencyContacts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Sort primary contact first
    return contacts.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  },
});

/**
 * Create or update an emergency contact.
 * Ensures data validation and single primary contact handling.
 */
export const saveEmergencyContact = mutation({
  args: {
    contactId: v.optional(v.id("emergencyContacts")),
    fullName: v.string(),
    relationship: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const trimmedName = args.fullName.trim();
    if (trimmedName.length < 2) {
      throw new Error("Le nom du contact d'urgence doit comporter au moins 2 caractères.");
    }

    const trimmedPhone = args.phone.trim();
    if (trimmedPhone.length < 6) {
      throw new Error("Veuillez saisir un numéro de téléphone valide.");
    }

    const now = Date.now();

    // If marked as primary, unset other primary contacts for this user
    if (args.isPrimary) {
      const existingPrimaries = await ctx.db
        .query("emergencyContacts")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .collect();

      for (const ep of existingPrimaries) {
        if (!args.contactId || ep._id !== args.contactId) {
          await ctx.db.patch(ep._id, { isPrimary: false, updatedAt: now });
        }
      }
    }

    let savedId: any;
    if (args.contactId) {
      // Update existing contact (verify ownership)
      const existing = await ctx.db.get(args.contactId);
      if (!existing || existing.userId !== userId) {
        throw new Error("Contact d'urgence introuvable ou accès non autorisé.");
      }

      await ctx.db.patch(args.contactId, {
        fullName: trimmedName,
        relationship: args.relationship.trim(),
        phone: trimmedPhone,
        email: args.email?.trim() || undefined,
        notes: args.notes?.trim() || undefined,
        isPrimary: args.isPrimary,
        updatedAt: now,
      });
      savedId = args.contactId;
    } else {
      // Create new emergency contact
      savedId = await ctx.db.insert("emergencyContacts", {
        userId,
        fullName: trimmedName,
        relationship: args.relationship.trim(),
        phone: trimmedPhone,
        email: args.email?.trim() || undefined,
        notes: args.notes?.trim() || undefined,
        isPrimary: args.isPrimary,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      contactId: savedId,
      message: "Contact d'urgence enregistré avec succès.",
    };
  },
});

/**
 * Delete an emergency contact (verifies caller ownership).
 */
export const deleteEmergencyContact = mutation({
  args: {
    contactId: v.id("emergencyContacts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const existing = await ctx.db.get(args.contactId);
    if (!existing || existing.userId !== userId) {
      throw new Error("Contact d'urgence introuvable ou accès non autorisé.");
    }

    await ctx.db.delete(args.contactId);

    return {
      success: true,
      message: "Contact d'urgence supprimé.",
    };
  },
});

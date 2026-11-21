import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { specialtyValidator } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.users.currentUser);
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return null;
    }
    return user;
  },
});

/**
 * Use this function internally to get the current user data.
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Safe and idempotent completion of user registration.
 * - Sets the initial canonical business role ("patient" or "professionnel").
 * - Strictly rejects client-supplied "admin" or legacy roles.
 * - If role is already established, rejects role tampering/switching.
 * - Automatically initializes unverified (verified=false, available=false) provider profile for professionnels.
 */
export const completeRegistration = mutation({
  args: {
    role: v.union(v.literal("patient"), v.literal("professionnel")),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("homme"), v.literal("femme"))),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    // Provider specific fields for initial onboarding
    specialty: v.optional(specialtyValidator),
    licenseNumber: v.optional(v.string()),
    bio: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Non authentifié");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    // Determine role: if already established (patient, professionnel, admin), preserve it.
    // Client cannot freely switch roles or escalate to admin.
    const isEstablished = user.role === "patient" || user.role === "professionnel" || user.role === "admin";
    const targetRole = isEstablished ? (user.role as "patient" | "professionnel" | "admin") : args.role;

    // Update user identity fields without injecting fabricated persona names
    const updates: Record<string, any> = {
      role: targetRole,
      profileCompleted: true,
    };
    if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
    if (args.firstName || args.lastName) {
      updates.name = `${args.firstName || ""} ${args.lastName || ""}`.trim();
    } else if (args.name && args.name.trim()) {
      updates.name = args.name.trim();
    }
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.city !== undefined) updates.city = args.city;
    if (args.address !== undefined) updates.address = args.address;
    if (args.birthDate !== undefined) updates.birthDate = args.birthDate;
    if (args.gender !== undefined) updates.gender = args.gender;

    await ctx.db.patch(userId, updates);

    // If role is professionnel, ensure provider record exists
    if (targetRole === "professionnel") {
      const existingProvider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      if (!existingProvider) {
        await ctx.db.insert("providers", {
          userId,
          specialty: args.specialty || "infirmier",
          licenseNumber: args.licenseNumber || "EN-ATTENTE",
          bio: args.bio || "",
          yearsOfExperience: args.yearsOfExperience || 0,
          consultationFee: args.consultationFee || 500,
          languages: args.languages || ["Français", "Hassaniya"],
          city: args.city || user.city || "Nouakchott",
          verified: false, // strictly false by default (safety requirement #3)
          available: false, // strictly false by default (safety requirement #3)
          verificationStatus: "pending",
          onboardingStatus: "registration_started",
          rating: 5.0,
          reviewCount: 0,
        });
      }
    }

    return {
      success: true,
      role: targetRole,
      alreadyRegistered: isEstablished,
    };
  },
});

/**
 * Generate Convex Storage upload URL for profile picture.
 */
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Non authentifié");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Persist uploaded avatar storageId onto user record.
 */
export const saveAvatar = mutation({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Non authentifié");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    // Clean up old avatar from storage if replaced
    if (user.avatarStorageId && user.avatarStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(user.avatarStorageId);
      } catch (err) {
        console.warn("Ancien avatar non supprimé:", err);
      }
    }

    const avatarUrl = await ctx.storage.getUrl(args.storageId);
    await ctx.db.patch(userId, {
      avatarStorageId: args.storageId,
      image: avatarUrl || undefined,
    });

    // Record security event
    await ctx.db.insert("securityEvents", {
      userId,
      eventType: "profile_photo_updated",
      timestamp: Date.now(),
    });

    return { success: true, avatarUrl };
  },
});

/**
 * Remove avatar photo and clean storage.
 */
export const removeAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Non authentifié");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    if (user.avatarStorageId) {
      try {
        await ctx.storage.delete(user.avatarStorageId);
      } catch (err) {
        console.warn("Avatar non supprimé du stockage:", err);
      }
    }

    await ctx.db.patch(userId, {
      avatarStorageId: undefined,
      image: undefined,
    });

    await ctx.db.insert("securityEvents", {
      userId,
      eventType: "profile_photo_removed",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get comprehensive user profile with completion analysis.
 */
export const getCompleteUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    let provider: any = null;
    if (user.role === "professionnel") {
      provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    }

    // Fetch primary emergency contact
    const primaryContact = await ctx.db
      .query("emergencyContacts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isPrimary"), true))
      .first();

    // Calculate profile completion score
    const requiredChecks = [
      { field: "firstName", valid: !!user.firstName },
      { field: "lastName", valid: !!user.lastName },
      { field: "phone", valid: !!user.phone },
      { field: "city", valid: !!user.city },
      { field: "address", valid: !!user.address },
      { field: "birthDate", valid: !!user.birthDate },
      { field: "gender", valid: !!user.gender },
      { field: "photo", valid: !!user.image || !!user.avatarStorageId },
    ];

    if (user.role === "patient") {
      requiredChecks.push({ field: "emergencyContact", valid: !!primaryContact });
    } else if (user.role === "professionnel") {
      requiredChecks.push(
        { field: "specialty", valid: !!provider?.specialty },
        { field: "licenseNumber", valid: !!provider?.licenseNumber && provider.licenseNumber !== "EN-ATTENTE" },
        { field: "bio", valid: !!provider?.bio && provider.bio.length >= 30 }
      );
    }

    const completedCount = requiredChecks.filter((c) => c.valid).length;
    const completionScore = Math.round((completedCount / requiredChecks.length) * 100);
    const missingFields = requiredChecks.filter((c) => !c.valid).map((c) => c.field);

    return {
      userId: user._id,
      name: user.name || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      city: user.city || "Nouakchott",
      neighborhood: user.neighborhood || "",
      address: user.address || "",
      birthDate: user.birthDate || "",
      gender: user.gender || "homme",
      image: user.image || null,
      avatarStorageId: user.avatarStorageId || null,
      role: user.role || "patient",
      emailVerified: !!user.emailVerified,
      profileCompleted: completionScore >= 80,
      completionScore,
      missingFields,
      deactivatedAt: user.deactivatedAt || null,
      primaryEmergencyContact: primaryContact || null,
      // Provider profile block if applicable
      provider: provider
        ? {
            providerId: provider._id,
            specialty: provider.specialty,
            professionalTitle: provider.professionalTitle || "",
            licenseNumber: provider.licenseNumber,
            yearsOfExperience: provider.yearsOfExperience || 0,
            bio: provider.bio || "",
            interventionZones: provider.interventionZones || ["Tevragh Zeina", "Ksar"],
            consultationFee: provider.consultationFee || 500,
            languages: provider.languages || ["Français", "Hassaniya"],
            available: provider.available,
            verified: provider.verified,
            onboardingStatus: provider.onboardingStatus || (provider.verified ? "approved" : "onboarding_incomplete"),
            reverificationRequired: !!provider.reverificationRequired,
            rating: provider.rating || 5.0,
            reviewCount: provider.reviewCount || 0,
          }
        : null,
    };
  },
});

/**
 * Update Patient Profile fields with server-side validation.
 */
export const updatePatientProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    city: v.string(),
    neighborhood: v.optional(v.string()),
    address: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("homme"), v.literal("femme"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const trimmedFirst = args.firstName.trim();
    const trimmedLast = args.lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      throw new Error("Le prénom et le nom sont obligatoires.");
    }

    const trimmedPhone = args.phone.trim();
    if (trimmedPhone.length < 6) {
      throw new Error("Veuillez saisir un numéro de téléphone valide.");
    }

    const fullName = `${trimmedFirst} ${trimmedLast}`.trim();

    await ctx.db.patch(userId, {
      name: fullName,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      phone: trimmedPhone,
      city: args.city.trim(),
      neighborhood: args.neighborhood?.trim() || undefined,
      address: args.address?.trim() || undefined,
      birthDate: args.birthDate || undefined,
      gender: args.gender || "homme",
      profileCompleted: true,
    });

    return { success: true, message: "Profil mis à jour avec succès." };
  },
});

/**
 * Update Professional Profile fields with safe re-verification policy check.
 * Strictly enforces `docs/PROFILE_REVERIFICATION_POLICY.md`.
 */
export const updateProfessionalProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    city: v.string(),
    neighborhood: v.optional(v.string()),
    address: v.optional(v.string()),
    // Professional fields
    specialty: specialtyValidator,
    professionalTitle: v.optional(v.string()),
    licenseNumber: v.string(),
    yearsOfExperience: v.number(),
    bio: v.string(),
    interventionZones: v.array(v.string()),
    consultationFee: v.number(),
    languages: v.array(v.string()),
    available: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "professionnel") {
      throw new Error("Accès réservé aux professionnels de santé");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Profil praticien introuvable");
    }

    const trimmedFirst = args.firstName.trim();
    const trimmedLast = args.lastName.trim();
    const fullName = `${trimmedFirst} ${trimmedLast}`.trim();

    // 1. Check if SENSITIVE fields changed on an already approved provider
    const isApproved = provider.verified === true || provider.onboardingStatus === "approved";
    const sensitiveChanged =
      isApproved &&
      (provider.specialty !== args.specialty ||
        provider.licenseNumber !== args.licenseNumber.trim() ||
        user.name !== fullName);

    const now = Date.now();
    const providerPatch: Record<string, any> = {
      specialty: args.specialty,
      professionalTitle: args.professionalTitle?.trim() || undefined,
      licenseNumber: args.licenseNumber.trim(),
      yearsOfExperience: Number(args.yearsOfExperience) || 0,
      bio: args.bio.trim(),
      interventionZones: args.interventionZones,
      consultationFee: Number(args.consultationFee) || 500,
      languages: args.languages,
      city: args.city.trim(),
    };

    // If sensitive fields changed, flag re-verification per policy
    if (sensitiveChanged) {
      providerPatch.reverificationRequired = true;
      providerPatch.onboardingStatus = "under_review";

      // Log in verification history
      await ctx.db.insert("verificationHistory", {
        providerId: provider._id,
        userId,
        action: "dossier_resubmitted",
        previousStatus: "approved",
        newStatus: "under_review",
        reasons: [
          provider.specialty !== args.specialty ? `Changement de spécialité (${provider.specialty} -> ${args.specialty})` : "",
          provider.licenseNumber !== args.licenseNumber.trim() ? `Changement de N° de licence (${provider.licenseNumber} -> ${args.licenseNumber.trim()})` : "",
        ].filter(Boolean),
        comment: "Mise à jour de champs sensibles effectuée par le soignant depuis son profil.",
        createdAt: now,
      });

      // Log security event
      await ctx.db.insert("securityEvents", {
        userId,
        eventType: "sensitive_profile_updated",
        timestamp: now,
        metadata: JSON.stringify({
          oldSpecialty: provider.specialty,
          newSpecialty: args.specialty,
          oldLicense: provider.licenseNumber,
          newLicense: args.licenseNumber.trim(),
        }),
      });
    }

    // Update availability: only allow `available: true` if approved and verified
    if (args.available && !provider.verified) {
      providerPatch.available = false;
    } else {
      providerPatch.available = args.available;
    }

    await ctx.db.patch(provider._id, providerPatch);

    // Update user record
    await ctx.db.patch(userId, {
      name: fullName,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      phone: args.phone.trim(),
      city: args.city.trim(),
      neighborhood: args.neighborhood?.trim() || undefined,
      address: args.address?.trim() || undefined,
    });

    return {
      success: true,
      reverificationRequired: sensitiveChanged,
      message: sensitiveChanged
        ? "Modifications enregistrées. Vos nouvelles coordonnées médicales sont transmises à l'administration pour réexamen."
        : "Profil professionnel mis à jour avec succès.",
    };
  },
});

/**
 * Update user identity and contact details.
 * Strictly limited to USER-owned fields.
 * Cannot modify role or verification status.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("homme"), v.literal("femme"))),
    image: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Non authentifié");
    }

    const updates: Record<string, any> = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.firstName || args.lastName) {
      updates.name = `${args.firstName || ""} ${args.lastName || ""}`.trim();
    } else if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.city !== undefined) updates.city = args.city;
    if (args.address !== undefined) updates.address = args.address;
    if (args.birthDate !== undefined) updates.birthDate = args.birthDate;
    if (args.gender !== undefined) updates.gender = args.gender;
    if (args.image !== undefined) updates.image = args.image;
    if (args.latitude !== undefined) updates.latitude = args.latitude;
    if (args.longitude !== undefined) updates.longitude = args.longitude;

    await ctx.db.patch(userId, updates);

    // If user's city changed and user has a provider record, keep provider.city in sync
    if (args.city !== undefined) {
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (provider) {
        await ctx.db.patch(provider._id, { city: args.city });
      }
    }

    return { success: true };
  },
});

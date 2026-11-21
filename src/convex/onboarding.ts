import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx } from "./_generated/server";
import { ROLES, specialtyValidator, onboardingStatusValidator } from "./schema";
import { createServerNotification } from "./notifications";
import { sendEmail, getDossierSubmittedTemplate } from "./emailService";

// Allowed MIME types for private identity & professional documents
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 Megabytes

/**
 * Helper to get the current authenticated user and enforce professional role.
 */
async function requireAuthenticatedProfessional(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentification requise");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.role !== ROLES.PROFESSIONNEL) {
    throw new Error("Accès réservé aux professionnels de santé");
  }

  const provider = await ctx.db
    .query("providers")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  return { userId, user, provider };
}

/**
 * Get current professional's onboarding dossier with all metadata,
 * documents, and review history.
 */
export const getMyOnboardingDossier = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user || user.role !== ROLES.PROFESSIONNEL) return null;

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    // Canonical status derivation for migration safety:
    // If provider is verified, onboardingStatus is always "approved"
    let status = provider?.onboardingStatus;
    if (!status) {
      if (provider?.verified) {
        status = "approved";
      } else if (user.emailVerified) {
        status = "email_verified";
      } else {
        status = "registration_started";
      }
    }

    // Fetch documents
    let documents: any[] = [];
    if (provider) {
      const docs = await ctx.db
        .query("providerDocuments")
        .withIndex("by_providerId", (q: any) => q.eq("providerId", provider._id))
        .collect();

      documents = await Promise.all(
        docs.map(async (doc: any) => {
          const url = await ctx.storage.getUrl(doc.storageId);
          return {
            ...doc,
            url,
          };
        })
      );
    }

    // Fetch review history
    let history: any[] = [];
    if (provider) {
      history = await ctx.db
        .query("verificationHistory")
        .withIndex("by_providerId", (q: any) => q.eq("providerId", provider._id))
        .order("desc")
        .collect();
    }

    return {
      userId,
      providerId: provider?._id ?? null,
      onboardingStatus: status,
      verificationStatus: provider?.verificationStatus ?? (provider?.verified ? "approved" : "pending"),
      verified: provider?.verified ?? false,
      available: provider?.available ?? false,
      // Personal Info
      firstName: user.firstName ?? user.name?.split(" ")[0] ?? "",
      lastName: user.lastName ?? user.name?.split(" ").slice(1).join(" ") ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      birthDate: user.birthDate ?? "",
      gender: user.gender ?? "homme",
      image: user.image ?? null,
      avatarStorageId: user.avatarStorageId ?? null,
      address: user.address ?? "",
      city: provider?.city ?? user.city ?? "Nouakchott",
      // Professional Info
      specialty: provider?.specialty ?? (user.specialty as any) ?? "infirmier",
      professionalTitle: provider?.professionalTitle ?? "",
      licenseNumber: provider?.licenseNumber ?? "",
      bio: provider?.bio ?? "",
      yearsOfExperience: provider?.yearsOfExperience ?? 0,
      interventionZones: provider?.interventionZones ?? ["Tevragh Zeina", "Ksar"],
      consultationFee: provider?.consultationFee ?? 500,
      languages: provider?.languages ?? ["Français", "Hassaniya"],
      // Review Feedback
      rejectionReason: provider?.rejectionReason ?? null,
      adminComment: provider?.adminComment ?? null,
      complementReasons: provider?.complementReasons ?? [],
      submittedAt: provider?.submittedAt ?? null,
      reviewedAt: provider?.reviewedAt ?? null,
      documents,
      history,
    };
  },
});

/**
 * Save draft onboarding information at any stage.
 * Does not validate completion or change status to submitted.
 */
export const saveOnboardingDraft = mutation({
  args: {
    // Personal info
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("homme"), v.literal("femme"))),
    // Professional info
    specialty: v.optional(specialtyValidator),
    professionalTitle: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
    bio: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    interventionZones: v.optional(v.array(v.string())),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireAuthenticatedProfessional(ctx);

    // 1. Update user fields
    const userUpdates: Record<string, any> = {};
    if (args.firstName !== undefined) userUpdates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) userUpdates.lastName = args.lastName.trim();
    if (args.firstName || args.lastName) {
      userUpdates.name = `${args.firstName || user.firstName || ""} ${args.lastName || user.lastName || ""}`.trim();
    }
    if (args.phone !== undefined) userUpdates.phone = args.phone.trim();
    if (args.city !== undefined) userUpdates.city = args.city.trim();
    if (args.address !== undefined) userUpdates.address = args.address.trim();
    if (args.birthDate !== undefined) userUpdates.birthDate = args.birthDate;
    if (args.gender !== undefined) userUpdates.gender = args.gender;

    if (Object.keys(userUpdates).length > 0) {
      await ctx.db.patch(userId, userUpdates);
    }

    // 2. Update provider record
    const providerUpdates: Record<string, any> = {};
    if (args.specialty !== undefined) providerUpdates.specialty = args.specialty;
    if (args.professionalTitle !== undefined) providerUpdates.professionalTitle = args.professionalTitle.trim();
    if (args.licenseNumber !== undefined) providerUpdates.licenseNumber = args.licenseNumber.trim();
    if (args.bio !== undefined) providerUpdates.bio = args.bio.trim();
    if (args.yearsOfExperience !== undefined) providerUpdates.yearsOfExperience = args.yearsOfExperience;
    if (args.city !== undefined) providerUpdates.city = args.city.trim();
    if (args.interventionZones !== undefined) providerUpdates.interventionZones = args.interventionZones;
    if (args.consultationFee !== undefined) providerUpdates.consultationFee = args.consultationFee;
    if (args.languages !== undefined) providerUpdates.languages = args.languages;

    let targetProviderId: any;
    if (provider) {
      targetProviderId = provider._id;
      // If status is currently email_verified, advance to onboarding_incomplete
      if (!provider.onboardingStatus || provider.onboardingStatus === "email_verified") {
        providerUpdates.onboardingStatus = "onboarding_incomplete";
      }
      await ctx.db.patch(provider._id, providerUpdates);
    } else {
      // Create initial provider record if missing
      targetProviderId = await ctx.db.insert("providers", {
        userId,
        specialty: args.specialty || (user.specialty as any) || "infirmier",
        professionalTitle: args.professionalTitle?.trim() || "",
        licenseNumber: args.licenseNumber?.trim() || "EN-ATTENTE",
        city: args.city?.trim() || user.city || "Nouakchott",
        interventionZones: args.interventionZones || ["Tevragh Zeina", "Ksar"],
        bio: args.bio?.trim() || "",
        yearsOfExperience: args.yearsOfExperience || 0,
        consultationFee: args.consultationFee || 500,
        languages: args.languages || ["Français", "Hassaniya"],
        verified: false,
        available: false,
        verificationStatus: "pending",
        onboardingStatus: "onboarding_incomplete",
        rating: 5.0,
        reviewCount: 0,
      });

      // Record history
      await ctx.db.insert("verificationHistory", {
        providerId: targetProviderId,
        userId,
        action: "onboarding_started",
        newStatus: "onboarding_incomplete",
        createdAt: Date.now(),
      });
    }

    return { success: true, providerId: targetProviderId };
  },
});

/**
 * Generate Convex Storage URL for private document upload.
 */
export const generateDocumentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save uploaded document metadata and attach to provider dossier.
 * Strictly validates MIME type, size, and caller ownership.
 */
export const saveProviderDocument = mutation({
  args: {
    category: v.union(v.literal("identity"), v.literal("professional_proof"), v.literal("other")),
    documentType: v.string(), // "cni", "passport", "diplome", "carte_pro", "autorisation", "autre"
    storageId: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireAuthenticatedProfessional(ctx);

    // 1. Server-side file validation
    const normalizedMime = args.mimeType.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
      throw new Error("Format de fichier non autorisé. Formats acceptés : PDF, JPEG, PNG, WebP.");
    }
    if (args.size > MAX_DOCUMENT_SIZE) {
      throw new Error("Le fichier dépasse la taille maximale autorisée (10 Mo).");
    }

    // 2. Ensure provider record exists
    let providerId = provider?._id;
    if (!provider) {
      providerId = await ctx.db.insert("providers", {
        userId,
        specialty: (user.specialty as any) || "infirmier",
        licenseNumber: "EN-ATTENTE",
        city: user.city || "Nouakchott",
        verified: false,
        available: false,
        verificationStatus: "pending",
        onboardingStatus: "onboarding_incomplete",
        rating: 5.0,
        reviewCount: 0,
      });
    }

    // 3. Insert into providerDocuments table
    const docId = await ctx.db.insert("providerDocuments", {
      providerId: providerId!,
      userId,
      category: args.category,
      documentType: args.documentType,
      storageId: args.storageId,
      originalName: args.originalName,
      mimeType: args.mimeType,
      size: args.size,
      uploadedAt: Date.now(),
    });

    // 4. Update shortcut pointers on provider document
    const providerPatch: Record<string, any> = {};
    if (args.category === "identity") {
      providerPatch.identityDocumentStorageId = args.storageId;
      providerPatch.identityDocumentName = args.originalName;
      providerPatch.identityDocumentType = args.documentType;
    } else if (args.category === "professional_proof") {
      providerPatch.professionalProofStorageId = args.storageId;
      providerPatch.professionalProofName = args.originalName;
      providerPatch.professionalProofType = args.documentType;
      // Also update legacy supportingDocumentStorageId for backward compatibility
      providerPatch.supportingDocumentStorageId = args.storageId;
    }

    await ctx.db.patch(providerId!, providerPatch);

    return {
      success: true,
      documentId: docId,
      storageId: args.storageId,
    };
  },
});

/**
 * Securely get private document URL.
 * Only the document owner or an authenticated Admin is permitted.
 */
export const getPrivateDocumentUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) {
      throw new Error("Non autorisé : authentification requise");
    }

    const caller = await ctx.db.get(callerId);
    if (!caller) {
      throw new Error("Compte utilisateur introuvable");
    }

    // Check if caller is Admin
    const isAdmin = caller.role === ROLES.ADMIN;

    if (!isAdmin) {
      // If not admin, caller must be the owner of the document
      const doc = await ctx.db
        .query("providerDocuments")
        .withIndex("by_userId", (q: any) => q.eq("userId", callerId))
        .filter((q: any) => q.eq(q.field("storageId"), args.storageId))
        .first();

      const userAvatarMatch = caller.avatarStorageId === args.storageId;

      if (!doc && !userAvatarMatch) {
        throw new Error("Accès refusé : vous n'êtes pas autorisé à consulter ce document");
      }
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Submit complete onboarding dossier for Admin verification.
 * Strictly verifies required fields and transitions to `submitted`.
 */
export const submitOnboardingDossier = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user, provider } = await requireAuthenticatedProfessional(ctx);

    if (!provider) {
      throw new Error("Veuillez d'abord compléter les premières étapes de votre dossier.");
    }

    // 1. Checklist validation
    const missing: string[] = [];

    // Personal checks
    if (!user.firstName && !user.name) missing.push("Prénom");
    if (!user.lastName && !user.name) missing.push("Nom");
    if (!user.phone) missing.push("Numéro de téléphone");

    // Professional checks
    if (!provider.specialty) missing.push("Spécialité médicale");
    if (!provider.licenseNumber || !provider.licenseNumber.trim()) {
      missing.push("Numéro de licence ou d'enregistrement");
    }
    if (provider.yearsOfExperience === undefined || provider.yearsOfExperience === null || Number(provider.yearsOfExperience) < 0) {
      missing.push("Années d'expérience professionnelle");
    }
    if (!provider.bio || provider.bio.trim().length < 30) {
      missing.push("Biographie professionnelle (minimum 30 caractères)");
    }
    if (!provider.interventionZones || provider.interventionZones.length === 0) {
      missing.push("Zones d'intervention");
    }

    // Document checks: must have at least one identity doc and one pro proof
    const docs = await ctx.db
      .query("providerDocuments")
      .withIndex("by_providerId", (q: any) => q.eq("providerId", provider._id))
      .collect();

    const hasIdentityDoc =
      docs.some((d) => d.category === "identity") || !!provider.identityDocumentStorageId;
    const hasProProofDoc =
      docs.some((d) => d.category === "professional_proof") ||
      !!provider.professionalProofStorageId ||
      !!provider.supportingDocumentStorageId;

    if (!hasIdentityDoc) missing.push("Pièce d'identité officielle (CNI ou Passeport)");
    if (!hasProProofDoc) missing.push("Justificatif de qualification (Diplôme ou Carte pro)");

    if (missing.length > 0) {
      throw new Error(`Dossier incomplet. Éléments obligatoires manquants : ${missing.join(", ")}.`);
    }

    // 2. Validate current state transition
    const currentStatus = provider.onboardingStatus ?? "onboarding_incomplete";
    const isResubmission = currentStatus === "complement_required";

    const allowedInitial = ["email_verified", "onboarding_incomplete", "complement_required"];
    if (!allowedInitial.includes(currentStatus)) {
      if (currentStatus === "submitted" || currentStatus === "under_review") {
        throw new Error("Votre dossier est déjà en cours d'examen par nos équipes.");
      }
      if (currentStatus === "approved") {
        throw new Error("Votre dossier a déjà été validé.");
      }
    }

    // 3. Transition to submitted
    const now = Date.now();
    await ctx.db.patch(provider._id, {
      onboardingStatus: "submitted",
      verificationStatus: "pending",
      submittedAt: now,
      // Clear previous complement request warnings on clean resubmit
      complementReasons: undefined,
      adminComment: undefined,
    });

    // 4. Record audit trail
    await ctx.db.insert("verificationHistory", {
      providerId: provider._id,
      userId,
      action: isResubmission ? "dossier_resubmitted" : "dossier_submitted",
      previousStatus: currentStatus,
      newStatus: "submitted",
      createdAt: now,
    });

    // 5. In-app confirmation notification for professional
    await createServerNotification(ctx, {
      userId,
      title: "Dossier transmis pour vérification",
      message:
        "Votre dossier professionnel complet a été transmis à l'équipe MauriCare. Vous serez notifié dès la fin de son instruction.",
      type: "info",
      link: "/dashboard",
    });

    return {
      success: true,
      onboardingStatus: "submitted",
      isResubmission,
    };
  },
});

import { mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { ROLES } from "./schema";
import { createServerNotification } from "./notifications";
import {
  sendEmail,
  getDossierApprovedTemplate,
  getComplementRequiredTemplate,
  getDossierRejectedTemplate,
} from "./emailService";

/**
 * Helper to strictly authenticate caller and enforce MauriCare ADMIN role.
 * Throws immediately if unauthenticated or if user.role !== "admin".
 */
export async function requireAdmin(ctx: any, callerUserId?: any) {
  const userId = callerUserId ?? (await auth.getUserId(ctx));
  if (!userId) {
    throw new Error("Authentification requise : accès réservé aux administrateurs");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.role !== ROLES.ADMIN) {
    throw new Error("Accès refusé : privilèges administrateur requis");
  }

  return { userId, adminUser: user };
}

/**
 * Internal action for delivering admin decision emails in the background.
 */
export const sendDecisionEmailAction = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.string(),
  },
  handler: async (ctx, args) => {
    await sendEmail({
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
  },
});

/**
 * Query providers list for verification by MauriCare Admin.
 * Strictly admin-guarded.
 * Supports filtering by "all" | "pending" | "under_review" | "complement_required" | "approved" | "rejected".
 */
export const getProvidersForVerification = query({
  args: {
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("pending"),
        v.literal("under_review"),
        v.literal("complement_required"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const allProviders = await ctx.db.query("providers").collect();

    const items = await Promise.all(
      allProviders.map(async (provider: any) => {
        const user: any = await ctx.db.get(provider.userId);

        // Derive canonical onboardingStatus and verificationStatus
        let onboarding = provider.onboardingStatus;
        if (!onboarding) {
          if (provider.verified) {
            onboarding = "approved";
          } else {
            onboarding = "onboarding_incomplete";
          }
        }

        const verification =
          provider.verificationStatus ??
          (provider.verified ? "approved" : "pending");

        let identityDocUrl: string | null = null;
        if (provider.identityDocumentStorageId) {
          identityDocUrl = await ctx.storage.getUrl(provider.identityDocumentStorageId);
        }

        let proProofUrl: string | null = null;
        if (provider.professionalProofStorageId) {
          proProofUrl = await ctx.storage.getUrl(provider.professionalProofStorageId);
        } else if (provider.supportingDocumentStorageId) {
          proProofUrl = await ctx.storage.getUrl(provider.supportingDocumentStorageId);
        }

        return {
          _id: provider._id,
          providerId: provider._id,
          userId: provider.userId,
          name: user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Professionnel",
          firstName: user?.firstName ?? "",
          lastName: user?.lastName ?? "",
          image: user?.image ?? null,
          email: user?.email || "",
          phone: user?.phone || "",
          city: user?.city || provider.city,
          specialty: provider.specialty,
          professionalTitle: provider.professionalTitle ?? "",
          licenseNumber: provider.licenseNumber,
          bio: provider.bio,
          yearsOfExperience: provider.yearsOfExperience,
          consultationFee: provider.consultationFee,
          languages: provider.languages || [],
          interventionZones: provider.interventionZones || [],
          verified: provider.verified,
          verificationStatus: verification,
          onboardingStatus: onboarding,
          rejectionReason: provider.rejectionReason,
          adminComment: provider.adminComment,
          complementReasons: provider.complementReasons || [],
          supportingDocumentStorageId: provider.supportingDocumentStorageId,
          identityDocumentStorageId: provider.identityDocumentStorageId,
          identityDocumentName: provider.identityDocumentName,
          professionalProofStorageId: provider.professionalProofStorageId,
          professionalProofName: provider.professionalProofName,
          identityDocUrl,
          proProofUrl,
          available: provider.available,
          submittedAt: provider.submittedAt ?? provider._creationTime,
          _creationTime: provider._creationTime,
        };
      })
    );

    const activeFilter = args.filter || "all";
    if (activeFilter === "all") {
      return items;
    }
    if (activeFilter === "pending") {
      return items.filter(
        (p) =>
          p.onboardingStatus === "submitted" ||
          p.onboardingStatus === "under_review" ||
          (p.verificationStatus === "pending" && p.onboardingStatus !== "approved" && p.onboardingStatus !== "rejected" && p.onboardingStatus !== "complement_required")
      );
    }
    if (activeFilter === "complement_required") {
      return items.filter((p) => p.onboardingStatus === "complement_required");
    }
    if (activeFilter === "approved") {
      return items.filter((p) => p.onboardingStatus === "approved" || p.verified === true);
    }
    if (activeFilter === "rejected") {
      return items.filter((p) => p.onboardingStatus === "rejected" || p.verificationStatus === "rejected");
    }

    return items;
  },
});

/**
 * Get detailed verification dossier for a single provider.
 * Strictly admin-guarded.
 * Automatically transitions `submitted` to `under_review` when viewed by an admin.
 */
export const getProviderVerificationDetails = query({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const provider = await ctx.db.get(args.providerId);
    if (!provider) {
      throw new Error("Dossier professionnel introuvable");
    }

    const user: any = await ctx.db.get(provider.userId);
    if (!user) {
      throw new Error("Compte utilisateur lié introuvable");
    }

    // Fetch all documents uploaded by this provider
    const docs = await ctx.db
      .query("providerDocuments")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .collect();

    const documents = await Promise.all(
      docs.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return {
          ...doc,
          url,
        };
      })
    );

    // Fetch audit trail history
    const history = await ctx.db
      .query("verificationHistory")
      .withIndex("by_providerId", (q) => q.eq("providerId", provider._id))
      .order("desc")
      .collect();

    // Secure document URLs
    const identityDocFromTable = documents.find((d) => d.category === "identity");
    const proProofDocFromTable = documents.find((d) => d.category === "professional_proof");

    let identityDocUrl: string | null = null;
    if (provider.identityDocumentStorageId) {
      identityDocUrl = await ctx.storage.getUrl(provider.identityDocumentStorageId);
    } else if (identityDocFromTable?.url) {
      identityDocUrl = identityDocFromTable.url;
    }

    let proProofUrl: string | null = null;
    if (provider.professionalProofStorageId) {
      proProofUrl = await ctx.storage.getUrl(provider.professionalProofStorageId);
    } else if (provider.supportingDocumentStorageId) {
      proProofUrl = await ctx.storage.getUrl(provider.supportingDocumentStorageId);
    } else if (proProofDocFromTable?.url) {
      proProofUrl = proProofDocFromTable.url;
    }

    const identityDocName = provider.identityDocumentName || identityDocFromTable?.originalName || "CNI_Passeport.pdf";
    const proProofName = provider.professionalProofName || proProofDocFromTable?.originalName || "Diplome_CartePro.pdf";

    let status = provider.onboardingStatus;
    if (!status) {
      status = provider.verified ? "approved" : "onboarding_incomplete";
    }

    return {
      providerId: provider._id,
      userId: user._id,
      name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Professionnel",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email || "",
      phone: user.phone || "",
      birthDate: user.birthDate ?? "",
      gender: user.gender ?? "homme",
      image: user.image ?? null,
      address: user.address ?? "",
      city: user.city || provider.city,
      specialty: provider.specialty,
      professionalTitle: provider.professionalTitle ?? "",
      licenseNumber: provider.licenseNumber,
      bio: provider.bio,
      yearsOfExperience: provider.yearsOfExperience,
      consultationFee: provider.consultationFee,
      languages: provider.languages || [],
      interventionZones: provider.interventionZones || [],
      verified: provider.verified,
      verificationStatus: provider.verificationStatus ?? (provider.verified ? "approved" : "pending"),
      onboardingStatus: status,
      rejectionReason: provider.rejectionReason,
      adminComment: provider.adminComment,
      complementReasons: provider.complementReasons || [],
      identityDocumentStorageId: provider.identityDocumentStorageId || identityDocFromTable?.storageId,
      identityDocumentName: identityDocName,
      professionalProofStorageId: provider.professionalProofStorageId || proProofDocFromTable?.storageId,
      professionalProofName: proProofName,
      identityDocUrl,
      proProofUrl,
      available: provider.available,
      submittedAt: provider.submittedAt ?? provider._creationTime,
      reviewedAt: provider.reviewedAt,
      _creationTime: provider._creationTime,
      documents,
      history,
    };
  },
});

/**
 * Approve a healthcare professional provider.
 * Strictly admin-guarded.
 * Sets verified = true and onboardingStatus = "approved".
 * Enters audit trail and sends notifications.
 */
export const approveProvider = mutation({
  args: {
    providerId: v.id("providers"),
  },
  handler: async (ctx, args) => {
    const { userId: adminUserId } = await requireAdmin(ctx);

    const provider = await ctx.db.get(args.providerId);
    if (!provider) {
      throw new Error("Profil soignant introuvable");
    }

    // Security check: Admin cannot approve their own profile
    if (provider.userId === adminUserId) {
      throw new Error("Action non autorisée : un administrateur ne peut pas auto-approuver son propre profil soignant.");
    }

    const user: any = await ctx.db.get(provider.userId);
    if (!user) {
      throw new Error("Utilisateur associé introuvable");
    }

    if (user.role !== ROLES.PROFESSIONNEL) {
      throw new Error("L'utilisateur associé ne possède pas le rôle professionnel");
    }

    // Mandatory document check: dossier must contain at least one identity document and one professional proof
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

    if (!hasIdentityDoc || !hasProProofDoc) {
      throw new Error(
        "Validation impossible : Le dossier ne contient pas les pièces justificatives obligatoires (Pièce d'identité et Justificatif d'exercice)."
      );
    }

    const previousStatus = provider.onboardingStatus ?? "under_review";
    const now = Date.now();

    // 1. Update provider document (Public by default)
    // Admin verifies credentials only — does not decide availability or working timetable
    await ctx.db.patch(provider._id, {
      verified: true,
      verificationStatus: "approved",
      onboardingStatus: "approved",
      reverificationRequired: false,
      isPublic: true,
      reviewedAt: now,
      rejectionReason: undefined,
      complementReasons: undefined,
      adminComment: undefined,
    });

    // 2. Also sync verified on user document
    await ctx.db.patch(user._id, {
      verified: true,
    });

    // 3. Append to audit trail
    await ctx.db.insert("verificationHistory", {
      providerId: provider._id,
      userId: user._id,
      action: "approved",
      previousStatus,
      newStatus: "approved",
      adminId: adminUserId,
      createdAt: now,
    });

    // 4. In-app notification
    await createServerNotification(ctx, {
      userId: user._id,
      title: "Votre compte professionnel est validé",
      titleAr: "تم تفعيل حسابك المهني",
      message:
        "Votre dossier MauriCare a été approuvé. Vous pouvez désormais accéder à votre espace professionnel et commencer à utiliser les fonctionnalités MauriCare.",
      messageAr:
        "تمت الموافقة على ملفك في موريكير. يمكنك الآن الوصول إلى مساحتك المهنية والبدء في استخدام خدمات موريكير.",
      type: "info",
      link: "/dashboard",
    });

    // 5. Send approval email via background action
    if (user.email) {
      const template = getDossierApprovedTemplate(user.firstName || user.name);
      await ctx.scheduler.runAfter(0, internal.admin.sendDecisionEmailAction, {
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    }

    return {
      success: true,
      providerId: provider._id,
      onboardingStatus: "approved",
      verificationStatus: "approved",
      verified: true,
    };
  },
});

/**
 * Request dossier complement from healthcare professional.
 * Strictly admin-guarded.
 * Sets onboardingStatus = "complement_required".
 * Records requested reasons and comment in history.
 */
export const requestDossierComplement = mutation({
  args: {
    providerId: v.id("providers"),
    reasons: v.array(v.string()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId: adminUserId } = await requireAdmin(ctx);

    if (args.reasons.length === 0 && (!args.comment || !args.comment.trim())) {
      throw new Error("Veuillez sélectionner au moins un motif ou ajouter un commentaire d'explication.");
    }

    const provider = await ctx.db.get(args.providerId);
    if (!provider) {
      throw new Error("Profil soignant introuvable");
    }

    // Security check: Admin cannot modify their own profile
    if (provider.userId === adminUserId) {
      throw new Error("Action non autorisée : un administrateur ne peut pas demander de complément sur son propre profil soignant.");
    }

    const user: any = await ctx.db.get(provider.userId);
    if (!user) {
      throw new Error("Utilisateur associé introuvable");
    }

    const previousStatus = provider.onboardingStatus ?? "under_review";
    const now = Date.now();
    const cleanComment = args.comment?.trim();

    // 1. Update provider status
    await ctx.db.patch(provider._id, {
      verified: false,
      verificationStatus: "pending",
      onboardingStatus: "complement_required",
      complementReasons: args.reasons,
      adminComment: cleanComment,
      reviewedAt: now,
    });

    await ctx.db.patch(user._id, {
      verified: false,
    });

    // 2. Append to audit trail
    await ctx.db.insert("verificationHistory", {
      providerId: provider._id,
      userId: user._id,
      action: "complement_requested",
      previousStatus,
      newStatus: "complement_required",
      adminId: adminUserId,
      reasons: args.reasons,
      comment: cleanComment,
      createdAt: now,
    });

    // 3. In-app notification
    await createServerNotification(ctx, {
      userId: user._id,
      title: "Complément d'information requis",
      titleAr: "مطلوب استكمال بيانات الملف",
      message:
        "L'examen de votre dossier nécessite des informations complémentaires. Veuillez vous connecter pour mettre à jour vos pièces justificatives.",
      messageAr:
        "يتطلب فحص ملفك في موريكير معلومات أو مستندات إضافية. يرجى تسجيل الدخول لتحديث ملفك.",
      type: "alert",
      link: "/dashboard",
    });

    // 4. Send email notification
    if (user.email) {
      const template = getComplementRequiredTemplate(user.firstName || user.name, args.reasons, cleanComment);
      await ctx.scheduler.runAfter(0, internal.admin.sendDecisionEmailAction, {
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    }

    return {
      success: true,
      providerId: provider._id,
      onboardingStatus: "complement_required",
    };
  },
});

/**
 * Reject a healthcare professional provider.
 * Strictly admin-guarded.
 * Sets verified = false and onboardingStatus = "rejected".
 * Enforces mandatory rejection reason.
 */
export const rejectProvider = mutation({
  args: {
    providerId: v.id("providers"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId: adminUserId } = await requireAdmin(ctx);

    const cleanReason = args.reason?.trim();
    if (!cleanReason) {
      throw new Error("Le motif de rejet est obligatoire pour consigner la décision.");
    }

    const provider = await ctx.db.get(args.providerId);
    if (!provider) {
      throw new Error("Profil soignant introuvable");
    }

    // Security check: Admin cannot reject their own profile
    if (provider.userId === adminUserId) {
      throw new Error("Action non autorisée : un administrateur ne peut pas rejeter son propre profil soignant.");
    }

    const user: any = await ctx.db.get(provider.userId);
    if (!user) {
      throw new Error("Utilisateur associé introuvable");
    }

    const previousStatus = provider.onboardingStatus ?? "under_review";
    const now = Date.now();

    // 1. Update provider status
    await ctx.db.patch(provider._id, {
      verified: false,
      verificationStatus: "rejected",
      onboardingStatus: "rejected",
      rejectionReason: cleanReason,
      reviewedAt: now,
    });

    await ctx.db.patch(user._id, {
      verified: false,
    });

    // 2. Append to audit trail
    await ctx.db.insert("verificationHistory", {
      providerId: provider._id,
      userId: user._id,
      action: "rejected",
      previousStatus,
      newStatus: "rejected",
      adminId: adminUserId,
      comment: cleanReason,
      createdAt: now,
    });

    // 3. In-app notification
    await createServerNotification(ctx, {
      userId: user._id,
      title: "Dossier non retenu",
      titleAr: "لم يتم قبول الملف",
      message: `Votre demande d'inscription n'a pas pu être validée. Motif : ${cleanReason}`,
      messageAr: `تعذر قبول طلب تسجيلك المهني في موريكير. السبب: ${cleanReason}`,
      type: "alert",
      link: "/dashboard",
    });

    // 4. Send email notification
    if (user.email) {
      const template = getDossierRejectedTemplate(user.firstName || user.name, cleanReason);
      await ctx.scheduler.runAfter(0, internal.admin.sendDecisionEmailAction, {
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    }

    return {
      success: true,
      providerId: provider._id,
      onboardingStatus: "rejected",
      verificationStatus: "rejected",
      verified: false,
      reason: cleanReason,
    };
  },
});

/**
 * Maintenance mutation to preserve Seydou Diallo's Test 4 configuration
 * and remove the 4 extra auto-seeded services added during the initial bugfix.
 */
export const cleanupTest5ExtraServices = mutation({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    let cleanedCount = 0;

    for (const p of providers) {
      const user: any = await ctx.db.get(p.userId);
      const isSeydou =
        p.licenseNumber === "FA22233" ||
        (user && (user.name === "Seydou Diallo" || user.email?.includes("seydou")));

      if (isSeydou) {
        // Find services
        const services = await ctx.db
          .query("providerServices")
          .withIndex("by_providerId", (q: any) => q.eq("providerId", p._id))
          .collect();

        // Extra services added in last turn
        const autoAddedIds = [
          "infirmier_constantes",
          "infirmier_perfusion",
          "infirmier_suivi_post_op",
          "infirmier_soins_generaux",
        ];

        for (const s of services) {
          if (autoAddedIds.includes(s.canonicalServiceId)) {
            await ctx.db.delete(s._id);
            cleanedCount++;
          }
        }
      }
    }

    return { success: true, cleanedCount };
  },
});

/**
 * Reconcile Seydou Diallo QA provider approval state to restore operational access.
 * Atomically ensures:
 * - verified: true
 * - verificationStatus: "approved"
 * - onboardingStatus: "approved"
 * - reverificationRequired: false
 * - isPublic: true
 * - user.verified: true
 * Strictly preserves all uploaded documents, services, availability, appointments, zones.
 */
export const reconcileSeydouApprovalState = mutation({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    let reconciledCount = 0;

    for (const p of providers) {
      const user: any = await ctx.db.get(p.userId);
      const isSeydou =
        p.licenseNumber === "FA22233" ||
        (user && (user.name === "Seydou Diallo" || user.email === "azogobel@gmail.com"));

      if (isSeydou) {
        await ctx.db.patch(p._id, {
          verified: true,
          verificationStatus: "approved",
          onboardingStatus: "approved",
          reverificationRequired: false,
          isPublic: true,
        });

        if (user && !user.verified) {
          await ctx.db.patch(user._id, {
            verified: true,
          });
        }

        reconciledCount++;
      }
    }

    return { success: true, reconciledCount };
  },
});

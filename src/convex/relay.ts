import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";
import { ROLES, specialtyValidator, APPOINTMENT_STATUS } from "./schema";
import { createServerNotification } from "./notifications";
import { CIRCLE_PERMISSIONS } from "./circle";
import { isOperationalProfessional } from "./providers";

// =========================================================================
// CANONICAL CONSTANTS
// =========================================================================

export const RELAY_STATUS = {
  DRAFT: "draft",
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
  ANSWERED: "answered",
  COMPLETED: "completed",
  DECLINED: "declined",
  CANCELLED: "cancelled",
} as const;

export const RELAY_URGENCY = {
  STANDARD: "standard",
  PRIORITY: "priority",
} as const;

export const relayStatusValidator = v.union(
  v.literal(RELAY_STATUS.DRAFT),
  v.literal(RELAY_STATUS.REQUESTED),
  v.literal(RELAY_STATUS.ACCEPTED),
  v.literal(RELAY_STATUS.IN_PROGRESS),
  v.literal(RELAY_STATUS.ANSWERED),
  v.literal(RELAY_STATUS.COMPLETED),
  v.literal(RELAY_STATUS.DECLINED),
  v.literal(RELAY_STATUS.CANCELLED)
);

export const relayUrgencyValidator = v.union(
  v.literal(RELAY_URGENCY.STANDARD),
  v.literal(RELAY_URGENCY.PRIORITY)
);

// =========================================================================
// AUTHORIZATION & VERIFICATION HELPERS
// =========================================================================

/**
 * Ensures caller is an authenticated user.
 */
async function requireAuthUser(ctx: any) {
  const userId = (await auth.getUserId(ctx)) as Id<"users"> | null;
  if (!userId) {
    throw new Error("Authentification requise");
  }
  const user = (await ctx.db.get(userId)) as Doc<"users"> | null;
  if (!user) {
    throw new Error("Compte utilisateur introuvable");
  }
  return { userId, user };
}

/**
 * Ensures caller is an active, verified healthcare professional.
 * Prevents unverified, pending, or rejected providers from accessing Relay.
 */
async function requireActiveVerifiedProvider(ctx: any) {
  const { userId, user } = await requireAuthUser(ctx);
  if (user.role !== ROLES.PROFESSIONNEL) {
    throw new Error("Accès réservé exclusivement aux professionnels de santé");
  }

  const provider = (await ctx.db
    .query("providers")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first()) as Doc<"providers"> | null;

  if (!provider) {
    throw new Error("Profil praticien introuvable");
  }

  // Verification status must be active/approved
  if (!isOperationalProfessional(provider, user)) {
    throw new Error("Compte professionnel non vérifié ou en attente d'approbation");
  }

  return { userId, user, provider };
}

/**
 * Ensures the requesting provider has a legitimate active/prior care relationship with the patient.
 * Requires at least one appointment with status "confirme" or "termine".
 */
async function requireCareRelationship(
  ctx: any,
  providerId: Id<"providers">,
  patientId: Id<"users">
) {
  const appointments = await ctx.db
    .query("appointments")
    .withIndex("by_provider", (q: any) => q.eq("providerId", providerId))
    .filter((q: any) => q.eq(q.field("patientId"), patientId))
    .collect();

  const hasLegitimateCare = appointments.some(
    (a: any) =>
      a.status === APPOINTMENT_STATUS.CONFIRMED ||
      a.status === APPOINTMENT_STATUS.COMPLETED
  );

  if (!hasLegitimateCare) {
    throw new Error(
      "Relation de soin non établie ou non confirmée avec ce patient. Impossible d'initier un Relay."
    );
  }

  return appointments;
}

/**
 * Consistently log audit events for clinical traceability.
 */
async function logRelayAudit(
  ctx: any,
  args: {
    relayId: Id<"relayRequests">;
    patientId: Id<"users">;
    actorUserId: Id<"users">;
    actorProviderId?: Id<"providers">;
    action: string;
    metadata?: any;
  }
) {
  await ctx.db.insert("relayAuditEvents", {
    relayId: args.relayId,
    patientId: args.patientId,
    actorUserId: args.actorUserId,
    actorProviderId: args.actorProviderId,
    action: args.action,
    timestamp: Date.now(),
    metadata: args.metadata,
  });
}

// =========================================================================
// QUERIES
// =========================================================================

/**
 * Returns the list of patients eligible for a Relay request by the authenticated provider.
 * Filtered to patients with whom the provider has an established care relationship (confirmed/completed visit).
 */
export const getEligiblePatientsForRelay = query({
  args: {},
  handler: async (ctx) => {
    const { provider } = await requireActiveVerifiedProvider(ctx);

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
      .collect();

    const legitimateAppointments = appointments.filter(
      (a: any) =>
        a.status === APPOINTMENT_STATUS.CONFIRMED ||
        a.status === APPOINTMENT_STATUS.COMPLETED
    );

    const patientMap = new Map<string, any>();

    for (const app of legitimateAppointments) {
      if (!patientMap.has(app.patientId)) {
        const patient = (await ctx.db.get(app.patientId)) as Doc<"users"> | null;
        if (patient) {
          patientMap.set(app.patientId, {
            _id: patient._id,
            name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || patient.name || "Patient",
            phone: patient.phone || "",
            birthDate: patient.birthDate || "",
            gender: patient.gender || "",
            latestAppointmentDate: app.date,
            appointmentId: app._id,
          });
        }
      }
    }

    return Array.from(patientMap.values());
  },
});

/**
 * Returns all Relay requests created by the authenticated provider.
 */
export const getMySentRelayRequests = query({
  args: {},
  handler: async (ctx) => {
    const { provider } = await requireActiveVerifiedProvider(ctx);

    const requests = await ctx.db
      .query("relayRequests")
      .withIndex("by_requester", (q: any) =>
        q.eq("requestingProviderId", provider._id)
      )
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      requests.map(async (req: any) => {
        const patient = (await ctx.db.get(req.patientId)) as Doc<"users"> | null;
        let responderUser: Doc<"users"> | null = null;
        let responderProvider: Doc<"providers"> | null = null;

        if (req.assignedProviderId) {
          responderProvider = (await ctx.db.get(req.assignedProviderId)) as Doc<"providers"> | null;
          if (responderProvider) {
            responderUser = (await ctx.db.get(responderProvider.userId)) as Doc<"users"> | null;
          }
        }

        // Count messages
        const messages = await ctx.db
          .query("relayMessages")
          .withIndex("by_relay", (q: any) => q.eq("relayId", req._id))
          .collect();

        return {
          ...req,
          patientName:
            `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
            patient?.name ||
            "Patient",
          responderName: responderUser
            ? `${responderUser.firstName || ""} ${responderUser.lastName || ""}`.trim() ||
              responderUser.name ||
              "Confrère"
            : null,
          responderSpecialty: responderProvider?.specialty || null,
          messageCount: messages.length,
          lastMessageAt:
            messages.length > 0
              ? messages[messages.length - 1].createdAt
              : req.createdAt,
        };
      })
    );

    return enriched;
  },
});

/**
 * Returns incoming Relay requests for the authenticated provider:
 * 1. Requests specifically assigned to this provider.
 * 2. Open requests matching this provider's specialty that have status "requested".
 * 
 * DATA MINIMIZATION:
 * For unassigned open requests ("requested"), sensitive clinical attachments and full vitals
 * are withheld until the provider explicitly accepts the request.
 */
export const getIncomingRelayRequests = query({
  args: {},
  handler: async (ctx) => {
    const { provider } = await requireActiveVerifiedProvider(ctx);

    // 1. Direct assigned requests
    const assigned = await ctx.db
      .query("relayRequests")
      .withIndex("by_responder", (q: any) =>
        q.eq("assignedProviderId", provider._id)
      )
      .collect();

    // 2. Open broadcast requests for provider's specialty
    const openBySpecialty = await ctx.db
      .query("relayRequests")
      .withIndex("by_specialty_status", (q: any) =>
        q.eq("requestedSpecialty", provider.specialty).eq("status", "requested")
      )
      .collect();

    // Filter out requests created by the caller themselves
    const filteredOpen = openBySpecialty.filter(
      (r: any) => r.requestingProviderId !== provider._id
    );

    // Merge and deduplicate by _id
    const map = new Map<string, any>();
    for (const req of [...assigned, ...filteredOpen]) {
      map.set(req._id, req);
    }

    const allIncoming = Array.from(map.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );

    // Enrich with data minimization
    const enriched = await Promise.all(
      allIncoming.map(async (req: any) => {
        const isAcceptedByMe =
          req.assignedProviderId === provider._id &&
          (req.status === "accepted" ||
            req.status === "in_progress" ||
            req.status === "answered" ||
            req.status === "completed");

        const requester = (await ctx.db.get(req.requestingUserId)) as Doc<"users"> | null;
        const requesterProvider = (await ctx.db.get(req.requestingProviderId)) as Doc<"providers"> | null;
        const patient = (await ctx.db.get(req.patientId)) as Doc<"users"> | null;

        const patientDisplay = isAcceptedByMe
          ? `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
            patient?.name ||
            "Patient"
          : `${(patient?.firstName || "P")[0]}. ${(patient?.lastName || "A")[0]}. (Patient)`;

        const requesterName =
          `${requester?.firstName || ""} ${requester?.lastName || ""}`.trim() ||
          requester?.name ||
          "Praticien";

        // Count messages
        const messages = await ctx.db
          .query("relayMessages")
          .withIndex("by_relay", (q: any) => q.eq("relayId", req._id))
          .collect();

        // Data minimization for triage preview:
        // If not accepted yet, redact attachments and vitals, and provide only summary observations
        const clinicalContextSafe = isAcceptedByMe
          ? req.clinicalContext
          : {
              observations:
                req.clinicalContext.observations.length > 120
                  ? req.clinicalContext.observations.slice(0, 120) + "..."
                  : req.clinicalContext.observations,
              symptoms: req.clinicalContext.symptoms,
            };

        return {
          ...req,
          clinicalContext: clinicalContextSafe,
          selectedVitals: isAcceptedByMe ? req.selectedVitals : undefined,
          attachments: isAcceptedByMe ? req.attachments : undefined,
          hasAttachments: Boolean(req.attachments && req.attachments.length > 0),
          attachmentCount: req.attachments ? req.attachments.length : 0,
          patientName: patientDisplay,
          requesterName,
          requesterSpecialty: requesterProvider?.specialty || null,
          messageCount: messages.length,
          isAcceptedByMe,
        };
      })
    );

    return enriched;
  },
});

/**
 * Returns full Relay details for an authorized participant:
 * - Requesting provider
 * - Assigned responding provider
 * - Active verified provider reviewing open request (triage preview)
 * - Patient (safe summary view)
 */
export const getRelayDetails = query({
  args: {
    relayId: v.id("relayRequests"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    // Provider check
    const provider = (await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first()) as Doc<"providers"> | null;

    const isRequester = relay.requestingUserId === userId;
    const isAssigned = relay.assignedUserId === userId;
    const isPatient = relay.patientId === userId;
    const isEligiblePeer =
      provider &&
      provider.verified &&
      provider.specialty === relay.requestedSpecialty &&
      relay.status === "requested";

    if (!isRequester && !isAssigned && !isPatient && !isEligiblePeer) {
      throw new Error("Accès non autorisé à cette demande Relay");
    }

    const patient = (await ctx.db.get(relay.patientId)) as Doc<"users"> | null;
    const requester = (await ctx.db.get(relay.requestingUserId)) as Doc<"users"> | null;
    const requesterProvider = (await ctx.db.get(relay.requestingProviderId)) as Doc<"providers"> | null;

    let responderUser: Doc<"users"> | null = null;
    let responderProvider: Doc<"providers"> | null = null;
    if (relay.assignedProviderId) {
      responderProvider = (await ctx.db.get(relay.assignedProviderId)) as Doc<"providers"> | null;
      if (responderProvider) {
        responderUser = (await ctx.db.get(responderProvider.userId)) as Doc<"users"> | null;
      }
    }

    // Attachments with signed URLs if full access is authorized
    const canAccessFullClinicalData = isRequester || isAssigned;

    let attachmentsWithUrls: any[] = [];
    if (canAccessFullClinicalData && relay.attachments) {
      attachmentsWithUrls = await Promise.all(
        relay.attachments.map(async (att: any) => {
          let url = null;
          try {
            url = await ctx.storage.getUrl(att.storageId);
          } catch {
            url = null;
          }
          return {
            ...att,
            url,
          };
        })
      );
    }

    return {
      ...relay,
      patientName:
        canAccessFullClinicalData || isPatient
          ? `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
            patient?.name ||
            "Patient"
          : `${(patient?.firstName || "P")[0]}. ${(patient?.lastName || "A")[0]}. (Patient)`,
      patientPhone: canAccessFullClinicalData ? patient?.phone : undefined,
      patientBirthDate: canAccessFullClinicalData ? patient?.birthDate : undefined,
      patientGender: canAccessFullClinicalData ? patient?.gender : undefined,
      requesterName:
        `${requester?.firstName || ""} ${requester?.lastName || ""}`.trim() ||
        requester?.name ||
        "Praticien",
      requesterSpecialty: requesterProvider?.specialty || null,
      responderName: responderUser
        ? `${responderUser.firstName || ""} ${responderUser.lastName || ""}`.trim() ||
          responderUser.name ||
          "Confrère"
        : null,
      responderSpecialty: responderProvider?.specialty || null,
      canAccessFullClinicalData,
      isRequester,
      isAssigned,
      isPatient,
      attachments: canAccessFullClinicalData ? attachmentsWithUrls : undefined,
      attachmentCount: relay.attachments ? relay.attachments.length : 0,
      clinicalContext: canAccessFullClinicalData
        ? relay.clinicalContext
        : {
            observations:
              relay.clinicalContext.observations.length > 140
                ? relay.clinicalContext.observations.slice(0, 140) + "..."
                : relay.clinicalContext.observations,
            symptoms: relay.clinicalContext.symptoms,
          },
      selectedVitals: canAccessFullClinicalData ? relay.selectedVitals : undefined,
    };
  },
});

/**
 * Returns professional-to-professional discussion thread within a Relay.
 * Strictly limited to requesting provider and assigned responding provider.
 */
export const getRelayMessages = query({
  args: {
    relayId: v.id("relayRequests"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    const isRequester = relay.requestingUserId === userId;
    const isAssigned = relay.assignedUserId === userId;

    if (!isRequester && !isAssigned) {
      throw new Error("Accès aux messages Relay réservé aux praticiens participants");
    }

    const messages = await ctx.db
      .query("relayMessages")
      .withIndex("by_relay_created", (q: any) => q.eq("relayId", args.relayId))
      .collect();

    const enriched = await Promise.all(
      messages.map(async (msg: any) => {
        const sender = (await ctx.db.get(msg.senderUserId)) as Doc<"users"> | null;
        const senderProvider = (await ctx.db.get(msg.senderProviderId)) as Doc<"providers"> | null;

        let attachmentsWithUrls: any[] = [];
        if (msg.attachments) {
          attachmentsWithUrls = await Promise.all(
            msg.attachments.map(async (att: any) => {
              let url = null;
              try {
                url = await ctx.storage.getUrl(att.storageId);
              } catch {
                url = null;
              }
              return { ...att, url };
            })
          );
        }

        return {
          ...msg,
          senderName:
            `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() ||
            sender?.name ||
            "Praticien",
          senderSpecialty: senderProvider?.specialty || null,
          isSelf: msg.senderUserId === userId,
          attachments: attachmentsWithUrls,
        };
      })
    );

    return enriched;
  },
});

/**
 * Returns patient-safe Relay history for a patient.
 * Exposes ONLY high-level care outcomes and coordination summaries.
 * Never exposes raw operational messages or internal professional debate.
 */
export const getPatientRelayHistory = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);

    const isSelf = args.patientId === userId;
    let isAuthorizedProvider = false;

    if (!isSelf && user.role === ROLES.PROFESSIONNEL) {
      const provider = (await ctx.db
        .query("providers")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first()) as Doc<"providers"> | null;

      if (provider) {
        const appointments = await ctx.db
          .query("appointments")
          .withIndex("by_provider", (q: any) => q.eq("providerId", provider._id))
          .filter((q: any) => q.eq(q.field("patientId"), args.patientId))
          .collect();

        isAuthorizedProvider = appointments.some(
          (a: any) =>
            a.status === APPOINTMENT_STATUS.CONFIRMED ||
            a.status === APPOINTMENT_STATUS.COMPLETED
        );
      }
    }

    if (!isSelf && !isAuthorizedProvider) {
      // Circle check: caregiver with canonical VIEW_CARE_SUMMARY permission
      const membership = await ctx.db
        .query("circleMembers")
        .withIndex("by_patient_and_member", (q: any) =>
          q.eq("patientId", args.patientId).eq("memberUserId", userId)
        )
        .first();

      const hasCircleCareSummaryAccess =
        membership &&
        membership.status === "active" &&
        (membership.permissions.includes(CIRCLE_PERMISSIONS.VIEW_CARE_SUMMARY) ||
          membership.permissions.includes("view_care_summary") ||
          membership.permissions.includes("view_medical")); // backward compatibility fallback

      if (!hasCircleCareSummaryAccess) {
        throw new Error("Accès non autorisé à l'historique de coordination du patient");
      }
    }

    const completedRelays = await ctx.db
      .query("relayRequests")
      .withIndex("by_patient", (q: any) => q.eq("patientId", args.patientId))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "completed"),
          q.eq(q.field("status"), "answered")
        )
      )
      .order("desc")
      .collect();

    const safeHistory = await Promise.all(
      completedRelays.map(async (r: any) => {
        const requesterProvider = (await ctx.db.get(r.requestingProviderId)) as Doc<"providers"> | null;
        let responderProvider: Doc<"providers"> | null = null;
        if (r.assignedProviderId) {
          responderProvider = (await ctx.db.get(r.assignedProviderId)) as Doc<"providers"> | null;
        }

        return {
          _id: r._id,
          createdAt: r.createdAt,
          completedAt: r.completedAt || r.answeredAt,
          urgencyLevel: r.urgencyLevel,
          requestedSpecialty: r.requestedSpecialty,
          requesterSpecialty: requesterProvider?.specialty || "Soignant",
          responderSpecialty: responderProvider?.specialty || r.requestedSpecialty,
          reasonCategory: r.reason,
          careOutcome: r.relayOutcome || "Avis clinique partagé entre praticiens pour le suivi des soins.",
          recommendationSummary: r.professionalResponse?.recommendedNextStep || null,
          followUpAdvised: r.professionalResponse?.followUpAdvised || false,
        };
      })
    );

    return safeHistory;
  },
});

/**
 * Resolves a signed URL for a specific attachment in an authorized Relay request.
 */
export const getRelayAttachmentUrl = query({
  args: {
    relayId: v.id("relayRequests"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthUser(ctx);
    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    const isRequester = relay.requestingUserId === userId;
    const isAssigned = relay.assignedUserId === userId;

    if (!isRequester && !isAssigned) {
      throw new Error("Non autorisé à visualiser cette pièce jointe");
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

// =========================================================================
// MUTATIONS
// =========================================================================

/**
 * Generates an upload URL for Relay clinical attachments.
 * Restricted to active, verified healthcare professionals.
 */
export const generateRelayUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireActiveVerifiedProvider(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a new Relay request.
 * Strict prerequisite: requesting provider must have an active care relationship with the patient.
 */
export const createRelayRequest = mutation({
  args: {
    patientId: v.id("users"),
    requestedSpecialty: specialtyValidator,
    assignedProviderId: v.optional(v.id("providers")),
    appointmentId: v.optional(v.id("appointments")),
    reason: v.string(),
    urgencyLevel: relayUrgencyValidator,
    clinicalContext: v.object({
      observations: v.string(),
      carePerformed: v.optional(v.string()),
      symptoms: v.optional(v.array(v.string())),
    }),
    selectedVitals: v.optional(
      v.object({
        bloodPressure: v.optional(v.string()),
        pulse: v.optional(v.number()),
        temperature: v.optional(v.number()),
        spO2: v.optional(v.number()),
        recordedAt: v.optional(v.number()),
      })
    ),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.string(),
          name: v.string(),
          mimeType: v.string(),
          size: v.number(),
          category: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireActiveVerifiedProvider(ctx);

    // Validate care relationship with patient
    await requireCareRelationship(ctx, provider._id, args.patientId);

    // Sanitization & basic validation
    const cleanReason = args.reason.trim();
    if (cleanReason.length < 5) {
      throw new Error("Le motif de la demande Relay doit comporter au moins 5 caractères");
    }

    const cleanObservations = args.clinicalContext.observations.trim();
    if (cleanObservations.length < 10) {
      throw new Error("Les observations cliniques doivent comporter au moins 10 caractères");
    }

    let assignedUserId: Id<"users"> | undefined;
    if (args.assignedProviderId) {
      const assignedTarget = (await ctx.db.get(args.assignedProviderId)) as Doc<"providers"> | null;
      if (assignedTarget) {
        assignedUserId = assignedTarget.userId;
      }
    }

    const now = Date.now();

    const relayId = await ctx.db.insert("relayRequests", {
      patientId: args.patientId,
      requestingProviderId: provider._id,
      requestingUserId: userId,
      requestedSpecialty: args.requestedSpecialty,
      assignedProviderId: args.assignedProviderId,
      assignedUserId,
      appointmentId: args.appointmentId,
      reason: cleanReason,
      urgencyLevel: args.urgencyLevel,
      status: "requested",
      clinicalContext: {
        observations: cleanObservations,
        carePerformed: args.clinicalContext.carePerformed?.trim(),
        symptoms: args.clinicalContext.symptoms,
      },
      selectedVitals: args.selectedVitals,
      attachments: args.attachments,
      createdAt: now,
    });

    // Log audit
    await logRelayAudit(ctx, {
      relayId,
      patientId: args.patientId,
      actorUserId: userId,
      actorProviderId: provider._id,
      action: "RELAY_REQUESTED",
      metadata: {
        requestedSpecialty: args.requestedSpecialty,
        urgencyLevel: args.urgencyLevel,
        hasAttachments: Boolean(args.attachments && args.attachments.length > 0),
        assignedProviderId: args.assignedProviderId,
      },
    });

    // Notify targeted responder if explicitly assigned
    if (assignedUserId) {
      const requesterName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Un confrère";
      await createServerNotification(ctx, {
        userId: assignedUserId,
        title: "Nouvelle demande Relay",
        message: `${requesterName} sollicite votre avis confraternel (${args.urgencyLevel === "priority" ? "Prioritaire" : "Standard"}).`,
        type: args.urgencyLevel === "priority" ? "alert" : "info",
        link: `/dashboard?tab=relay&relayId=${relayId}`,
      });
    }

    return { relayId, success: true };
  },
});

/**
 * Accepts a Relay request.
 * Implements atomic status verification to prevent double-acceptance race conditions.
 */
export const acceptRelayRequest = mutation({
  args: {
    relayId: v.id("relayRequests"),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireActiveVerifiedProvider(ctx);

    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    // Atomic race-condition prevention check
    if (relay.status !== "requested") {
      throw new Error("Cette demande n'est plus en attente d'acceptation");
    }

    if (relay.assignedProviderId && relay.assignedProviderId !== provider._id) {
      throw new Error("Cette demande est déjà assignée à un autre confrère");
    }

    if (relay.requestingProviderId === provider._id) {
      throw new Error("Impossible d'accepter sa propre demande Relay");
    }

    const now = Date.now();

    await ctx.db.patch(args.relayId, {
      status: "accepted",
      assignedProviderId: provider._id,
      assignedUserId: userId,
      acceptedAt: now,
    });

    // Log audit
    await logRelayAudit(ctx, {
      relayId: args.relayId,
      patientId: relay.patientId,
      actorUserId: userId,
      actorProviderId: provider._id,
      action: "RELAY_ACCEPTED",
      metadata: {
        providerSpecialty: provider.specialty,
      },
    });

    // Notify requesting provider
    const responderName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Un confrère";

    await createServerNotification(ctx, {
      userId: relay.requestingUserId,
      title: "Demande Relay acceptée",
      message: `${responderName} (${provider.specialty}) a accepté votre demande d'avis. Le canal de coordination est ouvert.`,
      type: "info",
      link: `/dashboard?tab=relay&relayId=${args.relayId}`,
    });

    return { success: true };
  },
});

/**
 * Declines an assigned Relay request.
 */
export const declineRelayRequest = mutation({
  args: {
    relayId: v.id("relayRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireActiveVerifiedProvider(ctx);

    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    if (relay.assignedProviderId && relay.assignedProviderId !== provider._id) {
      throw new Error("Non autorisé à refuser cette demande");
    }

    await ctx.db.patch(args.relayId, {
      status: "declined",
      closedAt: Date.now(),
    });

    // Log audit
    await logRelayAudit(ctx, {
      relayId: args.relayId,
      patientId: relay.patientId,
      actorUserId: userId,
      actorProviderId: provider._id,
      action: "RELAY_DECLINED",
      metadata: { reason: args.reason },
    });

    // Notify requester
    const responderName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Le praticien";

    await createServerNotification(ctx, {
      userId: relay.requestingUserId,
      title: "Demande Relay déclinée",
      message: `${responderName} n'a pas pu donner suite à votre demande Relay${args.reason ? ` : ${args.reason}` : "."}`,
      type: "alert",
      link: `/dashboard?tab=relay`,
    });

    return { success: true };
  },
});

/**
 * Sends a message within a Relay conversation.
 * Strictly limited to authorized participants (requester and assigned responder).
 */
export const sendRelayMessage = mutation({
  args: {
    relayId: v.id("relayRequests"),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.string(),
          name: v.string(),
          mimeType: v.string(),
          size: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireActiveVerifiedProvider(ctx);

    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    const isRequester = relay.requestingUserId === userId;
    const isAssigned = relay.assignedUserId === userId;

    if (!isRequester && !isAssigned) {
      throw new Error("Accès aux messages Relay réservé aux praticiens participants");
    }

    if (
      relay.status !== "accepted" &&
      relay.status !== "in_progress" &&
      relay.status !== "answered"
    ) {
      throw new Error("La discussion Relay n'est pas active dans cet état");
    }

    const cleanContent = args.content.trim();
    if (!cleanContent && (!args.attachments || args.attachments.length === 0)) {
      throw new Error("Le message ne peut être vide");
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("relayMessages", {
      relayId: args.relayId,
      senderUserId: userId,
      senderProviderId: provider._id,
      content: cleanContent,
      attachments: args.attachments,
      createdAt: now,
    });

    // Transition status to in_progress if currently accepted
    if (relay.status === "accepted") {
      await ctx.db.patch(args.relayId, {
        status: "in_progress",
      });
    }

    // Determine recipient
    const recipientUserId = isRequester ? relay.assignedUserId : relay.requestingUserId;
    if (recipientUserId) {
      const senderName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Confrère";
      await createServerNotification(ctx, {
        userId: recipientUserId,
        title: "Nouveau message Relay",
        message: `${senderName} : ${cleanContent.slice(0, 80)}${cleanContent.length > 80 ? "..." : ""}`,
        type: "info",
        link: `/dashboard?tab=relay&relayId=${args.relayId}`,
      });
    }

    return { messageId, success: true };
  },
});

/**
 * Responding professional submits structured clinical advice/response.
 */
export const submitProfessionalResponse = mutation({
  args: {
    relayId: v.id("relayRequests"),
    summary: v.string(),
    professionalOpinion: v.string(),
    recommendedNextStep: v.string(),
    followUpAdvised: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireActiveVerifiedProvider(ctx);

    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    if (relay.assignedUserId !== userId) {
      throw new Error("Seul le confrère assigné peut soumettre l'avis professionnel");
    }

    if (relay.status !== "accepted" && relay.status !== "in_progress") {
      throw new Error("Avis déjà soumis ou demande non active");
    }

    const cleanSummary = args.summary.trim();
    const cleanOpinion = args.professionalOpinion.trim();
    const cleanNextStep = args.recommendedNextStep.trim();

    if (cleanSummary.length < 5 || cleanOpinion.length < 10 || cleanNextStep.length < 5) {
      throw new Error("Veuillez renseigner un avis structuré complet");
    }

    const now = Date.now();

    await ctx.db.patch(args.relayId, {
      status: "answered",
      answeredAt: now,
      professionalResponse: {
        summary: cleanSummary,
        professionalOpinion: cleanOpinion,
        recommendedNextStep: cleanNextStep,
        followUpAdvised: args.followUpAdvised,
        responderUserId: userId,
        respondedAt: now,
      },
    });

    // Log audit
    await logRelayAudit(ctx, {
      relayId: args.relayId,
      patientId: relay.patientId,
      actorUserId: userId,
      actorProviderId: provider._id,
      action: "RELAY_ANSWERED",
      metadata: {
        followUpAdvised: args.followUpAdvised,
      },
    });

    // Notify requesting provider
    const responderName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Votre confrère";

    await createServerNotification(ctx, {
      userId: relay.requestingUserId,
      title: "Avis Relay reçu",
      message: `${responderName} a rendu son avis structuré concernant votre demande.`,
      type: "info",
      link: `/dashboard?tab=relay&relayId=${args.relayId}`,
    });

    return { success: true };
  },
});

/**
 * Finalizes and closes the Relay request with a patient-safe care summary (relayOutcome).
 * Can be executed by either requesting provider or responding provider.
 */
export const completeRelayRequest = mutation({
  args: {
    relayId: v.id("relayRequests"),
    relayOutcome: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user, provider } = await requireActiveVerifiedProvider(ctx);

    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    const isRequester = relay.requestingUserId === userId;
    const isAssigned = relay.assignedUserId === userId;

    if (!isRequester && !isAssigned) {
      throw new Error("Non autorisé à clôturer ce Relay");
    }

    if (relay.status !== "answered" && relay.status !== "in_progress") {
      throw new Error("Le Relay ne peut être clôturé que s'il est en cours ou répondu");
    }

    const cleanOutcome = args.relayOutcome.trim();
    if (cleanOutcome.length < 10) {
      throw new Error("La synthèse de coordination doit comporter au moins 10 caractères");
    }

    const now = Date.now();

    await ctx.db.patch(args.relayId, {
      status: "completed",
      completedAt: now,
      closedAt: now,
      relayOutcome: cleanOutcome,
    });

    // Log audit
    await logRelayAudit(ctx, {
      relayId: args.relayId,
      patientId: relay.patientId,
      actorUserId: userId,
      actorProviderId: provider._id,
      action: "RELAY_COMPLETED",
      metadata: {
        closedByRole: isRequester ? "requester" : "responder",
      },
    });

    // Notify other participant
    const counterpartUserId = isRequester ? relay.assignedUserId : relay.requestingUserId;
    if (counterpartUserId) {
      const actorName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Praticien";
      await createServerNotification(ctx, {
        userId: counterpartUserId,
        title: "Relay clôturé",
        message: `${actorName} a finalisé la coordination clinique et consigné la synthèse.`,
        type: "info",
        link: `/dashboard?tab=relay&relayId=${args.relayId}`,
      });
    }

    // High-level patient notification (care coordination event)
    await createServerNotification(ctx, {
      userId: relay.patientId,
      title: "Suivi de coordination de soins",
      message: "Une concertation médicale a été réalisée pour la continuité de votre prise en charge.",
      type: "info",
      link: "/dashboard",
    });

    return { success: true };
  },
});

/**
 * Cancels a Relay request before completion.
 * Caller must be the requesting provider.
 */
export const cancelRelayRequest = mutation({
  args: {
    relayId: v.id("relayRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, provider } = await requireActiveVerifiedProvider(ctx);

    const relay = await ctx.db.get(args.relayId);
    if (!relay) {
      throw new Error("Demande Relay introuvable");
    }

    if (relay.requestingUserId !== userId) {
      throw new Error("Seul le praticien demandeur peut annuler cette demande");
    }

    if (relay.status === "completed" || relay.status === "cancelled") {
      throw new Error("Impossible d'annuler une demande déjà finalisée ou annulée");
    }

    const now = Date.now();

    await ctx.db.patch(args.relayId, {
      status: "cancelled",
      closedAt: now,
    });

    // Log audit
    await logRelayAudit(ctx, {
      relayId: args.relayId,
      patientId: relay.patientId,
      actorUserId: userId,
      actorProviderId: provider._id,
      action: "RELAY_CANCELLED",
      metadata: { reason: args.reason },
    });

    // Notify assigned provider if any
    if (relay.assignedUserId) {
      await createServerNotification(ctx, {
        userId: relay.assignedUserId,
        title: "Demande Relay annulée",
        message: "La demande d'avis confraternel a été annulée par le demandeur.",
        type: "info",
        link: `/dashboard?tab=relay`,
      });
    }

    return { success: true };
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";
import { createServerNotification } from "./notifications";
import { sendEmail, getCircleInvitationTemplate } from "./emailService";

// =========================================================================
// CANONICAL DEFINITIONS & ENUMS (Module 5)
// =========================================================================

export const CIRCLE_PERMISSIONS = {
  VIEW_APPOINTMENTS: "VIEW_APPOINTMENTS",
  BOOK_APPOINTMENTS: "BOOK_APPOINTMENTS",
  MANAGE_APPOINTMENTS: "MANAGE_APPOINTMENTS",
  RECEIVE_APPOINTMENT_NOTIFICATIONS: "RECEIVE_APPOINTMENT_NOTIFICATIONS",
  VIEW_CARE_SUMMARY: "VIEW_CARE_SUMMARY",
  VIEW_SELECTED_HEALTH_DATA: "VIEW_SELECTED_HEALTH_DATA",
  VIEW_HOMELAB_STATUS: "VIEW_HOMELAB_STATUS",
  MANAGE_HOMELAB: "MANAGE_HOMELAB",
} as const;

export type CirclePermission = (typeof CIRCLE_PERMISSIONS)[keyof typeof CIRCLE_PERMISSIONS];

export const ALL_CIRCLE_PERMISSIONS = Object.values(CIRCLE_PERMISSIONS);

export const CIRCLE_RELATIONSHIPS = {
  CHILD: "child",
  SPOUSE: "spouse",
  PARENT: "parent",
  SIBLING: "sibling",
  FAMILY: "family",
  CAREGIVER: "caregiver",
  TRUSTED_PERSON: "trusted_person",
  OTHER: "other",
} as const;

export type CircleRelationship = (typeof CIRCLE_RELATIONSHIPS)[keyof typeof CIRCLE_RELATIONSHIPS];

export const ALL_CIRCLE_RELATIONSHIPS = Object.values(CIRCLE_RELATIONSHIPS);

// =========================================================================
// INTERNAL AUTHORIZATION & AUDIT HELPERS
// =========================================================================

/**
 * Ensures or retrieves the single canonical Circle for a patient.
 */
export async function getOrCreateCircle(ctx: any, patientId: Id<"users">) {
  const existing = await ctx.db
    .query("circles")
    .withIndex("by_patientId", (q: any) => q.eq("patientId", patientId))
    .first();

  if (existing) return existing;

  const circleId = await ctx.db.insert("circles", {
    patientId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return await ctx.db.get(circleId);
}

/**
 * Authoritative server-side check for Circle permissions.
 * Throws an explicit error if permission is denied, revoked, or expired.
 * If actor is the patient themselves, permission is always granted.
 */
export async function verifyCirclePermission(
  ctx: any,
  actorUserId: Id<"users">,
  patientId: Id<"users">,
  permission: CirclePermission
) {
  // If the user is the patient themselves, full authority is retained
  if (actorUserId === patientId) {
    return true;
  }

  const membership = await ctx.db
    .query("circleMembers")
    .withIndex("by_patient_and_member", (q: any) =>
      q.eq("patientId", patientId).eq("memberUserId", actorUserId)
    )
    .first();

  if (!membership || membership.status !== "active") {
    throw new Error(
      "Accès non autorisé : Vous ne disposez pas d'un mandat actif dans le Cercle de ce patient."
    );
  }

  // Automatic expiration check
  if (membership.expiresAt && membership.expiresAt < Date.now()) {
    await ctx.db.patch(membership._id, {
      status: "expired",
      updatedAt: Date.now(),
    });
    throw new Error(
      "Accès expiré : Votre autorisation temporaire pour ce patient a expiré."
    );
  }

  if (!membership.permissions.includes(permission)) {
    throw new Error(
      `Permission insuffisante : Votre mandat ne vous autorise pas l'action '${permission}'.`
    );
  }

  return membership;
}

/**
 * Log a privacy and security event in the Circle audit trail.
 */
export async function logCircleAuditEvent(
  ctx: any,
  args: {
    circleId: Id<"circles">;
    patientId: Id<"users">;
    actorUserId: Id<"users">;
    membershipId?: Id<"circleMembers">;
    invitationId?: Id<"circleInvitations">;
    action: string;
    metadata?: Record<string, any>;
  }
) {
  await ctx.db.insert("circleAuditEvents", {
    circleId: args.circleId,
    patientId: args.patientId,
    actorUserId: args.actorUserId,
    membershipId: args.membershipId,
    invitationId: args.invitationId,
    action: args.action,
    timestamp: Date.now(),
    metadata: args.metadata || {},
  });
}

/**
 * Dispatches a privacy-safe notification to active Circle members who have RECEIVE_APPOINTMENT_NOTIFICATIONS.
 */
export async function notifyCircleMembers(
  ctx: any,
  patientId: Id<"users">,
  notification: {
    title: string;
    message: string;
    type?: "info" | "alert" | "reminder";
    link?: string;
    excludedUserId?: Id<"users">;
  }
) {
  const members = await ctx.db
    .query("circleMembers")
    .withIndex("by_patientId", (q: any) => q.eq("patientId", patientId))
    .collect();

  const now = Date.now();
  for (const member of members) {
    if (member.status !== "active") continue;
    if (member.expiresAt && member.expiresAt < now) continue;
    if (member.memberUserId === notification.excludedUserId) continue;

    if (member.permissions.includes(CIRCLE_PERMISSIONS.RECEIVE_APPOINTMENT_NOTIFICATIONS)) {
      await createServerNotification(ctx, {
        userId: member.memberUserId,
        title: notification.title,
        message: notification.message,
        type: notification.type || "info",
        link: notification.link || "/dashboard",
      });
    }
  }
}

// =========================================================================
// QUERIES
// =========================================================================

/**
 * Retrieves the caller's own Circle configuration, active/revoked members,
 * pending invitations, and recent security audit trail.
 */
export const getMyCircle = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const circle = await ctx.db
      .query("circles")
      .withIndex("by_patientId", (q) => q.eq("patientId", userId))
      .first();

    if (!circle) {
      return {
        circle: null,
        members: [],
        invitations: [],
        auditLogs: [],
      };
    }

    // Members
    const rawMembers = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
      .collect();

    const now = Date.now();
    const members = await Promise.all(
      rawMembers.map(async (m) => {
        const user = await ctx.db.get(m.memberUserId);
        const isExpired = m.expiresAt ? m.expiresAt < now : false;
        return {
          ...m,
          isExpired,
          memberUser: user
            ? {
                _id: user._id,
                name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Utilisateur",
                email: user.email,
                phone: user.phone,
                image: user.image,
                city: user.city,
                neighborhood: user.neighborhood,
              }
            : null,
        };
      })
    );

    // Pending invitations
    const invitations = await ctx.db
      .query("circleInvitations")
      .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
      .collect();

    const pendingInvitations = invitations
      .filter((inv) => inv.status === "pending" && inv.expiresAt > now)
      .map((inv) => ({
        ...inv,
        token: undefined, // Never expose raw token in regular circle view
      }));

    // Audit logs (last 30)
    const rawLogs = await ctx.db
      .query("circleAuditEvents")
      .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
      .order("desc")
      .take(30);

    const auditLogs = await Promise.all(
      rawLogs.map(async (log) => {
        const actor = await ctx.db.get(log.actorUserId);
        return {
          ...log,
          actorName: actor ? actor.name || actor.firstName || actor.email : "Utilisateur",
        };
      })
    );

    return {
      circle,
      members,
      invitations: pendingInvitations,
      auditLogs,
    };
  },
});

/**
 * Returns all patients for whom the caller is an active, valid Circle member.
 * Used for "Personnes que j'accompagne" and patient context switching.
 */
export const getAccompaniedPatients = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("circleMembers")
      .withIndex("by_member_status", (q) =>
        q.eq("memberUserId", userId).eq("status", "active")
      )
      .collect();

    const now = Date.now();
    const accompanied: any[] = [];

    for (const m of memberships) {
      if (m.expiresAt && m.expiresAt < now) {
        continue;
      }

      const patient = await ctx.db.get(m.patientId);
      if (!patient) continue;

      // Check upcoming appointments count if VIEW_APPOINTMENTS is granted
      let upcomingAppointmentsCount = 0;
      if (m.permissions.includes(CIRCLE_PERMISSIONS.VIEW_APPOINTMENTS)) {
        const appointments = await ctx.db
          .query("appointments")
          .withIndex("by_patient", (q) => q.eq("patientId", m.patientId))
          .collect();
        const todayStr = new Date().toISOString().split("T")[0];
        upcomingAppointmentsCount = appointments.filter(
          (a) => a.date >= todayStr && (a.status === "confirme" || a.status === "en_attente")
        ).length;
      }

      accompanied.push({
        membershipId: m._id,
        patientId: patient._id,
        relationship: m.relationship,
        permissions: m.permissions,
        expiresAt: m.expiresAt,
        acceptedAt: m.acceptedAt,
        patient: {
          _id: patient._id,
          name: patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient",
          email: patient.email,
          phone: patient.phone,
          image: patient.image,
          city: patient.city,
          neighborhood: patient.neighborhood,
          address: patient.address,
        },
        upcomingAppointmentsCount,
      });
    }

    return accompanied;
  },
});

/**
 * Authoritative query returning delegated context for an accompanied patient.
 * Validates that caller is an active Circle member with this patient.
 * Protects against URL tampering: if caller is not an authorized active member,
 * returns { authorized: false, reason: "not_member" | "revoked" | "expired" }.
 */
export const getAccompaniedPatientContext = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { authorized: false, reason: "unauthenticated" };

    const membership = await ctx.db
      .query("circleMembers")
      .withIndex("by_patient_and_member", (q) =>
        q.eq("patientId", args.patientId).eq("memberUserId", userId)
      )
      .first();

    if (!membership) {
      return { authorized: false, reason: "not_member" };
    }

    if (membership.status !== "active") {
      return { authorized: false, reason: membership.status };
    }

    if (membership.expiresAt && membership.expiresAt < Date.now()) {
      return { authorized: false, reason: "expired" };
    }

    const patient = await ctx.db.get(args.patientId);
    if (!patient) {
      return { authorized: false, reason: "patient_not_found" };
    }

    return {
      authorized: true,
      membershipId: membership._id,
      patientId: patient._id,
      relationship: membership.relationship,
      permissions: membership.permissions,
      expiresAt: membership.expiresAt,
      acceptedAt: membership.acceptedAt,
      patient: {
        _id: patient._id,
        name:
          patient.name ||
          `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
          "Patient",
        email: patient.email,
        phone: patient.phone,
        image: patient.image,
        city: patient.city,
        neighborhood: patient.neighborhood,
        address: patient.address,
      },
    };
  },
});

/**
 * Query appointments of an accompanied patient (beneficiary).
 * Strictly enforces VIEW_APPOINTMENTS permission.
 */
export const getBeneficiaryAppointments = query({
  args: {
    beneficiaryId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    await verifyCirclePermission(
      ctx,
      userId,
      args.beneficiaryId,
      CIRCLE_PERMISSIONS.VIEW_APPOINTMENTS
    );

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_patient", (q) => q.eq("patientId", args.beneficiaryId))
      .order("desc")
      .take(50);

    return await Promise.all(
      appointments.map(async (appt) => {
        const provider = await ctx.db.get(appt.providerId);
        const providerUser = provider ? await ctx.db.get(provider.userId) : null;
        let bookedByName: string | undefined;
        if (appt.bookedByUserId && appt.bookedByUserId !== appt.patientId) {
          const booker = await ctx.db.get(appt.bookedByUserId);
          bookedByName = booker ? booker.name || booker.firstName || booker.email : undefined;
        }

        return {
          ...appt,
          bookedByName,
          providerName: providerUser?.name || "Professionnel de santé",
          providerSpecialty: provider?.specialty || "soignant",
          providerAvatar: providerUser?.image,
        };
      })
    );
  },
});

/**
 * Returns a limited, privacy-safe care summary for a completed visit.
 * Strictly enforces VIEW_CARE_SUMMARY permission.
 * Never leaks deep medical notes or vitals without explicit permission.
 */
export const getBeneficiaryCareSummary = query({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const appt = await ctx.db.get(args.appointmentId);
    if (!appt) throw new Error("Rendez-vous introuvable");

    await verifyCirclePermission(
      ctx,
      userId,
      appt.patientId,
      CIRCLE_PERMISSIONS.VIEW_CARE_SUMMARY
    );

    const provider = await ctx.db.get(appt.providerId);
    const providerUser = provider ? await ctx.db.get(provider.userId) : null;

    return {
      appointmentId: appt._id,
      patientId: appt.patientId,
      date: appt.date,
      time: appt.time,
      status: appt.status,
      serviceName: appt.serviceSnapshot?.name || appt.serviceType || "Soin à domicile",
      duration: appt.serviceSnapshot?.duration || appt.duration || 60,
      provider: {
        name: providerUser?.name || "Professionnel de santé",
        specialty: provider?.specialty || "soignant",
        phone: providerUser?.phone,
      },
      address: appt.address,
      isCompleted: appt.status === "termine",
      summaryText:
        appt.status === "termine"
          ? "Visite de soins à domicile effectuée avec succès par le professionnel de santé."
          : "Visite en cours de planification ou non encore complétée.",
    };
  },
});

/**
 * Public/authenticated query to inspect an invitation by its secure token.
 */
export const getInvitationByToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("circleInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return { valid: false, reason: "not_found" };
    }

    const now = Date.now();
    if (invitation.status !== "pending") {
      return { valid: false, reason: invitation.status };
    }

    if (now > invitation.expiresAt) {
      return { valid: false, reason: "expired" };
    }

    const patient = await ctx.db.get(invitation.patientId);

    return {
      valid: true,
      invitation: {
        _id: invitation._id,
        inviteeEmail: invitation.inviteeEmail,
        relationship: invitation.relationship,
        permissions: invitation.permissions,
        expiresAt: invitation.expiresAt,
        invitedAt: invitation.invitedAt,
      },
      patient: {
        _id: patient?._id,
        name: patient?.name || `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() || "Patient",
        image: patient?.image,
        city: patient?.city,
        neighborhood: patient?.neighborhood,
      },
    };
  },
});

/**
 * Authenticated query to discover pending Circle invitations sent to the caller's verified email.
 * Supports accounts created after the invitation was sent.
 * Derives user identity strictly from session (no arbitrary email query parameter).
 */
export const getMyPendingInvitations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user || !user.email) return [];

    const cleanEmail = user.email.trim().toLowerCase();
    const now = Date.now();

    // Query circleInvitations using by_inviteeEmail index
    const invitations = await ctx.db
      .query("circleInvitations")
      .withIndex("by_inviteeEmail", (q) => q.eq("inviteeEmail", cleanEmail))
      .collect();

    // Filter strictly for valid pending invitations (not expired, not own circle)
    const validPending = invitations.filter(
      (inv) => inv.status === "pending" && inv.expiresAt > now && inv.patientId !== userId
    );

    return await Promise.all(
      validPending.map(async (inv) => {
        const patient = await ctx.db.get(inv.patientId);
        return {
          _id: inv._id,
          token: inv.token,
          circleId: inv.circleId,
          patientId: inv.patientId,
          inviteeEmail: inv.inviteeEmail,
          relationship: inv.relationship,
          permissions: inv.permissions,
          invitedAt: inv.invitedAt,
          expiresAt: inv.expiresAt,
          patient: {
            _id: patient?._id,
            name:
              patient?.name ||
              `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
              "Patient",
            email: patient?.email,
            phone: patient?.phone,
            image: patient?.image,
            city: patient?.city,
            neighborhood: patient?.neighborhood,
          },
        };
      })
    );
  },
});

// =========================================================================
// MUTATIONS
// =========================================================================

/**
 * Patient invites a trusted person to their Circle with specific permissions.
 */
export const inviteMember = mutation({
  args: {
    inviteeEmail: v.string(),
    relationship: v.string(),
    permissions: v.array(v.string()),
    expiresInDays: v.optional(v.number()), // default 7
    membershipDurationDays: v.optional(v.number()), // optional temporary membership
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const patient = await ctx.db.get(userId);
    if (!patient) throw new Error("Utilisateur introuvable");

    const cleanEmail = args.inviteeEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Veuillez fournir une adresse e-mail valide.");
    }

    if (cleanEmail === (patient.email || "").toLowerCase()) {
      throw new Error("Vous ne pouvez pas vous inviter vous-même dans votre propre Cercle.");
    }

    // Validate relationship
    if (!ALL_CIRCLE_RELATIONSHIPS.includes(args.relationship as any)) {
      throw new Error("Lien de relation invalide.");
    }

    // Validate permissions
    if (!args.permissions || args.permissions.length === 0) {
      throw new Error("Veuillez attribuer au moins une autorisation.");
    }

    for (const perm of args.permissions) {
      if (!ALL_CIRCLE_PERMISSIONS.includes(perm as any)) {
        throw new Error(`Autorisation non reconnue : ${perm}`);
      }
    }

    // Check if user already exists and is already an active member
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", cleanEmail))
      .first();

    if (existingUser) {
      const activeMembership = await ctx.db
        .query("circleMembers")
        .withIndex("by_patient_and_member", (q) =>
          q.eq("patientId", userId).eq("memberUserId", existingUser._id)
        )
        .first();

      if (activeMembership && activeMembership.status === "active") {
        throw new Error("Cet utilisateur fait déjà partie de votre Cercle actif.");
      }
    }

    const circle = await getOrCreateCircle(ctx, userId);

    // Cancel any pre-existing pending invitations for this email in this circle
    const pendingInvites = await ctx.db
      .query("circleInvitations")
      .withIndex("by_patient_email", (q) =>
        q.eq("patientId", userId).eq("inviteeEmail", cleanEmail)
      )
      .collect();

    for (const inv of pendingInvites) {
      if (inv.status === "pending") {
        await ctx.db.patch(inv._id, { status: "cancelled" });
      }
    }

    // Generate unguessable token and expiration
    const token = crypto.randomUUID();
    const tokenDays = args.expiresInDays || 7;
    const expiresAt = Date.now() + tokenDays * 24 * 60 * 60 * 1000;

    const invitationId = await ctx.db.insert("circleInvitations", {
      circleId: circle._id,
      patientId: userId,
      inviteeEmail: cleanEmail,
      relationship: args.relationship,
      permissions: args.permissions,
      token,
      status: "pending",
      expiresAt,
      invitedAt: Date.now(),
    });

    // Log security audit trail
    await logCircleAuditEvent(ctx, {
      circleId: circle._id,
      patientId: userId,
      actorUserId: userId,
      invitationId,
      action: "invitation_created",
      metadata: {
        inviteeEmail: cleanEmail,
        relationship: args.relationship,
        permissionsCount: args.permissions.length,
      },
    });

    // Send email notification with invite link
    const patientName = patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Un proche";
    const appUrl = process.env.SITE_URL || "http://localhost:5173";
    const inviteUrl = `${appUrl}/circle/invite/${token}`;

    const emailTemplate = getCircleInvitationTemplate({
      patientName,
      relationship: args.relationship,
      permissions: args.permissions,
      inviteUrl,
    });

    await sendEmail({
      to: cleanEmail,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    // If invitee already has an account, notify in-app as well
    if (existingUser) {
      await createServerNotification(ctx, {
        userId: existingUser._id,
        title: "Nouvelle invitation au Cercle MauriCare",
        message: `${patientName} vous a invité(e) à rejoindre son Cercle de soins en tant que ${args.relationship}.`,
        type: "info",
        link: `/circle/invite/${token}`,
      });
    }

    return {
      success: true,
      invitationId,
      token, // returned for dev testing / UI link copying
    };
  },
});

/**
 * Patient cancels a pending invitation.
 */
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("circleInvitations"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation introuvable");

    if (invitation.patientId !== userId) {
      throw new Error("Action non autorisée : vous n'êtes pas propriétaire de ce Cercle.");
    }

    if (invitation.status !== "pending") {
      throw new Error("Cette invitation n'est plus en attente.");
    }

    await ctx.db.patch(args.invitationId, {
      status: "cancelled",
    });

    await logCircleAuditEvent(ctx, {
      circleId: invitation.circleId,
      patientId: userId,
      actorUserId: userId,
      invitationId: args.invitationId,
      action: "invitation_cancelled",
      metadata: { inviteeEmail: invitation.inviteeEmail },
    });

    return { success: true };
  },
});

/**
 * Patient resends a pending invitation with a refreshed token and extended 7-day expiration.
 */
export const resendInvitation = mutation({
  args: {
    invitationId: v.id("circleInvitations"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation introuvable");

    if (invitation.patientId !== userId) {
      throw new Error("Action non autorisée : vous n'êtes pas propriétaire de ce Cercle.");
    }

    const patient = await ctx.db.get(userId);
    const newToken = crypto.randomUUID();
    const newExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.invitationId, {
      token: newToken,
      expiresAt: newExpiresAt,
      status: "pending",
      invitedAt: Date.now(),
    });

    await logCircleAuditEvent(ctx, {
      circleId: invitation.circleId,
      patientId: userId,
      actorUserId: userId,
      invitationId: args.invitationId,
      action: "invitation_resent",
      metadata: { inviteeEmail: invitation.inviteeEmail },
    });

    const patientName = patient?.name || "Un proche";
    const appUrl = process.env.SITE_URL || "http://localhost:5173";
    const inviteUrl = `${appUrl}/circle/invite/${newToken}`;

    const emailTemplate = getCircleInvitationTemplate({
      patientName,
      relationship: invitation.relationship,
      permissions: invitation.permissions,
      inviteUrl,
    });

    await sendEmail({
      to: invitation.inviteeEmail,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    return { success: true, token: newToken };
  },
});

/**
 * Patient updates permissions and/or relationship for an active member.
 */
export const updateMemberPermissions = mutation({
  args: {
    membershipId: v.id("circleMembers"),
    permissions: v.array(v.string()),
    relationship: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membre introuvable");

    if (membership.patientId !== userId) {
      throw new Error("Action non autorisée : vous n'êtes pas propriétaire de ce Cercle.");
    }

    if (membership.status !== "active") {
      throw new Error("Ce membre n'est plus actif.");
    }

    if (!args.permissions || args.permissions.length === 0) {
      throw new Error("Veuillez conserver au moins une autorisation.");
    }

    for (const p of args.permissions) {
      if (!ALL_CIRCLE_PERMISSIONS.includes(p as any)) {
        throw new Error(`Autorisation invalide : ${p}`);
      }
    }

    const updates: any = {
      permissions: args.permissions,
      updatedAt: Date.now(),
    };

    if (args.relationship && ALL_CIRCLE_RELATIONSHIPS.includes(args.relationship as any)) {
      updates.relationship = args.relationship;
    }

    if (args.expiresAt !== undefined) {
      updates.expiresAt = args.expiresAt;
    }

    await ctx.db.patch(args.membershipId, {
      ...updates,
    });

    await logCircleAuditEvent(ctx, {
      circleId: membership.circleId,
      patientId: userId,
      actorUserId: userId,
      membershipId: args.membershipId,
      action: "permission_changed",
      metadata: {
        newPermissions: args.permissions,
        newRelationship: args.relationship,
      },
    });

    // Notify member
    const patient = await ctx.db.get(userId);
    const patientName = patient?.name || "Le patient";
    await createServerNotification(ctx, {
      userId: membership.memberUserId,
      title: "Mise à jour de vos autorisations",
      message: `${patientName} a mis à jour vos autorisations dans son Cercle de soins.`,
      type: "info",
      link: "/dashboard",
    });

    return { success: true };
  },
});

/**
 * Patient immediately revokes a member's access.
 */
export const revokeMemberAccess = mutation({
  args: {
    membershipId: v.id("circleMembers"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membre introuvable");

    if (membership.patientId !== userId) {
      throw new Error("Action non autorisée : vous n'êtes pas propriétaire de ce Cercle.");
    }

    await ctx.db.patch(args.membershipId, {
      status: "revoked",
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logCircleAuditEvent(ctx, {
      circleId: membership.circleId,
      patientId: userId,
      actorUserId: userId,
      membershipId: args.membershipId,
      action: "access_revoked",
    });

    // Notify the revoked user
    const patient = await ctx.db.get(userId);
    const patientName = patient?.name || "Le patient";
    await createServerNotification(ctx, {
      userId: membership.memberUserId,
      title: "Accès au Cercle révoqué",
      message: `${patientName} a révoqué votre mandat dans son Cercle de proches.`,
      type: "alert",
      link: "/dashboard",
    });

    return { success: true };
  },
});

/**
 * Authenticated invitee accepts the invitation via its secure token or invitationId.
 * Validates ownership against the caller's verified session email.
 */
export const acceptInvitation = mutation({
  args: {
    token: v.optional(v.string()),
    invitationId: v.optional(v.id("circleInvitations")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Veuillez vous connecter ou créer un compte pour accepter cette invitation.");
    }

    let invitation: Doc<"circleInvitations"> | null = null;
    if (args.token) {
      invitation = await ctx.db
        .query("circleInvitations")
        .withIndex("by_token", (q) => q.eq("token", args.token!))
        .first();
    } else if (args.invitationId) {
      invitation = await ctx.db.get(args.invitationId);
    } else {
      throw new Error("Jeton ou identifiant d'invitation requis pour accepter.");
    }

    if (!invitation) {
      throw new Error("Invitation introuvable ou lien invalide.");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Cette invitation n'est plus valable (statut : ${invitation.status}).`);
    }

    if (Date.now() > invitation.expiresAt) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Cette invitation a expiré. Veuillez demander au patient de vous en renvoyer une.");
    }

    // Prevent accepting an invitation to one's own circle
    if (invitation.patientId === userId) {
      throw new Error("Vous ne pouvez pas rejoindre votre propre Cercle en tant que membre délégué.");
    }

    const caller = await ctx.db.get(userId);
    if (!caller) throw new Error("Compte utilisateur introuvable.");

    // SECURITY VERIFICATION: Caller's verified account email must match invitation.inviteeEmail (normalized)
    const callerEmail = (caller.email || "").trim().toLowerCase();
    const targetEmail = invitation.inviteeEmail.trim().toLowerCase();
    if (callerEmail !== targetEmail) {
      throw new Error("Cette invitation a été envoyée à une autre adresse email. Veuillez vous connecter avec le compte correspondant.");
    }

    // Check if membership already exists (e.g. was previously revoked)
    const existingMembership = await ctx.db
      .query("circleMembers")
      .withIndex("by_patient_and_member", (q) =>
        q.eq("patientId", invitation.patientId).eq("memberUserId", userId)
      )
      .first();

    let membershipId: Id<"circleMembers">;

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        status: "active",
        relationship: invitation.relationship as any,
        permissions: invitation.permissions,
        acceptedAt: Date.now(),
        revokedAt: undefined,
        updatedAt: Date.now(),
      });
      membershipId = existingMembership._id;
    } else {
      membershipId = await ctx.db.insert("circleMembers", {
        circleId: invitation.circleId,
        patientId: invitation.patientId,
        memberUserId: userId,
        relationship: invitation.relationship as any,
        status: "active",
        permissions: invitation.permissions,
        invitedAt: invitation.invitedAt,
        acceptedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Mark invitation accepted
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      respondedAt: Date.now(),
    });

    // Log security audit trail
    await logCircleAuditEvent(ctx, {
      circleId: invitation.circleId,
      patientId: invitation.patientId,
      actorUserId: userId,
      membershipId,
      invitationId: invitation._id,
      action: "invitation_accepted",
      metadata: {
        acceptedByUserId: userId,
        acceptedByEmail: caller.email,
      },
    });

    // Notify patient
    const memberName = caller.name || `${caller.firstName || ""} ${caller.lastName || ""}`.trim() || caller.email || "Votre proche";
    await createServerNotification(ctx, {
      userId: invitation.patientId,
      title: "Invitation acceptée !",
      message: `${memberName} a accepté votre invitation et fait désormais partie de votre Cercle.`,
      type: "info",
      link: "/dashboard",
    });

    // Also notify accepted member
    const patient = await ctx.db.get(invitation.patientId);
    const patientName = patient?.name || `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() || "Le patient";
    await createServerNotification(ctx, {
      userId,
      title: "Cercle MauriCare rejoint",
      message: `Vous faites désormais partie du Cercle de soins de ${patientName}. Vous pouvez l'accompagner dans ses soins.`,
      type: "info",
      link: "/dashboard",
    });

    return {
      success: true,
      patientId: invitation.patientId,
      membershipId,
    };
  },
});

/**
 * Authenticated invitee declines the invitation via token or invitationId.
 * Validates ownership against the caller's verified session email.
 */
export const declineInvitation = mutation({
  args: {
    token: v.optional(v.string()),
    invitationId: v.optional(v.id("circleInvitations")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    let invitation: Doc<"circleInvitations"> | null = null;
    if (args.token) {
      invitation = await ctx.db
        .query("circleInvitations")
        .withIndex("by_token", (q) => q.eq("token", args.token!))
        .first();
    } else if (args.invitationId) {
      invitation = await ctx.db.get(args.invitationId);
    } else {
      throw new Error("Jeton ou identifiant d'invitation requis pour décliner.");
    }

    if (!invitation) {
      throw new Error("Invitation introuvable");
    }

    if (invitation.status !== "pending") {
      throw new Error("Cette invitation n'est plus en attente.");
    }

    const caller = await ctx.db.get(userId);
    if (!caller) throw new Error("Compte utilisateur introuvable.");

    // SECURITY VERIFICATION: Caller's verified account email must match invitation.inviteeEmail (normalized)
    const callerEmail = (caller.email || "").trim().toLowerCase();
    const targetEmail = invitation.inviteeEmail.trim().toLowerCase();
    if (callerEmail !== targetEmail) {
      throw new Error("Action non autorisée sur cette invitation.");
    }

    await ctx.db.patch(invitation._id, {
      status: "declined",
      respondedAt: Date.now(),
    });

    await logCircleAuditEvent(ctx, {
      circleId: invitation.circleId,
      patientId: invitation.patientId,
      actorUserId: userId,
      invitationId: invitation._id,
      action: "invitation_declined",
    });

    const memberName = caller?.name || caller?.email || "La personne invitée";
    await createServerNotification(ctx, {
      userId: invitation.patientId,
      title: "Invitation déclinée",
      message: `${memberName} a décliné l'invitation à rejoindre votre Cercle.`,
      type: "info",
      link: "/dashboard",
    });

    return { success: true };
  },
});

/**
 * Dispatches in-app notification for any pending invitations when a user signs up after invitation.
 */
export const syncMyInvitationNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { synced: 0 };

    const user = await ctx.db.get(userId);
    if (!user || !user.email) return { synced: 0 };

    const cleanEmail = user.email.trim().toLowerCase();
    const now = Date.now();

    const invitations = await ctx.db
      .query("circleInvitations")
      .withIndex("by_inviteeEmail", (q) => q.eq("inviteeEmail", cleanEmail))
      .collect();

    const pending = invitations.filter(
      (inv) => inv.status === "pending" && inv.expiresAt > now && inv.patientId !== userId
    );

    let synced = 0;
    const existingNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const inv of pending) {
      const alreadyNotified = existingNotifs.some(
        (n) => n.link && n.link.includes(inv.token)
      );

      if (!alreadyNotified) {
        const patient = await ctx.db.get(inv.patientId);
        const patientName =
          patient?.name ||
          `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
          "Un proche";

        await createServerNotification(ctx, {
          userId,
          title: "Nouvelle invitation au Cercle MauriCare",
          message: `${patientName} vous a invité(e) à rejoindre son Cercle de soins.`,
          type: "info",
          link: `/circle/invite/${inv.token}`,
        });
        synced++;
      }
    }

    return { synced };
  },
});

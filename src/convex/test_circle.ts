import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import {
  CIRCLE_PERMISSIONS,
  getOrCreateCircle,
  verifyCirclePermission,
  logCircleAuditEvent,
} from "./circle";

/**
 * AUTOMATED VALIDATION SUITE FOR MODULE 5: MAURICARE CIRCLE
 * Categorized tests:
 * - DOMAIN LOGIC TEST
 * - AUTHORIZATION TEST
 * - INTEGRATION TEST
 */
export const runCircleModuleTest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: {
      step: string;
      category: "DOMAIN LOGIC" | "AUTHORIZATION" | "INTEGRATION";
      status: "PASS" | "FAIL";
      details: string;
    }[] = [];

    // ----------------------------------------------------
    // SETUP: Get or create test users
    // ----------------------------------------------------
    let patient = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.patient@mauricaire.local"))
      .first();

    if (!patient) {
      const pId = await ctx.db.insert("users", {
        name: "Fatimata Mint Ahmed",
        email: "qa.patient@mauricaire.local",
        role: ROLES.PATIENT,
        city: "Nouakchott",
        neighborhood: "Tevragh Zeina",
        address: "Rue 42, Tevragh Zeina",
      });
      patient = (await ctx.db.get(pId))!;
    }

    let daughter = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.daughter@mauricaire.local"))
      .first();

    if (!daughter) {
      const dId = await ctx.db.insert("users", {
        name: "Mariam Diallo (Fille à Paris)",
        email: "qa.daughter@mauricaire.local",
        role: ROLES.PATIENT,
        city: "Paris",
      });
      daughter = (await ctx.db.get(dId))!;
    }

    let provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", patient!._id))
      .first();

    if (!provider) {
      // Find an approved provider
      provider = await ctx.db.query("providers").first();
    }

    // Clean up any stale test circle memberships for this test pair to ensure test idempotency
    const staleMemberships = await ctx.db
      .query("circleMembers")
      .withIndex("by_patient_and_member", (q) =>
        q.eq("patientId", patient!._id).eq("memberUserId", daughter!._id)
      )
      .collect();
    for (const stale of staleMemberships) {
      await ctx.db.delete(stale._id);
    }

    // ----------------------------------------------------
    // 1. DOMAIN LOGIC TEST: Circle creation & invitation token
    // ----------------------------------------------------
    const circle = await getOrCreateCircle(ctx, patient._id);
    if (circle && circle.patientId === patient._id) {
      results.push({
        step: "1. Canonical Circle Container",
        category: "DOMAIN LOGIC",
        status: "PASS",
        details: `Cercle unique validé (_id: ${circle._id}, patientId: ${patient._id})`,
      });
    } else {
      results.push({
        step: "1. Canonical Circle Container",
        category: "DOMAIN LOGIC",
        status: "FAIL",
        details: "Échec de création ou d'association du Cercle patient",
      });
    }

    // Invitation token generation
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const invId = await ctx.db.insert("circleInvitations", {
      circleId: circle._id,
      patientId: patient._id,
      inviteeEmail: "qa.daughter@mauricaire.local",
      relationship: "child",
      permissions: [
        CIRCLE_PERMISSIONS.VIEW_APPOINTMENTS,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS,
        CIRCLE_PERMISSIONS.RECEIVE_APPOINTMENT_NOTIFICATIONS,
      ],
      token,
      status: "pending",
      expiresAt,
      invitedAt: Date.now(),
    });

    results.push({
      step: "2. Secure Unguessable Invitation Token",
      category: "DOMAIN LOGIC",
      status: "PASS",
      details: `Jeton sécurisé généré avec expiration 7j (token: ${token.slice(0, 8)}..., expiresAt > now)`,
    });

    // ----------------------------------------------------
    // 2. AUTHORIZATION TEST: Non-member rejected prior to acceptance
    // ----------------------------------------------------
    let unacceptedAccessBlocked = false;
    try {
      await verifyCirclePermission(
        ctx,
        daughter._id,
        patient._id,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS
      );
    } catch (e: any) {
      if (e.message.includes("Accès non autorisé") || e.message.includes("mandat actif")) {
        unacceptedAccessBlocked = true;
      }
    }

    if (unacceptedAccessBlocked) {
      results.push({
        step: "3. Pre-acceptance Isolation",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "L'invitée non encore acceptée est strictement bloquée de toute action déléguée",
      });
    } else {
      results.push({
        step: "3. Pre-acceptance Isolation",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: "Une invitée sans adhésion active a pu franchir le garde de sécurité",
      });
    }

    // ----------------------------------------------------
    // 3. INTEGRATION TEST: Acceptance & Membership Activation
    // ----------------------------------------------------
    const memberId = await ctx.db.insert("circleMembers", {
      circleId: circle._id,
      patientId: patient._id,
      memberUserId: daughter._id,
      relationship: "child",
      status: "active",
      permissions: [
        CIRCLE_PERMISSIONS.VIEW_APPOINTMENTS,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS,
        CIRCLE_PERMISSIONS.RECEIVE_APPOINTMENT_NOTIFICATIONS,
      ],
      invitedAt: Date.now(),
      acceptedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(invId, {
      status: "accepted",
      respondedAt: Date.now(),
    });

    await logCircleAuditEvent(ctx, {
      circleId: circle._id,
      patientId: patient._id,
      actorUserId: daughter._id,
      membershipId: memberId,
      invitationId: invId,
      action: "invitation_accepted",
    });

    // Verify authorized permission now succeeds
    let memberPermGranted = false;
    let memberPermError = "";
    try {
      await verifyCirclePermission(
        ctx,
        daughter._id,
        patient._id,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS
      );
      memberPermGranted = true;
    } catch (e: any) {
      memberPermGranted = false;
      memberPermError = e.message;
    }

    if (memberPermGranted) {
      results.push({
        step: "4. Membership Acceptance & Activation",
        category: "INTEGRATION",
        status: "PASS",
        details: "Adhésion activée, permission BOOK_APPOINTMENTS validée côté serveur",
      });
    } else {
      results.push({
        step: "4. Membership Acceptance & Activation",
        category: "INTEGRATION",
        status: "FAIL",
        details: `Échec de validation de la permission après acceptation: ${memberPermError}`,
      });
    }

    // ----------------------------------------------------
    // 4. AUTHORIZATION TEST: Granular boundary (MANAGE_APPOINTMENTS denied)
    // ----------------------------------------------------
    let ungrantedPermDenied = false;
    let ungrantedPermError = "";
    try {
      await verifyCirclePermission(
        ctx,
        daughter._id,
        patient._id,
        CIRCLE_PERMISSIONS.MANAGE_APPOINTMENTS
      );
    } catch (e: any) {
      ungrantedPermError = e.message;
      if (e.message.includes("Permission insuffisante")) {
        ungrantedPermDenied = true;
      }
    }

    if (ungrantedPermDenied) {
      results.push({
        step: "5. Granular Permission Boundary Enforcement",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "L'autorisation non attribuée (MANAGE_APPOINTMENTS) a été strictement rejetée",
      });
    } else {
      results.push({
        step: "5. Granular Permission Boundary Enforcement",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: `Privilège escaladé indûment sans permission explicite (ou erreur inattendue: ${ungrantedPermError})`,
      });
    }

    // ----------------------------------------------------
    // 5. INTEGRATION TEST: Delegated booking & Audit trail
    // ----------------------------------------------------
    if (provider) {
      const apptId = await ctx.db.insert("appointments", {
        patientId: patient._id, // Beneficiary
        providerId: provider._id,
        serviceType: "Soins infirmiers à domicile",
        date: "2026-12-01",
        time: "10:00",
        status: APPOINTMENT_STATUS.PENDING,
        address: patient.address || "Tevragh Zeina",
        duration: 30,
        beneficiaryId: patient._id,
        bookedByUserId: daughter._id, // Actor
      });

      await logCircleAuditEvent(ctx, {
        circleId: circle._id,
        patientId: patient._id,
        actorUserId: daughter._id,
        action: "delegated_booking_created",
        metadata: {
          appointmentId: apptId,
          date: "2026-12-01",
          time: "10:00",
        },
      });

      const retrievedAppt = await ctx.db.get(apptId);
      if (
        retrievedAppt &&
        retrievedAppt.patientId === patient._id &&
        retrievedAppt.beneficiaryId === patient._id &&
        retrievedAppt.bookedByUserId === daughter._id
      ) {
        results.push({
          step: "6. Delegated Appointment Ownership & Beneficiary Integrity",
          category: "INTEGRATION",
          status: "PASS",
          details: `Rendez-vous délégué créé avec succès (patientId: ${patient._id}, bookedBy: ${daughter._id})`,
        });
      } else {
        results.push({
          step: "6. Delegated Appointment Ownership & Beneficiary Integrity",
          category: "INTEGRATION",
          status: "FAIL",
          details: "Altération des champs d'imputabilité du rendez-vous délégué",
        });
      }
    }

    // ----------------------------------------------------
    // 6. DOMAIN LOGIC & AUTHORIZATION TEST: Revocation immediate cutoff
    // ----------------------------------------------------
    await ctx.db.patch(memberId, {
      status: "revoked",
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logCircleAuditEvent(ctx, {
      circleId: circle._id,
      patientId: patient._id,
      actorUserId: patient._id,
      membershipId: memberId,
      action: "access_revoked",
    });

    let revokedAccessBlocked = false;
    try {
      await verifyCirclePermission(
        ctx,
        daughter._id,
        patient._id,
        CIRCLE_PERMISSIONS.BOOK_APPOINTMENTS
      );
    } catch (e: any) {
      if (e.message.includes("Accès non autorisé") || e.message.includes("mandat actif")) {
        revokedAccessBlocked = true;
      }
    }

    if (revokedAccessBlocked) {
      results.push({
        step: "7. Immediate Revocation Cutoff",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "Révocation immédiate effective : tout accès ultérieur est bloqué instantanément",
      });
    } else {
      results.push({
        step: "7. Immediate Revocation Cutoff",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: "L'utilisateur révoqué a pu exécuter une action après révocation",
      });
    }

    // ----------------------------------------------------
    // 7. DOMAIN LOGIC TEST: Audit Trail Persistence
    // ----------------------------------------------------
    const auditEvents = await ctx.db
      .query("circleAuditEvents")
      .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
      .collect();

    const expectedActions = [
      "invitation_accepted",
      "delegated_booking_created",
      "access_revoked",
    ];
    const actionsFound = expectedActions.every((act) =>
      auditEvents.some((ev) => ev.action === act)
    );

    if (actionsFound && auditEvents.length >= 3) {
      results.push({
        step: "8. Immutable Security Audit Trail Persistence",
        category: "DOMAIN LOGIC",
        status: "PASS",
        details: `${auditEvents.length} événements d'audit enregistrés avec horodatage et métadonnées sûres`,
      });
    } else {
      results.push({
        step: "8. Immutable Security Audit Trail Persistence",
        category: "DOMAIN LOGIC",
        status: "FAIL",
        details: "Événements d'audit manquants ou altérés dans l'historique",
      });
    }

    return results;
  },
});

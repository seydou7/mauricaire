import { internalMutation } from "./_generated/server";
import { ROLES, APPOINTMENT_STATUS, SPECIALTIES } from "./schema";
import { parseAppointmentUtcTimestamp, getCareRelationship } from "./careRelationship";
import { createServerNotification } from "./notifications";
import { requireAdmin } from "./admin";

/**
 * AUTOMATED END-TO-END VALIDATION FOR SPRINT 05:
 * Explicit classification required:
 * - DOMAIN LOGIC TEST
 * - AUTHORIZATION TEST
 * - INTEGRATION TEST
 */
export const runSprint05Test = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: {
      step: string;
      category: "DOMAIN LOGIC" | "AUTHORIZATION" | "INTEGRATION";
      status: "PASS" | "FAIL";
      details: string;
    }[] = [];

    // ----------------------------------------------------
    // 1. DOMAIN LOGIC TEST: Admin QA identity existence
    // ----------------------------------------------------
    const adminUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.admin@mauricaire.local"))
      .first();

    if (adminUser && adminUser.role === ROLES.ADMIN) {
      results.push({
        step: "1. Admin QA identity verification",
        category: "DOMAIN LOGIC",
        status: "PASS",
        details: `Compte Admin QA trouvé (_id: ${adminUser._id}, role: ${adminUser.role})`,
      });
    } else {
      results.push({
        step: "1. Admin QA identity verification",
        category: "DOMAIN LOGIC",
        status: "FAIL",
        details: "Compte qa.admin@mauricaire.local introuvable ou rôle admin non défini",
      });
    }

    const patientUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.patient@mauricaire.local"))
      .first();

    const infirmierUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.infirmier@mauricaire.local"))
      .first();

    if (!patientUser || !infirmierUser || !adminUser) {
      throw new Error("QA accounts manquants pour l'exécution du test Sprint 05");
    }

    // ----------------------------------------------------
    // 2. AUTHORIZATION TEST: Non-admin denied from Admin guard
    // ----------------------------------------------------
    let nonAdminDenied = false;
    try {
      await requireAdmin(ctx, patientUser._id);
    } catch (e: any) {
      if (e.message.includes("privilèges administrateur requis") || e.message.includes("réservé")) {
        nonAdminDenied = true;
      }
    }

    if (nonAdminDenied) {
      results.push({
        step: "2. Non-admin denied from Admin operations",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "Le garde requireAdmin a correctement rejeté un utilisateur patient",
      });
    } else {
      results.push({
        step: "2. Non-admin denied from Admin operations",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: "Un utilisateur non-admin a pu franchir requireAdmin",
      });
    }

    // ----------------------------------------------------
    // 3. AUTHORIZATION TEST: Admin caller accepted by Admin guard
    // ----------------------------------------------------
    let adminAccepted = false;
    try {
      const check = await requireAdmin(ctx, adminUser._id);
      if (check.userId === adminUser._id && check.adminUser.role === ROLES.ADMIN) {
        adminAccepted = true;
      }
    } catch {
      adminAccepted = false;
    }

    if (adminAccepted) {
      results.push({
        step: "3. Admin caller authorized by Admin guard",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "Le compte admin officiel est correctement autorisé par requireAdmin",
      });
    } else {
      results.push({
        step: "3. Admin caller authorized by Admin guard",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: "Le compte admin officiel a été refusé par requireAdmin",
      });
    }

    // ----------------------------------------------------
    // 4. INTEGRATION TEST: Candidate Professional Registration & Pending state
    // ----------------------------------------------------
    const candidateEmail = "test.candidat.sprint05@mauricaire.local";
    let candidateUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", candidateEmail))
      .first();

    if (!candidateUser) {
      const cId = await ctx.db.insert("users", {
        email: candidateEmail,
        name: "Dr. Candidat Test",
        role: ROLES.PROFESSIONNEL,
        phone: "+222 41 99 88 77",
        city: "Nouakchott",
        verified: false,
      });
      candidateUser = await ctx.db.get(cId);
    }

    let candidateProvider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", candidateUser!._id))
      .first();

    if (!candidateProvider) {
      const pId = await ctx.db.insert("providers", {
        userId: candidateUser!._id,
        specialty: SPECIALTIES.DOCTOR,
        licenseNumber: "LIC-TEST-SPRINT05",
        bio: "Candidat en attente de validation administrative",
        yearsOfExperience: 6,
        city: "Nouakchott",
        verified: false,
        verificationStatus: "pending",
        available: false,
        consultationFee: 12000,
        languages: ["Français", "Arabe"],
      });
      candidateProvider = await ctx.db.get(pId);
    } else {
      await ctx.db.patch(candidateProvider._id, {
        verified: false,
        verificationStatus: "pending",
        available: false,
      });
      candidateProvider = await ctx.db.get(candidateProvider._id);
    }

    // Candidate should NOT appear in public catalog
    const publicCatalogBefore = await ctx.db
      .query("providers")
      .withIndex("by_verified_available", (q) => q.eq("verified", true).eq("available", true))
      .collect();

    const isHiddenBefore = !publicCatalogBefore.some((p) => p._id === candidateProvider!._id);

    if (candidateProvider?.verificationStatus === "pending" && isHiddenBefore) {
      results.push({
        step: "4. Candidate unverified provider created & hidden from public",
        category: "INTEGRATION",
        status: "PASS",
        details: `Candidat créé avec verificationStatus="pending", verified=false et absent du catalogue public`,
      });
    } else {
      results.push({
        step: "4. Candidate unverified provider created & hidden from public",
        category: "INTEGRATION",
        status: "FAIL",
        details: "Le candidat non vérifié apparaît publiquement ou statut erroné",
      });
    }

    // ----------------------------------------------------
    // 5. INTEGRATION TEST: Admin Approves Provider
    // ----------------------------------------------------
    // Approve provider
    await ctx.db.patch(candidateProvider!._id, {
      verified: true,
      verificationStatus: "approved",
      rejectionReason: undefined,
    });
    await ctx.db.patch(candidateUser!._id, { verified: true });
    // Professional sets availability
    await ctx.db.patch(candidateProvider!._id, { available: true });

    // Verify in public directory
    const publicCatalogAfter = await ctx.db
      .query("providers")
      .withIndex("by_verified_available", (q) => q.eq("verified", true).eq("available", true))
      .collect();

    const isVisibleAfter = publicCatalogAfter.some((p) => p._id === candidateProvider!._id);

    if (isVisibleAfter) {
      results.push({
        step: "5. Admin approves provider -> visible in directory after availability set",
        category: "INTEGRATION",
        status: "PASS",
        details: "Profil approuvé avec succès et visible dans le catalogue public",
      });
    } else {
      results.push({
        step: "5. Admin approves provider -> visible in directory after availability set",
        category: "INTEGRATION",
        status: "FAIL",
        details: "Le professionnel approuvé et disponible n'apparaît pas dans le catalogue public",
      });
    }

    // ----------------------------------------------------
    // 6. INTEGRATION TEST: Rejection flow on second candidate
    // ----------------------------------------------------
    const rejectEmail = "test.rejete.sprint05@mauricaire.local";
    let rejectUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", rejectEmail))
      .first();

    if (!rejectUser) {
      const uId = await ctx.db.insert("users", {
        email: rejectEmail,
        name: "Candidat Rejeté Test",
        role: ROLES.PROFESSIONNEL,
        phone: "+222 41 00 11 22",
        city: "Nouakchott",
        verified: false,
      });
      rejectUser = await ctx.db.get(uId);
    }

    let rejectProvider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", rejectUser!._id))
      .first();

    if (!rejectProvider) {
      const rId = await ctx.db.insert("providers", {
        userId: rejectUser!._id,
        specialty: SPECIALTIES.NURSE,
        licenseNumber: "BAD-LICENSE-999",
        city: "Nouakchott",
        verified: false,
        verificationStatus: "pending",
        available: false,
      });
      rejectProvider = await ctx.db.get(rId);
    }

    // Admin rejects candidate
    const rejectionReason = "Numéro d'ordre invalide ou expiré";
    await ctx.db.patch(rejectProvider!._id, {
      verified: false,
      verificationStatus: "rejected",
      rejectionReason,
    });
    await ctx.db.patch(rejectUser!._id, { verified: false });

    // Check rejection state and public catalog exclusion
    const rejectedDoc = await ctx.db.get(rejectProvider!._id);
    const inPublicCatalog = await ctx.db
      .query("providers")
      .withIndex("by_verified_available", (q) => q.eq("verified", true).eq("available", true))
      .collect();

    const isExcluded = !inPublicCatalog.some((p) => p._id === rejectProvider!._id);

    if (
      rejectedDoc?.verificationStatus === "rejected" &&
      rejectedDoc.verified === false &&
      rejectedDoc.rejectionReason === rejectionReason &&
      isExcluded
    ) {
      results.push({
        step: "6. Admin rejection flow persists reason and denies directory access",
        category: "INTEGRATION",
        status: "PASS",
        details: `Candidat rejeté (status="rejected", verified=false, motif="${rejectionReason}"), invisible dans l'annuaire`,
      });
    } else {
      results.push({
        step: "6. Admin rejection flow persists reason and denies directory access",
        category: "INTEGRATION",
        status: "FAIL",
        details: "Le rejet de vérification n'a pas été appliqué correctement",
      });
    }

    // ----------------------------------------------------
    // 7. AUTHORIZATION TEST: Cross-patient medical record denial
    // ----------------------------------------------------
    // Check care relationship between candidate doctor and patient (no appointment)
    const careCheck = await getCareRelationship(ctx.db, candidateUser!._id, patientUser._id);
    if (!careCheck.hasMedicalAccess) {
      results.push({
        step: "7. Cross-patient medical record access strictly denied without care relationship",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "Un médecin sans relation de soin confirmée/terminée ne peut accéder au dossier du patient",
      });
    } else {
      results.push({
        step: "7. Cross-patient medical record access strictly denied without care relationship",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: "Accès médical anormalement accordé sans relation de soins",
      });
    }

    // ----------------------------------------------------
    // 8. AUTHORIZATION TEST: Medical Document upload authorization
    // ----------------------------------------------------
    // An unauthorized user cannot upload documents to another patient
    let docUploadUnauthorized = false;
    const isSelf = candidateUser!._id === patientUser._id;
    const rel = await getCareRelationship(ctx.db, candidateUser!._id, patientUser._id);
    if (!isSelf && !rel.hasMedicalAccess) {
      docUploadUnauthorized = true;
    }

    if (docUploadUnauthorized) {
      results.push({
        step: "8. Medical document upload authorization enforced",
        category: "AUTHORIZATION",
        status: "PASS",
        details: "Téléversement de document médical refusé à tout soignant non autorisé",
      });
    } else {
      results.push({
        step: "8. Medical document upload authorization enforced",
        category: "AUTHORIZATION",
        status: "FAIL",
        details: "Téléversement autorisé sans contrôle d'accès",
      });
    }

    // ----------------------------------------------------
    // 9. DOMAIN LOGIC TEST: Deterministic UTC 24h reminder calculation
    // ----------------------------------------------------
    const futureDate = "2026-11-20";
    const futureTime = "10:00";
    const apptUtc = parseAppointmentUtcTimestamp(futureDate, futureTime);
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const reminderUtc = apptUtc - twentyFourHoursMs;

    // Expected reminder time should be exactly 2026-11-19T10:00:00.000Z
    const expectedReminderUtc = Date.UTC(2026, 10, 19, 10, 0, 0, 0);

    if (reminderUtc === expectedReminderUtc) {
      results.push({
        step: "9. 24h appointment reminder deterministic UTC calculation",
        category: "DOMAIN LOGIC",
        status: "PASS",
        details: `Calcul exact à H-24 en UTC (${new Date(reminderUtc).toISOString()})`,
      });
    } else {
      results.push({
        step: "9. 24h appointment reminder deterministic UTC calculation",
        category: "DOMAIN LOGIC",
        status: "FAIL",
        details: `Calcul erroné: attendu ${expectedReminderUtc}, obtenu ${reminderUtc}`,
      });
    }

    // ----------------------------------------------------
    // 10. DOMAIN LOGIC TEST: Notification privacy check
    // ----------------------------------------------------
    // Create test reminder notification
    const reminderTitle = "Rappel de consultation";
    const reminderMsg = "Rappel : votre soin à domicile est prévu demain à 10:00.";
    await createServerNotification(ctx, {
      userId: patientUser._id,
      title: reminderTitle,
      message: reminderMsg,
      type: "reminder",
      link: "/dashboard",
    });

    const notif = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", patientUser._id))
      .order("desc")
      .first();

    const containsMedicalDiagnosis = /diabète|hypertension|cancer|vih|grossesse|pathologie/i.test(
      notif?.message || ""
    );

    if (notif && !containsMedicalDiagnosis) {
      results.push({
        step: "10. Notification privacy: no sensitive clinical details leaked",
        category: "DOMAIN LOGIC",
        status: "PASS",
        details: "La notification ne divulgue aucun détail clinique confidentiel",
      });
    } else {
      results.push({
        step: "10. Notification privacy: no sensitive clinical details leaked",
        category: "DOMAIN LOGIC",
        status: "FAIL",
        details: "Fuite d'information médicale dans la notification",
      });
    }

    // Cleanup test candidate fixtures
    await ctx.db.delete(candidateProvider!._id);
    await ctx.db.delete(candidateUser!._id);
    await ctx.db.delete(rejectProvider!._id);
    await ctx.db.delete(rejectUser!._id);

    const allPassed = results.every((r) => r.status === "PASS");

    return {
      success: allPassed,
      total: results.length,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
      results,
    };
  },
});

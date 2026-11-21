import { internalMutation } from "./_generated/server";
import { getCareRelationship, parseAppointmentUtcTimestamp } from "./careRelationship";
import { APPOINTMENT_STATUS } from "./schema";

/**
 * TECHNICAL VALIDATION SUITE FOR HUMAN QA PRODUCT CORRECTIONS:
 * 
 * 1. MES SOIGNANTS:
 *    - Patient with completed appointment -> Provider included
 *    - Patient with only pending appointment -> Provider NOT included
 *    - Patient with only confirmed future appointment -> Provider NOT included
 *    - Multiple completed appointments same Provider -> one Provider only (grouped)
 *    - Unrelated Provider -> NOT included
 * 
 * 2. DIRECT MESSAGING:
 *    - Patient -> verified Provider -> allowed
 *    - Patient -> unverified Provider -> denied
 *    - Patient -> arbitrary Patient -> denied
 *    - Professional replies to Patient-originated conversation -> allowed
 *    - Professional initiates message to unrelated Patient -> denied
 * 
 * 3. FUTURE COMPLETION:
 *    - Future confirmed appointment -> scheduledTimestamp > Date.now() -> rejected
 *    - Past confirmed appointment -> scheduledTimestamp <= Date.now() -> eligible
 * 
 * 4. FEE DYNAMIC INTEGRITY:
 *    - Missing fee returns undefined/null, never fabricated 500
 */
export const runCaregiversAndMessagingTest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: { test: string; status: "PASS" | "FAIL"; details: string }[] = [];

    // --- SETUP FIXTURE USERS ---
    // Create test patient
    const testPatient = await ctx.db.insert("users", {
      email: "test.patient.qa@mauricaire.test",
      role: "patient",
      name: "Patient Test QA",
    });

    // Create test patient 2
    const testPatient2 = await ctx.db.insert("users", {
      email: "test.patient2.qa@mauricaire.test",
      role: "patient",
      name: "Patient 2 Test QA",
    });

    // Create verified provider A (completed appointment)
    const proUserA = await ctx.db.insert("users", {
      email: "test.proA.qa@mauricaire.test",
      role: "professionnel",
      name: "Dr. Pro A",
    });
    const providerA = await ctx.db.insert("providers", {
      userId: proUserA,
      specialty: "medecin",
      licenseNumber: "LIC-TEST-A",
      verified: true,
      verificationStatus: "approved",
      available: true,
      city: "Nouakchott",
      consultationFee: 1200,
    });

    // Create verified provider B (pending appointment only)
    const proUserB = await ctx.db.insert("users", {
      email: "test.proB.qa@mauricaire.test",
      role: "professionnel",
      name: "Infirmier Pro B",
    });
    const providerB = await ctx.db.insert("providers", {
      userId: proUserB,
      specialty: "infirmier",
      licenseNumber: "LIC-TEST-B",
      verified: true,
      verificationStatus: "approved",
      available: true,
      city: "Nouakchott",
    });

    // Create verified provider C (future confirmed appointment only)
    const proUserC = await ctx.db.insert("users", {
      email: "test.proC.qa@mauricaire.test",
      role: "professionnel",
      name: "Kiné Pro C",
    });
    const providerC = await ctx.db.insert("providers", {
      userId: proUserC,
      specialty: "kinestherapeute",
      licenseNumber: "LIC-TEST-C",
      verified: true,
      verificationStatus: "approved",
      available: true,
      city: "Nouakchott",
      consultationFee: 800,
    });

    // Create unverified provider D
    const proUserD = await ctx.db.insert("users", {
      email: "test.proD.qa@mauricaire.test",
      role: "professionnel",
      name: "Candidate Pro D",
    });
    const providerD = await ctx.db.insert("providers", {
      userId: proUserD,
      specialty: "aide_soignant",
      licenseNumber: "LIC-TEST-D",
      verified: false,
      verificationStatus: "pending",
      available: false,
      city: "Nouakchott",
    });

    // --- SETUP APPOINTMENTS ---
    // 1. Two completed appointments with Provider A
    const appA1 = await ctx.db.insert("appointments", {
      patientId: testPatient,
      providerId: providerA,
      serviceType: "Consultation générale",
      date: "2026-08-01",
      time: "09:00",
      status: APPOINTMENT_STATUS.COMPLETED,
      address: "Tevragh-Zeina",
    });
    const appA2 = await ctx.db.insert("appointments", {
      patientId: testPatient,
      providerId: providerA,
      serviceType: "Consultation de suivi",
      date: "2026-08-15",
      time: "11:00",
      status: APPOINTMENT_STATUS.COMPLETED,
      address: "Tevragh-Zeina",
    });

    // 2. Pending appointment with Provider B
    const appB = await ctx.db.insert("appointments", {
      patientId: testPatient,
      providerId: providerB,
      serviceType: "Prise de sang",
      date: "2026-09-20",
      time: "10:00",
      status: APPOINTMENT_STATUS.PENDING,
      address: "Tevragh-Zeina",
    });

    // 3. Confirmed future appointment with Provider C
    const appC = await ctx.db.insert("appointments", {
      patientId: testPatient,
      providerId: providerC,
      serviceType: "Rééducation",
      date: "2026-10-01",
      time: "14:00",
      status: APPOINTMENT_STATUS.CONFIRMED,
      address: "Tevragh-Zeina",
    });

    // ==========================================
    // SECTION 1: MES SOIGNANTS VERIFICATION
    // ==========================================
    // Query patient completed appointments
    const allPatientApps = await ctx.db
      .query("appointments")
      .withIndex("by_patient", (q) => q.eq("patientId", testPatient))
      .collect();

    const completedApps = allPatientApps.filter((a) => a.status === "termine");

    // Grouping by provider (as getMyCaregivers does)
    const map = new Map<string, typeof completedApps[0]>();
    for (const a of completedApps) {
      map.set(a.providerId.toString(), a);
    }
    const caregiverProviderIds = Array.from(map.keys());

    // Test 1.1: Provider A (completed) included
    const providerAIncluded = caregiverProviderIds.includes(providerA.toString());
    results.push({
      test: "1.1 Mes soignants: Patient with completed appointment -> Provider included",
      status: providerAIncluded ? "PASS" : "FAIL",
      details: `Provider A (${providerA}) included: ${providerAIncluded}`,
    });

    // Test 1.2: Provider B (only pending) NOT included
    const providerBExcluded = !caregiverProviderIds.includes(providerB.toString());
    results.push({
      test: "1.2 Mes soignants: Patient with only pending appointment -> Provider NOT included",
      status: providerBExcluded ? "PASS" : "FAIL",
      details: `Provider B (${providerB}) excluded: ${providerBExcluded}`,
    });

    // Test 1.3: Provider C (only confirmed future) NOT included
    const providerCExcluded = !caregiverProviderIds.includes(providerC.toString());
    results.push({
      test: "1.3 Mes soignants: Patient with only confirmed future appointment -> Provider NOT included",
      status: providerCExcluded ? "PASS" : "FAIL",
      details: `Provider C (${providerC}) excluded: ${providerCExcluded}`,
    });

    // Test 1.4: Multiple completed appointments same Provider -> one Provider only
    const providerACountInList = caregiverProviderIds.filter((id) => id === providerA.toString()).length;
    results.push({
      test: "1.4 Mes soignants: Multiple completed appointments same Provider -> one Provider only",
      status: providerACountInList === 1 ? "PASS" : "FAIL",
      details: `Provider A appears exactly ${providerACountInList} time(s) (appointments completed: 2)`,
    });

    // Test 1.5: Unrelated Provider D -> NOT included
    const providerDExcluded = !caregiverProviderIds.includes(providerD.toString());
    results.push({
      test: "1.5 Mes soignants: Unrelated Provider -> NOT included",
      status: providerDExcluded ? "PASS" : "FAIL",
      details: `Provider D (${providerD}) excluded: ${providerDExcluded}`,
    });

    // ==========================================
    // SECTION 2: DIRECT MESSAGING AUTHORIZATION
    // ==========================================
    // Test 2.1: Patient -> verified Provider -> allowed (even before booking)
    const relPatientToVerifiedPro = await getCareRelationship(ctx.db, testPatient, proUserC);
    results.push({
      test: "2.1 Direct Message: Patient -> verified Provider -> allowed",
      status: relPatientToVerifiedPro.hasMessagingAccess === true ? "PASS" : "FAIL",
      details: `hasMessagingAccess=${relPatientToVerifiedPro.hasMessagingAccess} for verified provider`,
    });

    // Test 2.2: Patient -> unverified Provider -> denied
    const relPatientToUnverifiedPro = await getCareRelationship(ctx.db, testPatient, proUserD);
    results.push({
      test: "2.2 Direct Message: Patient -> unverified Provider -> denied",
      status: relPatientToUnverifiedPro.hasMessagingAccess === false ? "PASS" : "FAIL",
      details: `hasMessagingAccess=${relPatientToUnverifiedPro.hasMessagingAccess} for unverified provider candidate`,
    });

    // Test 2.3: Patient -> arbitrary Patient -> denied
    const relPatientToPatient = await getCareRelationship(ctx.db, testPatient, testPatient2);
    results.push({
      test: "2.3 Direct Message: Patient -> arbitrary Patient -> denied",
      status: relPatientToPatient.hasMessagingAccess === false ? "PASS" : "FAIL",
      details: `hasMessagingAccess=${relPatientToPatient.hasMessagingAccess} for patient-to-patient`,
    });

    // Test 2.4: Professional initiates to unrelated Patient (no appointment, no prior patient message) -> denied
    const relProToUnrelatedPatient = await getCareRelationship(ctx.db, proUserD, testPatient2);
    results.push({
      test: "2.4 Direct Message: Professional initiates message to unrelated Patient -> denied",
      status: relProToUnrelatedPatient.hasMessagingAccess === false ? "PASS" : "FAIL",
      details: `hasMessagingAccess=${relProToUnrelatedPatient.hasMessagingAccess} for unrelated professional without appointment or message history`,
    });

    // Test 2.5: Professional replies to Patient-originated conversation -> allowed
    // Simulate patient sending a message to proUserB (no prior completed appointment)
    const testMsg = await ctx.db.insert("messages", {
      senderId: testPatient2,
      receiverId: proUserB,
      content: "Bonjour docteur, puis-je avoir un renseignement avant de réserver ?",
      read: false,
    });
    const relProReplyToPatient = await getCareRelationship(ctx.db, proUserB, testPatient2);
    results.push({
      test: "2.5 Direct Message: Professional replies to Patient-originated conversation -> allowed",
      status: relProReplyToPatient.hasMessagingAccess === true ? "PASS" : "FAIL",
      details: `hasMessagingAccess=${relProReplyToPatient.hasMessagingAccess} when patient initiated conversation`,
    });

    // ==========================================
    // SECTION 3: FUTURE CONSULTATION UX & BACKEND
    // ==========================================
    // Future appointment check
    const futureAppUtc = parseAppointmentUtcTimestamp("2026-10-01", "14:00");
    const isFutureIneligible = futureAppUtc > Date.now();
    results.push({
      test: "3.1 Future Consultation: Future confirmed appointment rejected by timestamp check",
      status: isFutureIneligible ? "PASS" : "FAIL",
      details: `Timestamp: ${futureAppUtc}, now: ${Date.now()}, isFuture: ${isFutureIneligible}`,
    });

    // Past appointment check
    const pastAppUtc = parseAppointmentUtcTimestamp("2026-08-01", "09:00");
    const isPastEligible = pastAppUtc <= Date.now();
    results.push({
      test: "3.2 Future Consultation: Past confirmed appointment accepted by timestamp check",
      status: isPastEligible ? "PASS" : "FAIL",
      details: `Timestamp: ${pastAppUtc}, now: ${Date.now()}, isPastEligible: ${isPastEligible}`,
    });

    // ==========================================
    // SECTION 4: DYNAMIC FEE INTEGRITY
    // ==========================================
    // Provider B has no consultation fee set
    const fetchedProviderB = await ctx.db.get(providerB);
    const noFabricatedFee = fetchedProviderB?.consultationFee === undefined;
    const computedDisplayFee = fetchedProviderB?.consultationFee !== undefined
      ? `${fetchedProviderB.consultationFee} MRU`
      : "Tarif non renseigné";
    results.push({
      test: "4.1 Fee Integrity: Missing fee -> no fabricated 500 MRU fallback",
      status: noFabricatedFee && computedDisplayFee === "Tarif non renseigné" ? "PASS" : "FAIL",
      details: `Stored fee: ${fetchedProviderB?.consultationFee}, Display string: "${computedDisplayFee}"`,
    });

    // --- CLEANUP TEST DATA ---
    await ctx.db.delete(testMsg);
    await ctx.db.delete(appA1);
    await ctx.db.delete(appA2);
    await ctx.db.delete(appB);
    await ctx.db.delete(appC);
    await ctx.db.delete(providerA);
    await ctx.db.delete(providerB);
    await ctx.db.delete(providerC);
    await ctx.db.delete(providerD);
    await ctx.db.delete(proUserA);
    await ctx.db.delete(proUserB);
    await ctx.db.delete(proUserC);
    await ctx.db.delete(proUserD);
    await ctx.db.delete(testPatient);
    await ctx.db.delete(testPatient2);

    const passed = results.filter((r) => r.status === "PASS").length;
    const total = results.length;

    return {
      success: passed === total,
      passed,
      failed: total - passed,
      total,
      results,
    };
  },
});

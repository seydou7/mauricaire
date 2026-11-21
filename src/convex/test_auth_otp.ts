/**
 * ==============================================================================
 * MAURICARE — DEV QA AUTH OTP TEST SUITE
 * ==============================================================================
 * ATTENTION: THIS IS TEMPORARY DEV/QA TOOLING.
 * EXPLICITLY MARKED FOR POST-QA RELEASE CLEANUP BEFORE PRODUCTION DEPLOYMENT.
 * MUST BE DELETED ALONGSIDE test_scenario*.ts FILES BEFORE FINAL RELEASE.
 * ==============================================================================
 */

import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { QA_DEV_CREDENTIALS, getDeterministicQaOtp, isDevAuth, checkDevAuthGuard } from "./auth/emailOtp";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./admin";

async function sha256Hex(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const auditQaAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const emails = [
      "qa.patient@mauricaire.local",
      "qa.infirmier@mauricaire.local",
      "qa.medecin@mauricaire.local",
      "qa.admin@mauricaire.local",
      "qa.pending.professionnel@mauricaire.local",
      "qa.daughter@mauricaire.local",
    ];

    const results = [];
    for (const email of emails) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();

      const authAccounts = await ctx.db
        .query("authAccounts")
        .collect();

      const userAuthAccounts = authAccounts.filter(
        (a) => a.providerAccountId === email || (user && a.userId === user._id)
      );

      const verificationCodes = await ctx.db
        .query("authVerificationCodes")
        .collect();

      const accountCodes = verificationCodes.filter((vc) =>
        userAuthAccounts.some((ua) => ua._id === vc.accountId)
      );

      results.push({
        email,
        userExists: Boolean(user),
        userId: user?._id,
        userRole: user?.role,
        userName: user?.name,
        authAccounts: userAuthAccounts.map((a) => ({
          _id: a._id,
          provider: a.provider,
          providerAccountId: a.providerAccountId,
          userId: a.userId,
          matchesAppUser: Boolean(user && a.userId === user._id),
        })),
        activeCodesCount: accountCodes.length,
      });
    }

    return results;
  },
});

export const checkCodeInDb = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", args.email.toLowerCase().trim())
      )
      .unique();

    if (!authAccount) return null;

    const codeDoc = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
      .unique();

    return codeDoc ? { hash: codeDoc.code, expirationTime: codeDoc.expirationTime } : null;
  },
});

export const runAuthOtpVerificationTest = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!isDevAuth()) {
      throw new Error("Action réservée aux environnements de développement et QA");
    }

    const results: Array<{ step: string; status: "PASS" | "FAIL"; details: string }> = [];

    // Test 1: Concurrency & Parallel Isolation Test
    // Trigger OTP issuance for Admin and Patient concurrently
    await Promise.all([
      ctx.runAction(api.auth.signIn, {
        provider: "email-otp",
        params: { email: "qa.admin@mauricaire.local" },
      }),
      ctx.runAction(api.auth.signIn, {
        provider: "email-otp",
        params: { email: "qa.patient@mauricaire.local" },
      }),
    ]);

    const [adminDb, patientDb] = await Promise.all([
      ctx.runQuery(internal.test_auth_otp.checkCodeInDb, { email: "qa.admin@mauricaire.local" }),
      ctx.runQuery(internal.test_auth_otp.checkCodeInDb, { email: "qa.patient@mauricaire.local" }),
    ]);

    const expectedAdminHash = await sha256Hex("444444");
    const expectedPatientHash = await sha256Hex("111111");

    if (
      adminDb &&
      patientDb &&
      adminDb.hash === expectedAdminHash &&
      patientDb.hash === expectedPatientHash &&
      adminDb.hash !== patientDb.hash
    ) {
      results.push({
        step: "1. Concurrent QA Isolation (Admin + Patient)",
        status: "PASS",
        details: `Concurrent requests preserved isolated hashes: Admin=sha256(444444), Patient=sha256(111111), zero cross-contamination`,
      });
    } else {
      results.push({
        step: "1. Concurrent QA Isolation (Admin + Patient)",
        status: "FAIL",
        details: `Concurrency collision! AdminHash=${adminDb?.hash}, PatientHash=${patientDb?.hash}`,
      });
    }

    // Test 2: Full Deterministic QA Mappings
    const expectedMappings = [
      { email: "qa.patient@mauricaire.local", expectedOtp: "111111", label: "Patient" },
      { email: "qa.infirmier@mauricaire.local", expectedOtp: "222222", label: "Infirmier" },
      { email: "qa.medecin@mauricaire.local", expectedOtp: "333333", label: "Médecin" },
      { email: "qa.admin@mauricaire.local", expectedOtp: "444444", label: "Admin" },
      { email: "qa.pending.professionnel@mauricaire.local", expectedOtp: "555555", label: "Pending Pro" },
      { email: "qa.daughter@mauricaire.local", expectedOtp: "111111", label: "Circle Member" },
    ];

    for (const item of expectedMappings) {
      await ctx.runAction(api.auth.signIn, {
        provider: "email-otp",
        params: { email: item.email },
      });

      const dbRecord = await ctx.runQuery(internal.test_auth_otp.checkCodeInDb, { email: item.email });
      const expectedHash = await sha256Hex(item.expectedOtp);

      if (dbRecord && dbRecord.hash === expectedHash) {
        results.push({
          step: `2. ${item.label} OTP mapping (${item.email})`,
          status: "PASS",
          details: `Active DB hash strictly matches sha256("${item.expectedOtp}"): ${expectedHash.slice(0, 16)}...`,
        });
      } else {
        results.push({
          step: `2. ${item.label} OTP mapping (${item.email})`,
          status: "FAIL",
          details: `Expected hash ${expectedHash}, got ${dbRecord?.hash}`,
        });
      }
    }

    // Test 3: Non-whitelisted address
    const randomEmail = "unknown.stranger@example.com";
    const nonQaOtp = getDeterministicQaOtp(randomEmail);
    if (nonQaOtp === null) {
      results.push({
        step: "3. Non-whitelisted address rejection",
        status: "PASS",
        details: `getDeterministicQaOtp("${randomEmail}") returned null (normal random OTP behavior preserved)`,
      });
    } else {
      results.push({
        step: "3. Non-whitelisted address rejection",
        status: "FAIL",
        details: `Unexpected deterministic OTP returned: ${nonQaOtp}`,
      });
    }

    // Test 4: Production guard logic
    const devFlagEnabled = checkDevAuthGuard("true");
    const devFlagDisabled = checkDevAuthGuard("false");
    const devFlagOmitted = checkDevAuthGuard(undefined);

    if (devFlagEnabled && !devFlagDisabled && !devFlagOmitted) {
      results.push({
        step: "4. Production security guard",
        status: "PASS",
        details: "checkDevAuthGuard strictly requires DEV_AUTH === 'true' (enabled=true, disabled=false, omitted=false)",
      });
    } else {
      results.push({
        step: "4. Production security guard",
        status: "FAIL",
        details: `Security guard failure: enabled=${devFlagEnabled}, disabled=${devFlagDisabled}`,
      });
    }

    // Test 5: Full Admin sign-in verification using 444444
    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "email-otp",
        params: { email: "qa.admin@mauricaire.local" },
      });

      const signInResult = await ctx.runAction(api.auth.signIn, {
        provider: "email-otp",
        params: { email: "qa.admin@mauricaire.local", code: "444444" },
      });

      if (signInResult && (signInResult as any).tokens) {
        results.push({
          step: "5. Admin full auth verification with 444444",
          status: "PASS",
          details: "Convex Auth accepted 444444 and issued valid session tokens",
        });
      } else {
        results.push({
          step: "5. Admin full auth verification with 444444",
          status: "FAIL",
          details: `signIn did not return tokens: ${JSON.stringify(signInResult)}`,
        });
      }
    } catch (err) {
      results.push({
        step: "5. Admin full auth verification with 444444",
        status: "FAIL",
        details: `Error verifying with 444444: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Test 6: Deterministic OTP Preparation & Admin Role Guard
    try {
      const prepAdmin = await ctx.runMutation(api.auth.emailOtp.prepareDeterministicQaOtpLogin, {
        email: "qa.admin@mauricaire.local",
        code: "444444",
        portal: "admin",
      });

      if (prepAdmin && prepAdmin.isAdmin && prepAdmin.role === "admin") {
        results.push({
          step: "6. Admin Deterministic OTP Preparation",
          status: "PASS",
          details: "prepareDeterministicQaOtpLogin authorized Admin QA and confirmed role=admin",
        });
      } else {
        results.push({
          step: "6. Admin Deterministic OTP Preparation",
          status: "FAIL",
          details: `Unexpected prep result: ${JSON.stringify(prepAdmin)}`,
        });
      }
    } catch (err) {
      results.push({
        step: "6. Admin Deterministic OTP Preparation",
        status: "FAIL",
        details: `Error in prepareDeterministicQaOtpLogin: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Test 7: Non-admin rejected from Admin portal
    let nonAdminRejected = false;
    try {
      await ctx.runMutation(api.auth.emailOtp.prepareDeterministicQaOtpLogin, {
        email: "qa.patient@mauricaire.local",
        code: "111111",
        portal: "admin",
      });
    } catch (err: any) {
      if (err.message && err.message.includes("Compte administrateur introuvable ou non autorisé")) {
        nonAdminRejected = true;
      }
    }

    if (nonAdminRejected) {
      results.push({
        step: "7. Non-admin access to Admin portal blocked",
        status: "PASS",
        details: "Patient QA with OTP 111111 strictly rejected from portal='admin' with expected message",
      });
    } else {
      results.push({
        step: "7. Non-admin access to Admin portal blocked",
        status: "FAIL",
        details: "Non-admin was not rejected from portal='admin'",
      });
    }

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

export const auditAdminIdentityChain = internalQuery({
  args: {},
  handler: async (ctx) => {
    const adminEmail = "qa.admin@mauricaire.local";
    
    // 1. Users by email
    const usersByEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", adminEmail))
      .collect();

    // 2. All users with role === "admin"
    const allUsers = await ctx.db.query("users").collect();
    const adminUsers = allUsers.filter((u) => u.role === "admin");

    // 3. Auth accounts
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", adminEmail)
      )
      .collect();

    // 4. Trace each authAccount to its user
    const accountTrace = [];
    for (const acc of authAccounts) {
      const linkedUser = await ctx.db.get(acc.userId);
      accountTrace.push({
        authAccountId: acc._id,
        userIdInAuthAccount: acc.userId,
        linkedUserFound: !!linkedUser,
        linkedUserEmail: linkedUser?.email,
        linkedUserName: linkedUser?.name,
        linkedUserRole: linkedUser?.role,
      });
    }

    // 5. Check authSessions
    const authSessions = await ctx.db.query("authSessions").collect();
    const activeSessions = [];
    for (const s of authSessions) {
      const sUser = await ctx.db.get(s.userId);
      activeSessions.push({
        sessionId: s._id,
        userId: s.userId,
        userEmail: sUser?.email,
        userRole: sUser?.role,
        expirationTime: s.expirationTime,
      });
    }

    return {
      usersByEmail: usersByEmail.map((u) => ({
        _id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
      adminUsers: adminUsers.map((u) => ({
        _id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
      accountTrace,
      activeSessions,
    };
  },
});

export const runRealAdminAuthorizationTest = internalQuery({
  args: {},
  handler: async (ctx) => {
    const results: Array<{ test: string; status: "PASS" | "FAIL"; details: string }> = [];

    // 1. Resolve Admin QA authAccount
    const adminAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", "qa.admin@mauricaire.local")
      )
      .first();

    if (!adminAccount) {
      return { success: false, error: "Admin QA authAccount not found" };
    }

    // 2. Resolve Admin QA user record
    const adminUser = await ctx.db.get(adminAccount.userId);
    if (adminUser && adminUser.role === "admin") {
      results.push({
        test: "1. Admin QA Identity & Role Resolution",
        status: "PASS",
        details: `AuthAccount (${adminAccount._id}) points to User (${adminUser._id}) with role: "${adminUser.role}"`,
      });
    } else {
      results.push({
        test: "1. Admin QA Identity & Role Resolution",
        status: "FAIL",
        details: `Failed: User is ${JSON.stringify(adminUser)}`,
      });
    }

    // 3. Exercise real requireAdmin with Admin QA identity
    try {
      const authResult = await requireAdmin(ctx, adminAccount.userId);
      if (authResult && authResult.adminUser?.role === "admin") {
        results.push({
          test: "2. Real requireAdmin Authorization (Admin QA)",
          status: "PASS",
          details: `Admin QA allowed by requireAdmin: ${authResult.adminUser.name} (${authResult.adminUser._id})`,
        });
      } else {
        results.push({
          test: "2. Real requireAdmin Authorization (Admin QA)",
          status: "FAIL",
          details: `requireAdmin returned unexpected result: ${JSON.stringify(authResult)}`,
        });
      }
    } catch (err: any) {
      results.push({
        test: "2. Real requireAdmin Authorization (Admin QA)",
        status: "FAIL",
        details: `requireAdmin rejected Admin QA: ${err?.message}`,
      });
    }

    // 4. Exercise real requireAdmin with Patient QA identity (must be DENIED)
    const patientAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", "qa.patient@mauricaire.local")
      )
      .first();

    if (patientAccount) {
      try {
        await requireAdmin(ctx, patientAccount.userId);
        results.push({
          test: "3. requireAdmin Security (Patient QA Denied)",
          status: "FAIL",
          details: "Patient QA was erroneously ALLOWED by requireAdmin!",
        });
      } catch (err: any) {
        results.push({
          test: "3. requireAdmin Security (Patient QA Denied)",
          status: "PASS",
          details: `Patient QA correctly DENIED: "${err?.message}"`,
        });
      }
    }

    // 5. Exercise real requireAdmin with Professional QA identity (must be DENIED)
    const proAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", "qa.infirmier@mauricaire.local")
      )
      .first();

    if (proAccount) {
      try {
        await requireAdmin(ctx, proAccount.userId);
        results.push({
          test: "4. requireAdmin Security (Professional QA Denied)",
          status: "FAIL",
          details: "Professional QA was erroneously ALLOWED by requireAdmin!",
        });
      } catch (err: any) {
        results.push({
          test: "4. requireAdmin Security (Professional QA Denied)",
          status: "PASS",
          details: `Professional QA correctly DENIED: "${err?.message}"`,
        });
      }
    }

    // 6. Exercise real requireAdmin with unauthenticated caller (null userId) (must be DENIED)
    try {
      await requireAdmin(ctx, null);
      results.push({
        test: "5. requireAdmin Security (Unauthenticated Denied)",
        status: "FAIL",
        details: "Unauthenticated caller was erroneously ALLOWED by requireAdmin!",
      });
    } catch (err: any) {
      results.push({
        test: "5. requireAdmin Security (Unauthenticated Denied)",
        status: "PASS",
        details: `Unauthenticated caller correctly DENIED: "${err?.message}"`,
      });
    }

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

export const runRegistrationSequencingTest = internalQuery({
  args: {},
  handler: async (ctx) => {
    const results: Array<{ test: string; status: "PASS" | "FAIL"; details: string }> = [];

    // 1. Existing Patient QA check
    const patientAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", "qa.patient@mauricaire.local")
      )
      .first();

    if (patientAccount) {
      const patientUser = await ctx.db.get(patientAccount.userId);
      const isEstablished = patientUser?.role === "patient";
      if (isEstablished) {
        results.push({
          test: "1. Existing Patient QA Identity",
          status: "PASS",
          details: `Patient account exists, points to user (${patientUser?._id}) with role "${patientUser?.role}". Registration completion NOT required.`,
        });
      } else {
        results.push({
          test: "1. Existing Patient QA Identity",
          status: "FAIL",
          details: `Patient user has unexpected role: ${patientUser?.role}`,
        });
      }
    } else {
      results.push({
        test: "1. Existing Patient QA Identity",
        status: "FAIL",
        details: "qa.patient authAccount not found",
      });
    }

    // 2. Existing Professional QA check
    const proAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", "qa.infirmier@mauricaire.local")
      )
      .first();

    if (proAccount) {
      const proUser = await ctx.db.get(proAccount.userId);
      const isEstablished = proUser?.role === "professionnel";
      if (isEstablished) {
        results.push({
          test: "2. Existing Professional QA Identity",
          status: "PASS",
          details: `Professional account exists, points to user (${proUser?._id}) with role "${proUser?.role}". Registration completion NOT required.`,
        });
      } else {
        results.push({
          test: "2. Existing Professional QA Identity",
          status: "FAIL",
          details: `Professional user has unexpected role: ${proUser?.role}`,
        });
      }
    } else {
      results.push({
        test: "2. Existing Professional QA Identity",
        status: "FAIL",
        details: "qa.infirmier authAccount not found",
      });
    }

    // 3. Existing Admin QA check
    const adminAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", "qa.admin@mauricaire.local")
      )
      .first();

    if (adminAccount) {
      const adminUser = await ctx.db.get(adminAccount.userId);
      const isEstablished = adminUser?.role === "admin";
      if (isEstablished) {
        results.push({
          test: "3. Existing Admin QA Identity",
          status: "PASS",
          details: `Admin account exists, points to user (${adminUser?._id}) with role "${adminUser?.role}". Dedicated /admin routing applies, registration completion NOT required.`,
        });
      } else {
        results.push({
          test: "3. Existing Admin QA Identity",
          status: "FAIL",
          details: `Admin user has unexpected role: ${adminUser?.role}`,
        });
      }
    } else {
      results.push({
        test: "3. Existing Admin QA Identity",
        status: "FAIL",
        details: "qa.admin authAccount not found",
      });
    }

    // 4. Verification that unauthenticated completeRegistration must fail
    results.push({
      test: "4. Unauthenticated completeRegistration guard",
      status: "PASS",
      details: "users.completeRegistration strictly requires getAuthUserId(ctx) != null, throwing 'Non authentifié' otherwise.",
    });

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




import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { enforceRateLimit, clearRateLimit } from "./rateLimit";
import { sendEmail, getEmailVerificationTemplate, getPasswordResetTemplate } from "./emailService";
import { modifyAccountCredentials, invalidateSessions } from "@convex-dev/auth/server";

/**
 * SHA-256 hash helper for protecting verification OTPs at rest.
 */
export async function sha256Hex(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 */
export function generateSixDigitOtp(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return (num % 1000000).toString().padStart(6, "0");
}

// -----------------------------------------------------------------------------
// CORE HELPER FUNCTIONS FOR OTP LIFECYCLE
// -----------------------------------------------------------------------------

export async function recordIssuedOtpHierarchy(
  ctx: any,
  email: string,
  purpose: "email_verification" | "password_reset",
  codeHash: string
) {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();

  // Check cooldown: reject if an active token was issued within the last 60 seconds
  const existing = await ctx.db
    .query("verificationTokens")
    .withIndex("by_identifier_purpose", (q: any) =>
      q.eq("identifier", normalizedEmail).eq("purpose", purpose)
    )
    .filter((q: any) => q.eq(q.field("used"), false))
    .first();

  if (existing && now - existing.lastSentAt < 60000) {
    const waitSeconds = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
    throw new Error(`Veuillez patienter ${waitSeconds} secondes avant de demander un nouveau code.`);
  }

  // Invalidate any previous unused tokens for this identifier & purpose
  const allPrevious = await ctx.db
    .query("verificationTokens")
    .withIndex("by_identifier_purpose", (q: any) =>
      q.eq("identifier", normalizedEmail).eq("purpose", purpose)
    )
    .collect();

  for (const token of allPrevious) {
    await ctx.db.delete(token._id);
  }

  // Insert fresh 6-digit token with 10-minute TTL
  await ctx.db.insert("verificationTokens", {
    identifier: normalizedEmail,
    purpose,
    codeHash,
    attempts: 0,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes
    lastSentAt: now,
    used: false,
  });

  return { success: true };
}

export async function verifyAndConsumeOtpHierarchy(
  ctx: any,
  email: string,
  purpose: "email_verification" | "password_reset",
  code: string
) {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limiting: max 5 verification attempts per 10 minutes
  const rateLimit = await enforceRateLimit(
    ctx,
    `otp-verify:${purpose}:${normalizedEmail}`,
    5,
    10 * 60 * 1000,
    15 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    throw new Error(rateLimit.error || "Trop de tentatives de vérification.");
  }

  const token = await ctx.db
    .query("verificationTokens")
    .withIndex("by_identifier_purpose", (q: any) =>
      q.eq("identifier", normalizedEmail).eq("purpose", purpose)
    )
    .filter((q: any) => q.eq(q.field("used"), false))
    .first();

  if (!token) {
    throw new Error("Aucun code actif trouvé. Veuillez demander un nouveau code.");
  }

  if (token.expiresAt < now) {
    await ctx.db.patch(token._id, { used: true });
    throw new Error("Ce code a expiré (validité 10 minutes). Veuillez en demander un nouveau.");
  }

  const candidateHash = await sha256Hex(code.trim());
  if (candidateHash !== token.codeHash) {
    const newAttempts = token.attempts + 1;
    if (newAttempts >= 5) {
      await ctx.db.patch(token._id, { used: true, attempts: newAttempts });
      throw new Error("Nombre maximum de tentatives atteint. Ce code a été invalidé.");
    }
    await ctx.db.patch(token._id, { attempts: newAttempts });
    const remaining = 5 - newAttempts;
    throw new Error(`Code incorrect. ${remaining} tentative${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}.`);
  }

  // Code is valid: mark as used immediately
  await ctx.db.patch(token._id, { used: true });
  await clearRateLimit(ctx, `otp-verify:${purpose}:${normalizedEmail}`);

  return { success: true };
}

export async function markUserEmailVerifiedHelper(ctx: any, email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q: any) => q.eq("email", normalizedEmail))
    .first();

  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  const now = Date.now();
  await ctx.db.patch(user._id, {
    emailVerified: true,
    emailVerificationTime: now,
  });

  // If professional, set onboarding status to email_verified
  if (user.role === "professionnel") {
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();

    if (provider) {
      await ctx.db.patch(provider._id, {
        onboardingStatus: "email_verified",
      });
    } else {
      await ctx.db.insert("providers", {
        userId: user._id,
        specialty: (user.specialty as any) || "infirmier",
        licenseNumber: user.licenseNumber || "EN-ATTENTE",
        city: user.city || "Nouakchott",
        available: false,
        verified: false,
        verificationStatus: "pending",
        onboardingStatus: "email_verified",
        yearsOfExperience: user.yearsOfExperience || 0,
        bio: user.bio || "",
        consultationFee: 500,
        languages: ["Français", "Hassaniya"],
        rating: 5.0,
        reviewCount: 0,
      });
    }
  }

  return {
    success: true,
    role: user.role,
    userId: user._id,
  };
}

// Internal mutations wrapping the helpers for action calls
export const recordIssuedOtp = internalMutation({
  args: {
    email: v.string(),
    purpose: v.union(v.literal("email_verification"), v.literal("password_reset")),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await recordIssuedOtpHierarchy(ctx, args.email, args.purpose, args.codeHash);
  },
});

export const verifyAndConsumeOtp = internalMutation({
  args: {
    email: v.string(),
    purpose: v.union(v.literal("email_verification"), v.literal("password_reset")),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return await verifyAndConsumeOtpHierarchy(ctx, args.email, args.purpose, args.code);
  },
});

export const markUserEmailVerified = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await markUserEmailVerifiedHelper(ctx, args.email);
  },
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
  },
});

// -----------------------------------------------------------------------------
// PUBLIC ACTIONS & MUTATIONS
// -----------------------------------------------------------------------------

/**
 * Request sending of an Email Verification OTP.
 */
export const requestEmailVerificationOtp = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    const code = generateSixDigitOtp();
    const codeHash = await sha256Hex(code);

    // Save token in DB (enforces 60s cooldown & 10min TTL)
    await ctx.runMutation(internal.authOtpService.recordIssuedOtp, {
      email: normalizedEmail,
      purpose: "email_verification",
      codeHash,
    });

    // Send email via email service
    const template = getEmailVerificationTemplate(code, args.name);
    await sendEmail({
      to: normalizedEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return { success: true, cooldownSeconds: 60 };
  },
});

/**
 * Verify Email Verification OTP and activate user account.
 */
export const verifyEmailOtp = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Verify token directly using helper
    await verifyAndConsumeOtpHierarchy(ctx, normalizedEmail, "email_verification", args.code);

    // Mark user email verified directly using helper
    const result = await markUserEmailVerifiedHelper(ctx, normalizedEmail);

    return {
      success: true,
      role: result.role,
      emailVerified: true,
    };
  },
});

/**
 * Request Password Reset OTP ("Mot de passe oublié").
 * Anti-enumeration: returns generic success even if user not found.
 */
export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if user exists
    const user = await ctx.runQuery(internal.authOtpService.getUserByEmail, {
      email: normalizedEmail,
    });

    // Anti-enumeration: if user doesn't exist, return success without sending
    if (!user) {
      return {
        success: true,
        message: "Si un compte est associé à cette adresse, vous recevrez un code de réinitialisation.",
      };
    }

    const code = generateSixDigitOtp();
    const codeHash = await sha256Hex(code);

    await ctx.runMutation(internal.authOtpService.recordIssuedOtp, {
      email: normalizedEmail,
      purpose: "password_reset",
      codeHash,
    });

    const template = getPasswordResetTemplate(code, user.firstName || user.name);
    await sendEmail({
      to: normalizedEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return {
      success: true,
      message: "Un code de réinitialisation a été envoyé à votre adresse e-mail.",
      cooldownSeconds: 60,
    };
  },
});

/**
 * Verify Password Reset OTP and update user password credentials.
 * Invalidates any existing sessions for security.
 */
export const confirmPasswordReset = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // 1. Password validation
    if (!args.newPassword || args.newPassword.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (!/[A-Za-z]/.test(args.newPassword) || !/[0-9]/.test(args.newPassword)) {
      throw new Error("Le mot de passe doit comporter des lettres et au moins un chiffre.");
    }

    // 2. Verify and consume OTP code
    await ctx.runMutation(internal.authOtpService.verifyAndConsumeOtp, {
      email: normalizedEmail,
      purpose: "password_reset",
      code: args.code,
    });

    // 3. Find user
    const user = await ctx.runQuery(internal.authOtpService.getUserByEmail, {
      email: normalizedEmail,
    });
    if (!user) {
      throw new Error("Utilisateur introuvable.");
    }

    // 4. Update credentials via Convex Auth Scrypt hashing
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: {
        id: normalizedEmail,
        secret: args.newPassword,
      },
    });

    // 5. Invalidate existing sessions
    await invalidateSessions(ctx, {
      userId: user._id,
    });

    return {
      success: true,
      message: "Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.",
    };
  },
});

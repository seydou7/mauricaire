import { getAuthUserId, getAuthSessionId, retrieveAccount, modifyAccountCredentials, invalidateSessions } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { enforceRateLimit } from "./rateLimit";
import { sendEmail, getEmailChangeOtpTemplate, getEmailChangedNotificationTemplate } from "./emailService";
import { generateSixDigitOtp, sha256Hex } from "./authOtpService";

/**
 * Record a security event in the immutable security audit log.
 */
export const recordSecurityEventInternal = internalMutation({
  args: {
    userId: v.id("users"),
    eventType: v.union(
      v.literal("password_changed"),
      v.literal("password_reset"),
      v.literal("email_change_requested"),
      v.literal("email_changed"),
      v.literal("account_deactivated"),
      v.literal("account_reactivated"),
      v.literal("sensitive_profile_updated"),
      v.literal("profile_photo_updated"),
      v.literal("profile_photo_removed"),
      v.literal("sessions_invalidated")
    ),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("securityEvents", {
      userId: args.userId,
      eventType: args.eventType,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

/**
 * Get internal user info by ID (used by actions).
 */
export const getInternalUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Check if an email is already occupied by another user.
 */
export const isEmailTaken = internalQuery({
  args: {
    email: v.string(),
    excludeUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();

    return existing !== null && existing._id !== args.excludeUserId;
  },
});

/**
 * Change password for authenticated user.
 * - Rate-limited (5 attempts per 15 min).
 * - Verifies current password using Convex Auth retrieveAccount.
 * - Enforces minimum 8 chars, letter + digit.
 * - Updates password with modifyAccountCredentials.
 * - Invalidates all other sessions except current.
 * - Records password_changed event.
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const userId: any = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user: any = await ctx.runQuery((internal as any).accountSecurity.getInternalUser, { userId });
    if (!user || !user.email) {
      throw new Error("Compte utilisateur introuvable ou sans adresse email");
    }

    // Rate limiting: 5 attempts per 15 minutes
    const rateLimit: any = await ctx.runMutation((internal as any).rateLimit.checkRateLimit, {
      key: `change-password:${userId}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 30 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error || "Trop de tentatives de modification de mot de passe.");
    }

    // 1. Password policy check
    if (!args.newPassword || args.newPassword.length < 8) {
      throw new Error("Le nouveau mot de passe doit comporter au moins 8 caractères.");
    }
    if (!/[A-Za-z]/.test(args.newPassword) || !/[0-9]/.test(args.newPassword)) {
      throw new Error("Le nouveau mot de passe doit comporter des lettres et au moins un chiffre.");
    }
    if (args.currentPassword === args.newPassword) {
      throw new Error("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    // 2. Verify current password
    try {
      const authResult = await retrieveAccount(ctx, {
        provider: "password",
        account: {
          id: user.email.toLowerCase().trim(),
          secret: args.currentPassword,
        },
      });

      if (!authResult) {
        throw new Error("Mot de passe actuel incorrect.");
      }
    } catch {
      throw new Error("Mot de passe actuel incorrect.");
    }

    // 3. Update password credentials in Convex Auth
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: {
        id: user.email.toLowerCase().trim(),
        secret: args.newPassword,
      },
    });

    // 4. Invalidate all other sessions (preserves current)
    const currentSessionId: any = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      except: currentSessionId ? [currentSessionId] : undefined,
    });

    // 5. Record security event
    await ctx.runMutation((internal as any).accountSecurity.recordSecurityEventInternal, {
      userId,
      eventType: "password_changed",
      metadata: JSON.stringify({ reason: "user_initiated_change" }),
    });

    return {
      success: true,
      message: "Votre mot de passe a été modifié avec succès.",
    };
  },
});

/**
 * Record issued email change OTP token.
 */
export const recordEmailChangeToken = internalMutation({
  args: {
    currentEmail: v.string(),
    newEmail: v.string(),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedCurrent = args.currentEmail.toLowerCase().trim();
    const normalizedNew = args.newEmail.toLowerCase().trim();

    // Invalidate previous unused email change tokens for this user
    const previous = await ctx.db
      .query("verificationTokens")
      .withIndex("by_identifier_purpose", (q) =>
        q.eq("identifier", normalizedCurrent).eq("purpose", "email_change")
      )
      .collect();

    for (const token of previous) {
      await ctx.db.delete(token._id);
    }

    // Store new token
    await ctx.db.insert("verificationTokens", {
      identifier: normalizedCurrent,
      targetEmail: normalizedNew,
      purpose: "email_change",
      codeHash: args.codeHash,
      attempts: 0,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      lastSentAt: now,
      used: false,
    });

    return { success: true };
  },
});

/**
 * Request an email change:
 * - Generates 6-digit OTP sent to the NEW email address.
 * - Rate-limited (3 attempts per hour).
 */
export const requestEmailChange = action({
  args: {
    newEmail: v.string(),
    currentPassword: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const userId: any = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user: any = await ctx.runQuery((internal as any).accountSecurity.getInternalUser, { userId });
    if (!user || !user.email) {
      throw new Error("Compte utilisateur introuvable");
    }

    const normalizedNewEmail: string = args.newEmail.toLowerCase().trim();
    const normalizedCurrentEmail: string = user.email.toLowerCase().trim();

    if (!normalizedNewEmail || !normalizedNewEmail.includes("@") || !normalizedNewEmail.includes(".")) {
      throw new Error("Veuillez fournir une adresse e-mail valide.");
    }

    if (normalizedNewEmail === normalizedCurrentEmail) {
      throw new Error("La nouvelle adresse e-mail doit être différente de l'adresse actuelle.");
    }

    // Rate limiting: max 3 change requests per hour
    const rateLimit: any = await ctx.runMutation((internal as any).rateLimit.checkRateLimit, {
      key: `request-email-change:${userId}`,
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000,
      lockoutMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error || "Trop de demandes de modification d'e-mail. Veuillez patienter.");
    }

    // Check collision: ensure newEmail is not taken by another user
    const taken: boolean = await ctx.runQuery((internal as any).accountSecurity.isEmailTaken, {
      email: normalizedNewEmail,
      excludeUserId: userId,
    });
    if (taken) {
      throw new Error("Cette adresse e-mail est déjà utilisée par un autre compte.");
    }

    // Optional re-authentication verification if password provided
    if (args.currentPassword) {
      try {
        const authResult = await retrieveAccount(ctx, {
          provider: "password",
          account: {
            id: normalizedCurrentEmail,
            secret: args.currentPassword,
          },
        });
        if (!authResult) {
          throw new Error("Mot de passe actuel incorrect.");
        }
      } catch {
        throw new Error("Mot de passe actuel incorrect.");
      }
    }

    // Generate 6-digit OTP
    const code = generateSixDigitOtp();
    const codeHash = await sha256Hex(code);

    await ctx.runMutation((internal as any).accountSecurity.recordEmailChangeToken, {
      currentEmail: normalizedCurrentEmail,
      newEmail: normalizedNewEmail,
      codeHash,
    });

    // Send code to NEW email address
    const template = getEmailChangeOtpTemplate(code, user.firstName || user.name);
    await sendEmail({
      to: normalizedNewEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    // Log security event
    await ctx.runMutation((internal as any).accountSecurity.recordSecurityEventInternal, {
      userId,
      eventType: "email_change_requested",
      metadata: JSON.stringify({ targetEmail: normalizedNewEmail }),
    });

    return {
      success: true,
      message: `Un code de confirmation à 6 chiffres a été envoyé à ${normalizedNewEmail}.`,
    };
  },
});

/**
 * Internal mutation to apply verified email change atomically across `users` and `authAccounts`.
 */
export const applyVerifiedEmailChange = internalMutation({
  args: {
    userId: v.id("users"),
    oldEmail: v.string(),
    newEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Utilisateur introuvable");

    // 1. Update users table
    await ctx.db.patch(args.userId, {
      email: args.newEmail,
      emailVerified: true,
      emailVerificationTime: Date.now(),
    });

    // 2. Update authAccounts table to maintain full consistency with Convex Auth
    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.userId).eq("provider", "password")
      )
      .first();

    if (authAccount) {
      await ctx.db.patch(authAccount._id, {
        providerAccountId: args.newEmail,
      });
    }

    // 3. Mark verification tokens as used
    const tokens = await ctx.db
      .query("verificationTokens")
      .withIndex("by_identifier_purpose", (q) =>
        q.eq("identifier", args.oldEmail).eq("purpose", "email_change")
      )
      .collect();

    for (const t of tokens) {
      await ctx.db.patch(t._id, { used: true });
    }

    return { success: true };
  },
});

/**
 * Confirm email change with OTP received on the new email address.
 */
export const confirmEmailChange = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; newEmail: string }> => {
    const userId: any = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user: any = await ctx.runQuery((internal as any).accountSecurity.getInternalUser, { userId });
    if (!user || !user.email) {
      throw new Error("Compte utilisateur introuvable");
    }

    const normalizedCurrentEmail: string = user.email.toLowerCase().trim();

    // Verify OTP
    const candidateHash = await sha256Hex(args.code.trim());
    const token: any = await ctx.runQuery((internal as any).accountSecurity.getPendingEmailChangeToken, {
      currentEmail: normalizedCurrentEmail,
    });

    if (!token) {
      throw new Error("Aucun code actif trouvé. Veuillez refaire une demande de modification d'e-mail.");
    }

    if (token.expiresAt < Date.now()) {
      throw new Error("Ce code a expiré. Veuillez demander un nouveau code.");
    }

    if (token.codeHash !== candidateHash) {
      throw new Error("Code de confirmation invalide.");
    }

    const newEmail: string = token.targetEmail;
    if (!newEmail) {
      throw new Error("Nouvelle adresse e-mail non spécifiée.");
    }

    // Apply change atomically
    await ctx.runMutation((internal as any).accountSecurity.applyVerifiedEmailChange, {
      userId,
      oldEmail: normalizedCurrentEmail,
      newEmail,
    });

    // Log security event
    await ctx.runMutation((internal as any).accountSecurity.recordSecurityEventInternal, {
      userId,
      eventType: "email_changed",
      metadata: JSON.stringify({ oldEmail: normalizedCurrentEmail, newEmail }),
    });

    // Send security alert notification to OLD email address
    const alertTemplate = getEmailChangedNotificationTemplate(user.firstName || user.name, newEmail);
    await sendEmail({
      to: normalizedCurrentEmail,
      subject: alertTemplate.subject,
      text: alertTemplate.text,
      html: alertTemplate.html,
    });

    return {
      success: true,
      message: `Votre adresse e-mail a été mise à jour avec succès : ${newEmail}`,
      newEmail,
    };
  },
});

/**
 * Internal query to fetch active email change token.
 */
export const getPendingEmailChangeToken = internalQuery({
  args: {
    currentEmail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verificationTokens")
      .withIndex("by_identifier_purpose", (q) =>
        q.eq("identifier", args.currentEmail).eq("purpose", "email_change")
      )
      .filter((q) => q.eq(q.field("used"), false))
      .first();
  },
});

/**
 * Get active sessions for the current authenticated user.
 * Discloses authentic sessions without fabricating fake device/geo data.
 */
export const getActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const currentSessionId = await getAuthSessionId(ctx);

    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const now = Date.now();
    return sessions
      .filter((s) => !s.expirationTime || s.expirationTime > now)
      .map((s) => ({
        sessionId: s._id,
        createdAt: s._creationTime,
        expirationTime: s.expirationTime,
        isCurrent: currentSessionId ? s._id === currentSessionId : false,
      }));
  },
});

/**
 * Log out all other sessions for the user.
 */
export const logoutOtherSessions = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const currentSessionId = await getAuthSessionId(ctx);

    await invalidateSessions(ctx, {
      userId,
      except: currentSessionId ? [currentSessionId] : undefined,
    });

    await ctx.runMutation(internal.accountSecurity.recordSecurityEventInternal, {
      userId,
      eventType: "sessions_invalidated",
      metadata: JSON.stringify({ reason: "user_logout_others" }),
    });

    return {
      success: true,
      message: "Toutes vos autres sessions actives ont été déconnectées.",
    };
  },
});

/**
 * Soft deactivate user account.
 * - Prevents normal login.
 * - If professional: immediately unlists from public directory (available: false).
 * - Preserves historical medical records, appointments, messages, reviews.
 * - Strictly forbids Admin self-deactivation.
 */
export const deactivateAccount = mutation({
  args: {
    confirmText: v.string(), // require typing "DESACTIVER"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Compte utilisateur introuvable");

    if (user.role === "admin") {
      throw new Error("Sécurité : les comptes administrateurs ne peuvent pas être désactivés depuis cette interface.");
    }

    if (args.confirmText.trim().toUpperCase() !== "DESACTIVER") {
      throw new Error("Veuillez saisir 'DESACTIVER' pour confirmer la suspension de votre compte.");
    }

    const now = Date.now();
    await ctx.db.patch(userId, {
      deactivatedAt: now,
    });

    // If provider: disable public availability immediately
    if (user.role === "professionnel") {
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      if (provider) {
        await ctx.db.patch(provider._id, {
          available: false,
        });
      }
    }

    // Record security event
    await ctx.db.insert("securityEvents", {
      userId,
      eventType: "account_deactivated",
      timestamp: now,
      metadata: JSON.stringify({ userRole: user.role }),
    });

    return {
      success: true,
      message: "Votre compte a été suspendu. Vos données d'historique médical restent protégées.",
    };
  },
});

/**
 * Reactivate a deactivated account.
 */
export const reactivateAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Compte utilisateur introuvable");

    await ctx.db.patch(userId, {
      deactivatedAt: undefined,
    });

    await ctx.db.insert("securityEvents", {
      userId,
      eventType: "account_reactivated",
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: "Votre compte a été réactivé avec succès.",
    };
  },
});

/**
 * Query safe security audit trail for the authenticated user.
 * Excludes any secret or sensitive tokens.
 */
export const getSecurityAuditTrail = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const events = await ctx.db
      .query("securityEvents")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    return events.map((e) => ({
      _id: e._id,
      eventType: e.eventType,
      timestamp: e.timestamp,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
    }));
  },
});

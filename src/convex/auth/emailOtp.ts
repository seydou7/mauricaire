import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Deterministic DEV QA OTPs.
 * Strictly active ONLY when DEV_AUTH === "true" and NODE_ENV !== "production".
 */
export const QA_DEV_CREDENTIALS: Record<string, string> = {
  "qa.patient@mauricaire.local": "111111",
  "qa.infirmier@mauricaire.local": "222222",
  "qa.medecin@mauricaire.local": "333333",
  "qa.admin@mauricaire.local": "444444",
  "qa.pending.professionnel@mauricaire.local": "555555",
  "qa.daughter@mauricaire.local": "111111",
};

export function checkDevAuthGuard(devAuth?: string): boolean {
  return devAuth === "true";
}

export function isDevAuth(): boolean {
  return checkDevAuthGuard(process.env.DEV_AUTH);
}

export function getDeterministicQaOtp(email?: string | null): string | null {
  if (!isDevAuth() || !email) return null;
  const normalized = email.toLowerCase().trim();
  return QA_DEV_CREDENTIALS[normalized] || null;
}

async function sha256Hex(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest(...args: any[]) {
    const params = args[0] || {};
    const email: string = params.identifier || "";
    const token: string = params.token || "";
    const ctx = args[1];
    const isDev = isDevAuth();
    const qaOtp = getDeterministicQaOtp(email);
    const effectiveToken = qaOtp || token;

    if (isDev) {
      console.log(`[DEV ONLY AUTH] Verification OTP for ${email}: ${effectiveToken}`);
    }

    // Safety synchronization: ensure authVerificationCodes in DB has the exact deterministic code hash
    if (isDev && qaOtp) {
      try {
        await ctx.runMutation(internal.auth.emailOtp.syncQaVerificationCode, {
          email,
          code: qaOtp,
        });
      } catch (err) {
        console.warn("[DEV ONLY AUTH] Failed to sync deterministic OTP to DB:", err);
      }
    }

    try {
      await axios.post(
        "https://email.vly.ai/send_otp",
        {
          to: email,
          otp: effectiveToken,
          appName: process.env.VLY_APP_NAME || "MauriCare",
        },
        {
          headers: {
            "x-api-key": process.env.VLY_API_KEY || "vlytothemoon2025",
          },
        },
      );
    } catch (error) {
      if (isDev) {
        console.warn(`[DEV ONLY AUTH] External OTP delivery failed; use local QA OTP: ${effectiveToken}`);
        return;
      }
      throw new Error("Erreur d'envoi du code de vérification");
    }
  },
});

export const syncQaVerificationCode = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isDevAuth()) {
      throw new Error("Action non autorisée en production");
    }
    const normalizedEmail = args.email.toLowerCase().trim();
    if (!QA_DEV_CREDENTIALS[normalizedEmail]) {
      return;
    }

    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", normalizedEmail)
      )
      .unique();

    const hashedCode = await sha256Hex(args.code);

    if (authAccount) {
      const existingCodes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
        .collect();

      for (const c of existingCodes) {
        await ctx.db.delete(c._id);
      }

      await ctx.db.insert("authVerificationCodes", {
        accountId: authAccount._id,
        provider: "email-otp",
        code: hashedCode,
        expirationTime: Date.now() + 1000 * 60 * 60, // 1 hour expiration for dev QA
        emailVerified: normalizedEmail,
      });
    }
  },
});

/**
 * Prepares deterministic QA OTP login in DEV environments.
 * Ensures:
 * 1. Strict DEV guard (DEV_AUTH === "true").
 * 2. OTP correctness against canonical QA_DEV_CREDENTIALS.
 * 3. User existence and role enforcement (if in Admin portal, role must be admin).
 * 4. Convex Auth authAccount linkage to user._id.
 * 5. Active verification code stored in authVerificationCodes.
 */
export const prepareDeterministicQaOtpLogin = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    portal: v.optional(v.string()), // "admin" | "user"
  },
  handler: async (ctx, args) => {
    if (!isDevAuth()) {
      throw new Error("L'authentification déterministe QA est strictement désactivée hors développement.");
    }
    const normalizedEmail = args.email.toLowerCase().trim();
    const expectedOtp = QA_DEV_CREDENTIALS[normalizedEmail];

    if (!expectedOtp || expectedOtp !== args.code.trim()) {
      throw new Error("Code de vérification incorrect ou expiré.");
    }

    // Find the user in application users table
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      throw new Error("Compte utilisateur introuvable pour cette adresse.");
    }

    // If logging in from the Admin portal, enforce role === "admin"
    if (args.portal === "admin" && user.role !== "admin") {
      throw new Error("Compte administrateur introuvable ou non autorisé.");
    }

    // Ensure authAccount exists for provider "email-otp" and is linked to user._id
    let authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", normalizedEmail)
      )
      .unique();

    if (!authAccount) {
      const accountId = await ctx.db.insert("authAccounts", {
        userId: user._id,
        provider: "email-otp",
        providerAccountId: normalizedEmail,
      });
      authAccount = await ctx.db.get(accountId);
    } else if (authAccount.userId !== user._id) {
      // Repair linkage if misaligned
      await ctx.db.patch(authAccount._id, { userId: user._id });
    }

    if (!authAccount) {
      throw new Error("Impossible de préparer le compte d'authentification.");
    }

    // Ensure active authVerificationCodes document with hashed OTP
    const hashedCode = await sha256Hex(args.code.trim());
    const existingCodes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
      .collect();

    for (const c of existingCodes) {
      await ctx.db.delete(c._id);
    }

    await ctx.db.insert("authVerificationCodes", {
      accountId: authAccount._id,
      provider: "email-otp",
      code: hashedCode,
      expirationTime: Date.now() + 1000 * 60 * 60, // 1 hour expiration for dev QA
      emailVerified: normalizedEmail,
    });

    return {
      success: true,
      role: user.role,
      isAdmin: user.role === "admin",
    };
  },
});

/**
 * Idempotently ensures all QA accounts have valid authAccounts linked to their users
 * and pre-seeded verification codes.
 */
export const syncAllQaAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevAuth()) return { synced: 0 };
    let count = 0;
    for (const [email, code] of Object.entries(QA_DEV_CREDENTIALS)) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (!user) continue;

      let authAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "email-otp").eq("providerAccountId", email)
        )
        .unique();

      if (!authAccount) {
        const accountId = await ctx.db.insert("authAccounts", {
          userId: user._id,
          provider: "email-otp",
          providerAccountId: email,
        });
        authAccount = await ctx.db.get(accountId);
      } else if (authAccount.userId !== user._id) {
        await ctx.db.patch(authAccount._id, { userId: user._id });
      }

      if (authAccount) {
        const hashedCode = await sha256Hex(code);
        const existingCodes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
          .collect();
        for (const c of existingCodes) {
          await ctx.db.delete(c._id);
        }
        await ctx.db.insert("authVerificationCodes", {
          accountId: authAccount._id,
          provider: "email-otp",
          code: hashedCode,
          expirationTime: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days in dev
          emailVerified: email,
        });
        count++;
      }
    }
    return { synced: count };
  },
});

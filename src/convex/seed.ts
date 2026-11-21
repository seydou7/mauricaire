import { internalMutation } from "./_generated/server";

// Development seed fixtures: 4 verified Nouakchott healthcare professionals
// One per canonical Sprint 01 specialty (infirmier, aide_soignant, medecin, kinestherapeute)
export const SEED_PROVIDERS = [
  {
    email: "aminetou.dr@mauricaire.mr",
    name: "Dr. Aminetou Mint Mohamed",
    phone: "+222 45 12 34 56",
    city: "Nouakchott",
    latitude: 18.0934,
    longitude: -15.9754,
    role: "professionnel" as const,
    specialty: "medecin" as const,
    licenseNumber: "MED-MR-2024-001",
    bio: "Médecin généraliste diplômée avec plus de 12 ans d'expérience dans les soins à domicile et le suivi gériatrique.",
    yearsOfExperience: 12,
    consultationFee: 1500,
    languages: ["Français", "Arabe", "Hassaniya"],
    rating: 4.9,
    reviewCount: 28,
  },
  {
    email: "ahmedou.inf@mauricaire.mr",
    name: "Ahmedou Ould Bilal",
    phone: "+222 46 23 45 67",
    city: "Nouakchott",
    latitude: 18.0842,
    longitude: -15.9681,
    role: "professionnel" as const,
    specialty: "infirmier" as const,
    licenseNumber: "INF-MR-2024-042",
    bio: "Infirmier d'État spécialisé dans les pansements complexes, injections, perfusions et soins post-opératoires.",
    yearsOfExperience: 8,
    consultationFee: 800,
    languages: ["Français", "Hassaniya", "Pulaar"],
    rating: 4.8,
    reviewCount: 45,
  },
  {
    email: "fatimetou.aide@mauricaire.mr",
    name: "Fatimetou Mint Sall",
    phone: "+222 47 34 56 78",
    city: "Nouakchott",
    latitude: 18.0583,
    longitude: -15.9528,
    role: "professionnel" as const,
    specialty: "aide_soignant" as const,
    licenseNumber: "AS-MR-2024-019",
    bio: "Aide-soignante dévouée, accompagnement pour la toilette, l'alimentation, la mobilité et l'aide aux personnes âgées.",
    yearsOfExperience: 5,
    consultationFee: 500,
    languages: ["Français", "Hassaniya", "Wolof"],
    rating: 4.9,
    reviewCount: 32,
  },
  {
    email: "cheikh.kine@mauricaire.mr",
    name: "Cheikh Ould Sidi",
    phone: "+222 48 45 67 89",
    city: "Nouakchott",
    latitude: 18.0725,
    longitude: -15.9912,
    role: "professionnel" as const,
    specialty: "kinestherapeute" as const,
    licenseNumber: "KIN-MR-2024-007",
    bio: "Kinésithérapeute rééducateur, réhabilitation motrice à domicile, rééducation post-AVC et traumatologie.",
    yearsOfExperience: 7,
    consultationFee: 1200,
    languages: ["Français", "Arabe", "Hassaniya"],
    rating: 4.7,
    reviewCount: 19,
  },
];

/**
 * Development seed mutation.
 * STRICT REQUIREMENTS:
 * - Development-only: throws immediately if NODE_ENV === "production" without explicit DEV_AUTH override.
 * - Idempotent: checks existing records by email and license number; updates existing fixtures rather than creating duplicates.
 * - Controlled QA fixtures: seeds with verified = true and available = true for directory testing.
 */
export const seedDevProviders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const isDev = process.env.NODE_ENV !== "production" || process.env.DEV_AUTH === "true";
    if (!isDev) {
      throw new Error("Seed operations are strictly forbidden in production environments.");
    }

    const report: Array<{
      email: string;
      name: string;
      specialty: string;
      userId: string;
      providerId: string;
      status: "created" | "updated";
    }> = [];

    for (const fixture of SEED_PROVIDERS) {
      // 1. Check if user already exists
      let user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", fixture.email))
        .first();

      let userAction: "created" | "updated" = "updated";
      if (!user) {
        const newUserId = await ctx.db.insert("users", {
          email: fixture.email,
          name: fixture.name,
          phone: fixture.phone,
          city: fixture.city,
          latitude: fixture.latitude,
          longitude: fixture.longitude,
          role: fixture.role,
        });
        user = await ctx.db.get(newUserId);
        userAction = "created";
      } else {
        await ctx.db.patch(user._id, {
          name: fixture.name,
          phone: fixture.phone,
          city: fixture.city,
          latitude: fixture.latitude,
          longitude: fixture.longitude,
          role: fixture.role,
        });
      }

      if (!user) continue;

      // 2. Check if provider record already exists
      let provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();

      let providerAction: "created" | "updated" = userAction;
      if (!provider) {
        const providerId = await ctx.db.insert("providers", {
          userId: user._id,
          specialty: fixture.specialty,
          licenseNumber: fixture.licenseNumber,
          bio: fixture.bio,
          yearsOfExperience: fixture.yearsOfExperience,
          consultationFee: fixture.consultationFee,
          languages: fixture.languages,
          city: fixture.city,
          verified: true, // Approved QA fixture verification
          verificationStatus: "approved" as const,
          available: true, // Approved QA fixture availability
          rating: fixture.rating,
          reviewCount: fixture.reviewCount,
        });
        provider = await ctx.db.get(providerId);
        providerAction = "created";
      } else {
        await ctx.db.patch(provider._id, {
          specialty: fixture.specialty,
          licenseNumber: fixture.licenseNumber,
          bio: fixture.bio,
          yearsOfExperience: fixture.yearsOfExperience,
          consultationFee: fixture.consultationFee,
          languages: fixture.languages,
          city: fixture.city,
          verified: true,
          verificationStatus: "approved",
          available: true,
          rating: fixture.rating,
          reviewCount: fixture.reviewCount,
        });
      }

      report.push({
        email: fixture.email,
        name: fixture.name,
        specialty: fixture.specialty,
        userId: user._id,
        providerId: provider!._id,
        status: providerAction,
      });
    }

    return {
      success: true,
      message: "Development seed executed successfully",
      count: report.length,
      seeded: report,
    };
  },
});

// ===================== QA TEST IDENTITIES =====================
export const QA_ACCOUNTS = [
  {
    email: "qa.patient@mauricaire.local",
    role: "patient" as const,
    name: "Patient QA",
    phone: "+222 00 00 00 01",
    city: "Nouakchott",
    otp: "111111",
  },
  {
    email: "qa.infirmier@mauricaire.local",
    role: "professionnel" as const,
    specialty: "infirmier" as const,
    name: "Infirmier QA",
    phone: "+222 00 00 00 02",
    city: "Nouakchott",
    licenseNumber: "QA-INF-001",
    bio: "Compte de test MauriCare",
    yearsOfExperience: 5,
    consultationFee: 8000,
    verified: true,
    available: true,
    languages: ["Français", "Arabe"],
    otp: "222222",
  },
  {
    email: "qa.medecin@mauricaire.local",
    role: "professionnel" as const,
    specialty: "medecin" as const,
    name: "Médecin QA",
    phone: "+222 00 00 00 03",
    city: "Nouakchott",
    licenseNumber: "QA-MED-001",
    bio: "Compte de test Médecin MauriCare",
    yearsOfExperience: 10,
    consultationFee: 15000,
    verified: true,
    available: true,
    languages: ["Français", "Arabe"],
    otp: "333333",
  },
  {
    email: "qa.admin@mauricaire.local",
    role: "admin" as const,
    name: "Admin QA",
    phone: "+222 00 00 00 00",
    city: "Nouakchott",
    otp: "444444",
  },
  {
    email: "qa.pending.professionnel@mauricaire.local",
    role: "professionnel" as const,
    specialty: "infirmier" as const,
    name: "Professionnel QA En Attente",
    phone: "+222 00 00 00 04",
    city: "Nouakchott",
    licenseNumber: "QA-PENDING-001",
    bio: "Professionnel de santé en attente de vérification administrative",
    yearsOfExperience: 4,
    consultationFee: 6000,
    verified: false,
    available: false,
    languages: ["Français", "Arabe"],
    otp: "555555",
  },
];

async function hashOtp(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Provision development-only QA accounts for automated and end-to-end testing.
 * - Guarded strictly: only executes when DEV_AUTH === "true" or NODE_ENV !== "production".
 * - Whitelisted identities only (qa.patient, qa.infirmier, qa.medecin).
 * - Idempotent: safe to run multiple times without creating duplicates.
 * - Prepares Convex Auth credentials (authAccounts + authVerificationCodes with deterministic OTP).
 */
export const seedDevQaAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const isDev = process.env.NODE_ENV !== "production" || process.env.DEV_AUTH === "true";
    if (!isDev) {
      throw new Error("QA provisioning is strictly prohibited in production environments.");
    }

    const report: Array<{
      email: string;
      name: string;
      role: string;
      userId: string;
      providerId?: string;
      authAccountId: string;
      deterministicOtp: string;
      status: "created" | "updated";
    }> = [];

    for (const acc of QA_ACCOUNTS) {
      // 1. Check/create user document & clean any duplicates
      const existingUsers = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", acc.email))
        .collect();

      let user = existingUsers[0];
      let userStatus: "created" | "updated" = "updated";
      if (!user) {
        const newUserId = await ctx.db.insert("users", {
          email: acc.email,
          name: acc.name,
          phone: acc.phone,
          city: acc.city,
          role: acc.role,
        });
        user = (await ctx.db.get(newUserId))!;
        userStatus = "created";
      } else {
        await ctx.db.patch(user._id, {
          name: acc.name,
          phone: acc.phone,
          city: acc.city,
          role: acc.role,
        });
        // Deduplicate: remove any extraneous user records for this QA email
        for (let i = 1; i < existingUsers.length; i++) {
          await ctx.db.delete(existingUsers[i]._id);
        }
      }

      if (!user) continue;

      // 2. Check/create provider document for professionals
      let providerId: string | undefined = undefined;
      if (acc.role === "professionnel") {
        let provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .first();

        if (!provider) {
          const newProviderId = await ctx.db.insert("providers", {
            userId: user._id,
            specialty: acc.specialty,
            licenseNumber: acc.licenseNumber,
            bio: acc.bio,
            yearsOfExperience: acc.yearsOfExperience,
            consultationFee: acc.consultationFee,
            languages: acc.languages,
            city: acc.city,
            verified: acc.verified,
            verificationStatus: acc.verified ? ("approved" as const) : ("pending" as const),
            onboardingStatus: acc.verified ? ("approved" as const) : ("submitted" as const),
            available: acc.available,
            rating: 5.0,
            reviewCount: 1,
          });
          provider = await ctx.db.get(newProviderId);
        } else {
          await ctx.db.patch(provider._id, {
            specialty: acc.specialty,
            licenseNumber: acc.licenseNumber,
            bio: acc.bio,
            yearsOfExperience: acc.yearsOfExperience,
            consultationFee: acc.consultationFee,
            languages: acc.languages,
            city: acc.city,
            verified: acc.verified,
            verificationStatus: acc.verified ? ("approved" as const) : ("pending" as const),
            onboardingStatus: acc.verified ? ("approved" as const) : ("submitted" as const),
            available: acc.available,
          });
        }
        providerId = provider!._id;
      }

      // 3. Check/create authAccounts document & link strictly to user._id
      const existingAccounts = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "email-otp").eq("providerAccountId", acc.email)
        )
        .collect();

      let authAccount = existingAccounts[0];
      if (!authAccount) {
        const newAccountId = await ctx.db.insert("authAccounts", {
          userId: user._id,
          provider: "email-otp",
          providerAccountId: acc.email,
          emailVerified: acc.email,
        });
        authAccount = (await ctx.db.get(newAccountId))!;
      } else {
        await ctx.db.patch(authAccount._id, {
          userId: user._id,
          emailVerified: acc.email,
        });
        // Deduplicate: remove any extraneous authAccount records for this QA email
        for (let i = 1; i < existingAccounts.length; i++) {
          await ctx.db.delete(existingAccounts[i]._id);
        }
      }

      // 4. Provision deterministic dev OTP in authVerificationCodes
      const existingCodes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", authAccount!._id))
        .collect();

      for (const codeDoc of existingCodes) {
        await ctx.db.delete(codeDoc._id);
      }

      const hashedCode = await hashOtp(acc.otp);
      await ctx.db.insert("authVerificationCodes", {
        accountId: authAccount!._id,
        provider: "email-otp",
        code: hashedCode,
        expirationTime: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, // 10 years for stable dev QA
        emailVerified: acc.email,
      });

      report.push({
        email: acc.email,
        name: acc.name,
        role: acc.role,
        userId: user._id,
        providerId,
        authAccountId: authAccount!._id,
        deterministicOtp: acc.otp,
        status: userStatus,
      });
    }

    // 5. Provision dedicated Past Confirmed Appointment B for Final Human QA
    const patientUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.patient@mauricaire.local"))
      .first();

    const infirmierUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.infirmier@mauricaire.local"))
      .first();

    let appointmentBId: string | undefined = undefined;

    if (patientUser && infirmierUser) {
      const infirmierProvider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", infirmierUser._id))
        .first();

      if (infirmierProvider) {
        const existing = await ctx.db
          .query("appointments")
          .withIndex("by_provider", (q) => q.eq("providerId", infirmierProvider._id))
          .collect();

        const found = existing.find(
          (a) =>
            a.patientId === patientUser._id &&
            a.notes === "Fixture QA finale - consultation à clôturer"
        );

        if (!found) {
          const newId = await ctx.db.insert("appointments", {
            patientId: patientUser._id,
            providerId: infirmierProvider._id,
            serviceType: "Soin infirmier QA - Consultation à clôturer",
            date: "2026-09-01",
            time: "10:00",
            status: "confirme",
            paymentMethod: "cash",
            notes: "Fixture QA finale - consultation à clôturer",
            address: "Tevragh-Zeina, Adresse QA",
            duration: 30,
          });
          appointmentBId = newId;
        } else {
          appointmentBId = found._id;
        }
      }
    }

    return {
      success: true,
      message: "Development QA accounts and Final QA Appointment B provisioned successfully",
      count: report.length,
      accounts: report,
      appointmentBId,
    };
  },
});

/**
 * DEV-only mutation to reset the stable Past Confirmed Appointment B for Final Human QA.
 * - Idempotent: safe to run multiple times.
 * - Restores Appointment B to status="confirme" and clinicalReport=undefined.
 * - Deletes any QA reviews, vitals, and documents attached to Appointment B.
 * - Restores provider rating & review count to baseline.
 */
export const resetFinalQaFixture = internalMutation({
  args: {},
  handler: async (ctx) => {
    const isDev = process.env.NODE_ENV !== "production" || process.env.DEV_AUTH === "true";
    if (!isDev) {
      throw new Error("QA reset is strictly prohibited in production environments.");
    }

    const patientUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.patient@mauricaire.local"))
      .first();

    const infirmierUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "qa.infirmier@mauricaire.local"))
      .first();

    if (!patientUser || !infirmierUser) {
      throw new Error("Comptes QA manquants. Exécutez d'abord seedDevQaAccounts.");
    }

    const infirmierProvider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", infirmierUser._id))
      .first();

    if (!infirmierProvider) {
      throw new Error("Provider QA Infirmier manquant.");
    }

    // 1. Locate or create Appointment B
    const allAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q) => q.eq("providerId", infirmierProvider._id))
      .collect();

    let appointmentB: any = allAppointments.find(
      (a) =>
        a.patientId === patientUser._id &&
        a.notes === "Fixture QA finale - consultation à clôturer"
    );

    if (!appointmentB) {
      const newId = await ctx.db.insert("appointments", {
        patientId: patientUser._id,
        providerId: infirmierProvider._id,
        serviceType: "Soin infirmier QA - Consultation à clôturer",
        date: "2026-09-01",
        time: "10:00",
        status: "confirme",
        paymentMethod: "cash",
        notes: "Fixture QA finale - consultation à clôturer",
        address: "Tevragh-Zeina, Adresse QA",
        duration: 30,
      });
      appointmentB = await ctx.db.get(newId);
    } else {
      await ctx.db.patch(appointmentB._id, {
        status: "confirme",
        clinicalReport: undefined,
        cancellationReason: undefined,
        serviceType: "Soin infirmier QA - Consultation à clôturer",
        date: "2026-09-01",
        time: "10:00",
        address: "Tevragh-Zeina, Adresse QA",
        paymentMethod: "cash",
        duration: 30,
      });
      appointmentB = await ctx.db.get(appointmentB._id);
    }

    // 2. Remove any reviews attached to Appointment B
    const attachedReviews = await ctx.db
      .query("reviews")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentB!._id))
      .collect();

    for (const rev of attachedReviews) {
      await ctx.db.delete(rev._id);
    }

    // 3. Remove any vitals attached to Appointment B
    const attachedVitals = await ctx.db
      .query("patientVitals")
      .withIndex("by_appointmentId", (q) => q.eq("appointmentId", appointmentB!._id))
      .collect();

    for (const vit of attachedVitals) {
      await ctx.db.delete(vit._id);
    }

    // 4. Remove any medical documents attached to Appointment B
    const attachedDocs = await ctx.db
      .query("medicalDocuments")
      .withIndex("by_patientId", (q) => q.eq("patientId", patientUser._id))
      .collect();

    for (const doc of attachedDocs) {
      if (doc.appointmentId === appointmentB!._id || doc.name.includes("QA")) {
        await ctx.db.delete(doc._id);
      }
    }

    // 5. Recalculate Provider Rating & ReviewCount
    const remainingReviews = await ctx.db
      .query("reviews")
      .withIndex("by_provider", (q) => q.eq("providerId", infirmierProvider._id))
      .collect();

    const count = remainingReviews.length;
    const totalScore = remainingReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = count > 0 ? Math.round((totalScore / count) * 10) / 10 : 5.0;

    await ctx.db.patch(infirmierProvider._id, {
      rating: avgRating,
      reviewCount: count,
    });

    return {
      success: true,
      message: "Fixture QA finale (Appointment B) réinitialisée avec succès",
      appointmentB: {
        id: appointmentB!._id,
        patient: patientUser.name,
        provider: infirmierUser.name,
        serviceType: appointmentB!.serviceType,
        date: appointmentB!.date,
        time: appointmentB!.time,
        status: appointmentB!.status,
        hasClinicalReport: Boolean(appointmentB!.clinicalReport),
        reviewsCount: attachedReviews.length,
      },
    };
  },
});



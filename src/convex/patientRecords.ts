import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { ROLES, APPOINTMENT_STATUS } from "./schema";
import { getCareRelationship } from "./careRelationship";
import { isOperationalProfessional } from "./providers";
import { syncPatientVitalToChronic } from "./chronic";

/**
 * Calcul simple de l'âge à partir de la date de naissance.
 */
function calculateAge(birthDateString?: string): number {
  if (!birthDateString) return 45; // Valeur par défaut si non spécifiée
  const birthDate = new Date(birthDateString);
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 45;
}

/**
 * Récupération du profil médical du patient connecté.
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user || user.role !== ROLES.PATIENT) return null;

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const vitals = await ctx.db
      .query("patientVitals")
      .withIndex("by_patientId", (q) => q.eq("patientId", userId))
      .order("desc")
      .take(10);

    const documents = await ctx.db
      .query("medicalDocuments")
      .withIndex("by_patientId", (q) => q.eq("patientId", userId))
      .order("desc")
      .collect();

    const resolvedDocuments = await Promise.all(
      documents.map(async (d) => ({
        ...d,
        id: d._id,
        storageUrl: d.storageId ? await ctx.storage.getUrl(d.storageId) : null,
      }))
    );

    return {
      userId: user._id,
      name: user.name || "Patient",
      email: user.email || "",
      phone: user.phone || "",
      city: user.city || "Nouakchott",
      birthDate: profile?.birthDate || "1980-01-01",
      age: calculateAge(profile?.birthDate),
      sex: profile?.sex || "Non spécifié",
      bloodGroup: profile?.bloodGroup || "O+",
      allergies: profile?.allergies || [],
      primaryCondition: profile?.primaryCondition || "Suivi général",
      vitals,
      documents: resolvedDocuments,
    };
  },
});

/**
 * Mise à jour du profil médical par le patient connecté.
 */
export const updateMyProfile = mutation({
  args: {
    birthDate: v.optional(v.string()),
    sex: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    primaryCondition: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const user = await ctx.db.get(userId);
    if (!user || user.role !== ROLES.PATIENT) {
      throw new Error("Seul un patient peut mettre à jour son profil médical");
    }

    const existingProfile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        birthDate: args.birthDate ?? existingProfile.birthDate,
        sex: args.sex ?? existingProfile.sex,
        bloodGroup: args.bloodGroup ?? existingProfile.bloodGroup,
        allergies: args.allergies ?? existingProfile.allergies,
        primaryCondition: args.primaryCondition ?? existingProfile.primaryCondition,
      });
      return existingProfile._id;
    } else {
      const profileId = await ctx.db.insert("patientProfiles", {
        userId,
        birthDate: args.birthDate,
        sex: args.sex,
        bloodGroup: args.bloodGroup,
        allergies: args.allergies || [],
        primaryCondition: args.primaryCondition,
      });
      return profileId;
    }
  },
});

/**
 * Liste des patients suivis par le professionnel connecté.
 * Dérivée des rendez-vous réels de ce professionnel avec chaque patient.
 */
export const getPatientsForProvider = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!isOperationalProfessional(provider)) {
      return [];
    }

    // Récupérer tous les rendez-vous de ce professionnel
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
      .order("desc")
      .collect();

    // Extraire les identifiants distincts des patients ayant au moins 1 rdv confirmé ou terminé
    const validAppointments = appointments.filter(
      (a) =>
        a.status === APPOINTMENT_STATUS.CONFIRMED ||
        a.status === APPOINTMENT_STATUS.COMPLETED
    );
    const patientIds = Array.from(new Set(validAppointments.map((a) => a.patientId)));

    const patientsList = await Promise.all(
      patientIds.map(async (patientId) => {
        const patientUser = await ctx.db.get(patientId);
        if (!patientUser) return null;

        const profile = await ctx.db
          .query("patientProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", patientId))
          .first();

        const patientAppointments = appointments.filter((a) => a.patientId === patientId);

        // Prochain rendez-vous confirmé
        const nextConfirmed = patientAppointments.find(
          (a) => a.status === APPOINTMENT_STATUS.CONFIRMED
        );

        // Nombre de consultations terminées
        const completedCount = patientAppointments.filter(
          (a) => a.status === APPOINTMENT_STATUS.COMPLETED
        ).length;

        // Dernière consultation terminée ou dernier rendez-vous
        const latestAppt = patientAppointments[0];

        const initials = patientUser.name
          ? patientUser.name
              .split(" ")
              .map((n) => n[0])
              .join("")
          : "P";

        return {
          _id: patientUser._id,
          id: patientUser._id,
          name: patientUser.name || "Patient",
          phone: patientUser.phone || "",
          email: patientUser.email || "",
          address: patientUser.city || "Nouakchott",
          age: calculateAge(profile?.birthDate),
          sex: profile?.sex || "M",
          condition: profile?.primaryCondition || "Suivi régulier",
          bloodGroup: profile?.bloodGroup || "O+",
          consultationsCount: completedCount,
          nextVisit: nextConfirmed
            ? `${nextConfirmed.date} ${nextConfirmed.time}`
            : latestAppt
            ? `${latestAppt.date} ${latestAppt.time}`
            : "Aucune",
          image: initials,
        };
      })
    );

    return patientsList.filter((p) => p !== null);
  },
});

/**
 * Dossier médical complet d'un patient pour un professionnel autorisé.
 * Contrôle de sécurité strict : relation de soins établie requise (au moins 1 rendez-vous confirme ou termine).
 */
export const getPatientForProvider = query({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const relationship = await getCareRelationship(ctx.db, userId, args.patientId);
    if (!relationship.hasMedicalAccess) {
      throw new Error("Accès refusé : aucune relation de soins active (confirmée ou terminée) avec ce patient");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Profil professionnel de santé introuvable");
    }

    const appointmentsWithPatient = await ctx.db
      .query("appointments")
      .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .collect();

    const patientUser = await ctx.db.get(args.patientId);
    if (!patientUser) {
      throw new Error("Dossier patient introuvable");
    }

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientId))
      .first();

    // Constantes enregistrées
    const vitals = await ctx.db
      .query("patientVitals")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .take(20);

    // Documents et examens
    const documents = await ctx.db
      .query("medicalDocuments")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();

    // Historique des consultations terminées (status === "termine")
    const completedAppointments = appointmentsWithPatient
      .filter((a) => a.status === APPOINTMENT_STATUS.COMPLETED)
      .sort((a, b) => b._creationTime - a._creationTime);

    const consultationsHistory = completedAppointments.map((appt) => ({
      _id: appt._id,
      id: appt._id,
      date: appt.date,
      time: appt.time,
      type: appt.serviceType || "Consultation de soins",
      doctor: provider.specialty || "Soignant MauriCare",
      report: appt.clinicalReport || "Consultation effectuée et validée.",
      notes: appt.notes || "",
      duration: appt.duration ? `${appt.duration}min` : "45min",
    }));

    return {
      id: patientUser._id,
      name: patientUser.name || "Patient",
      age: calculateAge(profile?.birthDate),
      sex: profile?.sex || "Non spécifié",
      phone: patientUser.phone || "",
      email: patientUser.email || "",
      address: patientUser.city || "Nouakchott",
      bloodGroup: profile?.bloodGroup || "O+",
      allergies: profile?.allergies || [],
      primaryCondition: profile?.primaryCondition || "Suivi médical régulier",
      vitals: vitals.map((v) => ({
        id: v._id,
        bp: v.bloodPressure || "120/80",
        pulse: v.pulse || 72,
        date: new Date(v.recordedAt).toLocaleDateString("fr-FR"),
      })),
      history: consultationsHistory,
      documents: await Promise.all(
        documents.map(async (d) => ({
          id: d._id,
          _id: d._id,
          name: d.name,
          date: d.documentDate || new Date(d.createdAt).toLocaleDateString("fr-FR"),
          type: d.category,
          category: d.category,
          storageId: d.storageId,
          storageUrl: d.storageId ? await ctx.storage.getUrl(d.storageId) : null,
        }))
      ),
    };
  },
});

/**
 * Enregistrement de constantes (tension, pouls) par un professionnel autorisé.
 */
export const addVital = mutation({
  args: {
    patientId: v.id("users"),
    bloodPressure: v.optional(v.string()),
    pulse: v.optional(v.number()),
    temperature: v.optional(v.number()),
    appointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!provider) {
      throw new Error("Seul un soignant peut enregistrer des constantes");
    }

    // Vérifier la relation de soins médicale stricte (confirme ou termine)
    const relationship = await getCareRelationship(ctx.db, userId, args.patientId);
    if (!relationship.hasMedicalAccess) {
      throw new Error("Accès refusé : aucune relation de soins active (confirmée ou terminée) avec ce patient");
    }

    const now = Date.now();
    const vitalId = await ctx.db.insert("patientVitals", {
      patientId: args.patientId,
      recordedBy: userId,
      appointmentId: args.appointmentId,
      bloodPressure: args.bloodPressure,
      pulse: args.pulse,
      temperature: args.temperature,
      recordedAt: now,
    });

    // Synchronisation idempotente vers healthObservations (write-path Module 6)
    await syncPatientVitalToChronic(ctx, {
      vitalId,
      patientId: args.patientId,
      recordedBy: userId,
      bloodPressure: args.bloodPressure,
      pulse: args.pulse,
      temperature: args.temperature,
      recordedAt: now,
    });

    return vitalId;
  },
});

/**
 * Génération d'une URL de téléversement sécurisée via Convex Storage.
 * Vérifie l'autorisation d'accès médical (patient lui-même ou soignant autorisé).
 */
export const generateDocumentUploadUrl = mutation({
  args: {
    patientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const isSelf = args.patientId === userId;
    let isAuthorizedProvider = false;

    if (!isSelf) {
      const relationship = await getCareRelationship(ctx.db, userId, args.patientId);
      if (relationship.hasMedicalAccess) {
        isAuthorizedProvider = true;
      }
    }

    if (!isSelf && !isAuthorizedProvider) {
      throw new Error("Non autorisé à téléverser un document pour ce patient");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Ajout de document médical avec persistance de storageId dans Convex Storage.
 */
export const addDocument = mutation({
  args: {
    patientId: v.id("users"),
    name: v.string(),
    category: v.string(),
    documentDate: v.optional(v.string()),
    storageId: v.optional(v.string()),
    appointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const isSelf = args.patientId === userId;
    let isAuthorizedProvider = false;

    if (!isSelf) {
      const relationship = await getCareRelationship(ctx.db, userId, args.patientId);
      if (relationship.hasMedicalAccess) {
        isAuthorizedProvider = true;
      }
    }

    if (!isSelf && !isAuthorizedProvider) {
      throw new Error("Non autorisé à ajouter un document pour ce patient");
    }

    const cleanName = args.name.trim();
    if (!cleanName) {
      throw new Error("Le nom du document est obligatoire");
    }

    const docId = await ctx.db.insert("medicalDocuments", {
      patientId: args.patientId,
      uploadedBy: userId,
      appointmentId: args.appointmentId,
      name: cleanName,
      category: args.category,
      documentDate: args.documentDate || new Date().toISOString().split("T")[0],
      storageId: args.storageId,
      createdAt: Date.now(),
    });

    return docId;
  },
});


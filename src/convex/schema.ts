import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// MauriCare canonical business roles
export const ROLES = {
  PATIENT: "patient",
  PROFESSIONNEL: "professionnel",
  ADMIN: "admin",
  // Legacy template roles retained strictly for Convex Auth backward compatibility.
  // Not exposed as MauriCare business roles.
  LEGACY_USER: "user",
  LEGACY_MEMBER: "member",
} as const;

export const businessRoleValidator = v.union(
  v.literal(ROLES.PATIENT),
  v.literal(ROLES.PROFESSIONNEL),
  v.literal(ROLES.ADMIN),
);
export type BusinessRole = Infer<typeof businessRoleValidator>;

export const roleValidator = v.union(
  v.literal(ROLES.PATIENT),
  v.literal(ROLES.PROFESSIONNEL),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.LEGACY_USER),
  v.literal(ROLES.LEGACY_MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Healthcare provider specialties (Canonical Sprint 01)
export const SPECIALTIES = {
  NURSE: "infirmier",
  NURSING_ASSISTANT: "aide_soignant",
  DOCTOR: "medecin",
  PHYSICAL_THERAPIST: "kinestherapeute",
} as const;

export const specialtyValidator = v.union(
  v.literal(SPECIALTIES.NURSE),
  v.literal(SPECIALTIES.NURSING_ASSISTANT),
  v.literal(SPECIALTIES.DOCTOR),
  v.literal(SPECIALTIES.PHYSICAL_THERAPIST),
);
export type Specialty = Infer<typeof specialtyValidator>;

// Appointment statuses (Canonical MauriCare state machine)
export const APPOINTMENT_STATUS = {
  PENDING: "en_attente",
  CONFIRMED: "confirme",
  COMPLETED: "termine",
  CANCELLED: "annule",
} as const;

export const appointmentStatusValidator = v.union(
  v.literal(APPOINTMENT_STATUS.PENDING),
  v.literal(APPOINTMENT_STATUS.CONFIRMED),
  v.literal(APPOINTMENT_STATUS.COMPLETED),
  v.literal(APPOINTMENT_STATUS.CANCELLED),
);

// Professional onboarding statuses (Canonical MauriCare Phase 2)
export const ONBOARDING_STATUS = {
  REGISTRATION_STARTED: "registration_started",
  EMAIL_VERIFIED: "email_verified",
  ONBOARDING_INCOMPLETE: "onboarding_incomplete",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  COMPLEMENT_REQUIRED: "complement_required",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const onboardingStatusValidator = v.union(
  v.literal(ONBOARDING_STATUS.REGISTRATION_STARTED),
  v.literal(ONBOARDING_STATUS.EMAIL_VERIFIED),
  v.literal(ONBOARDING_STATUS.ONBOARDING_INCOMPLETE),
  v.literal(ONBOARDING_STATUS.SUBMITTED),
  v.literal(ONBOARDING_STATUS.UNDER_REVIEW),
  v.literal(ONBOARDING_STATUS.COMPLEMENT_REQUIRED),
  v.literal(ONBOARDING_STATUS.APPROVED),
  v.literal(ONBOARDING_STATUS.REJECTED),
);
export type OnboardingStatus = Infer<typeof onboardingStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      birthDate: v.optional(v.string()),
      gender: v.optional(v.union(v.literal("homme"), v.literal("femme"))),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      isProvider: v.optional(v.boolean()),
      specialty: v.optional(specialtyValidator),
      licenseNumber: v.optional(v.string()),
      bio: v.optional(v.string()),
      yearsOfExperience: v.optional(v.number()),
      verified: v.optional(v.boolean()),
      avatarStorageId: v.optional(v.string()),
      profileCompleted: v.optional(v.boolean()),
      emailVerified: v.optional(v.boolean()),
      neighborhood: v.optional(v.string()),
      deactivatedAt: v.optional(v.number()),
    }).index("email", ["email"]),

    // Healthcare providers directory
    providers: defineTable({
      userId: v.id("users"),
      specialty: specialtyValidator,
      licenseNumber: v.string(),
      professionalTitle: v.optional(v.string()),
      bio: v.optional(v.string()),
      yearsOfExperience: v.optional(v.number()),
      verified: v.boolean(),
      verificationStatus: v.optional(
        v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
      ),
      onboardingStatus: v.optional(onboardingStatusValidator),
      rejectionReason: v.optional(v.string()),
      adminComment: v.optional(v.string()),
      complementReasons: v.optional(v.array(v.string())),
      supportingDocumentStorageId: v.optional(v.string()),
      identityDocumentStorageId: v.optional(v.string()),
      identityDocumentName: v.optional(v.string()),
      identityDocumentType: v.optional(v.string()),
      professionalProofStorageId: v.optional(v.string()),
      professionalProofName: v.optional(v.string()),
      professionalProofType: v.optional(v.string()),
      city: v.string(),
      interventionZones: v.optional(v.array(v.string())),
      available: v.boolean(),
      isPublic: v.optional(v.boolean()),
      deactivated: v.optional(v.boolean()),
      consultationFee: v.optional(v.number()),
      languages: v.optional(v.array(v.string())),
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
      submittedAt: v.optional(v.number()),
      reviewedAt: v.optional(v.number()),
      reverificationRequired: v.optional(v.boolean()),
    })
      .index("by_userId", ["userId"])
      .index("by_specialty", ["specialty"])
      .index("by_city", ["city"])
      .index("by_available", ["available"])
      .index("by_verified", ["verified"])
      .index("by_verificationStatus", ["verificationStatus"])
      .index("by_onboardingStatus", ["onboardingStatus"])
      .index("by_verified_available", ["verified", "available"]),

    // Appointments / bookings
    appointments: defineTable({
      patientId: v.id("users"),
      providerId: v.id("providers"),
      serviceType: v.optional(v.string()),
      serviceId: v.optional(v.id("providerServices")),
      serviceSnapshot: v.optional(
        v.object({
          name: v.string(),
          price: v.number(),
          duration: v.number(),
        })
      ),
      date: v.string(),
      time: v.string(),
      status: appointmentStatusValidator,
      paymentMethod: v.optional(v.literal("cash")),
      notes: v.optional(v.string()),
      address: v.optional(v.string()),
      zone: v.optional(v.string()),
      duration: v.optional(v.number()), // in minutes
      cancellationReason: v.optional(v.string()),
      clinicalReport: v.optional(v.string()),
      recurrenceSeriesId: v.optional(v.id("recurrenceSeries")),
      occurrenceIndex: v.optional(v.number()),
      beneficiaryId: v.optional(v.id("users")), // Module 5 future circle booking
      bookedByUserId: v.optional(v.id("users")), // Module 5 actor who booked if delegated
    })
      .index("by_patient", ["patientId"])
      .index("by_patient_date", ["patientId", "date"])
      .index("by_provider", ["providerId"])
      .index("by_status", ["status"])
      .index("by_date", ["date"])
      .index("by_provider_status", ["providerId", "status"])
      .index("by_provider_date", ["providerId", "date"])
      .index("by_recurrence", ["recurrenceSeriesId"])
      .index("by_beneficiary", ["beneficiaryId"])
      .index("by_bookedBy", ["bookedByUserId"]),

    // Messages between patients and providers
    messages: defineTable({
      senderId: v.id("users"),
      receiverId: v.id("users"),
      appointmentId: v.optional(v.id("appointments")),
      content: v.string(),
      read: v.boolean(),
    })
      .index("by_sender", ["senderId"])
      .index("by_receiver", ["receiverId"])
      .index("by_appointment", ["appointmentId"])
      .index("by_receiver_read", ["receiverId", "read"])
      .index("by_sender_receiver", ["senderId", "receiverId"]),

    // Reviews and ratings
    reviews: defineTable({
      patientId: v.id("users"),
      providerId: v.id("providers"),
      appointmentId: v.id("appointments"),
      rating: v.number(),
      comment: v.optional(v.string()),
    })
      .index("by_provider", ["providerId"])
      .index("by_patient", ["patientId"])
      .index("by_appointment", ["appointmentId"]),

    // Patient medical profile
    patientProfiles: defineTable({
      userId: v.id("users"),
      birthDate: v.optional(v.string()),
      sex: v.optional(v.string()),
      bloodGroup: v.optional(v.string()),
      allergies: v.optional(v.array(v.string())),
      primaryCondition: v.optional(v.string()),
    }).index("by_userId", ["userId"]),

    // Patient vitals
    patientVitals: defineTable({
      patientId: v.id("users"),
      recordedBy: v.id("users"),
      appointmentId: v.optional(v.id("appointments")),
      bloodPressure: v.optional(v.string()),
      pulse: v.optional(v.number()),
      temperature: v.optional(v.number()),
      recordedAt: v.number(),
    })
      .index("by_patientId", ["patientId"])
      .index("by_appointmentId", ["appointmentId"]),

    // Medical documents metadata
    medicalDocuments: defineTable({
      patientId: v.id("users"),
      uploadedBy: v.id("users"),
      appointmentId: v.optional(v.id("appointments")),
      name: v.string(),
      category: v.string(),
      documentDate: v.optional(v.string()),
      storageId: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_patientId", ["patientId"]),

    // Notifications
    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      titleAr: v.optional(v.string()),
      message: v.string(),
      messageAr: v.optional(v.string()),
      type: v.union(v.literal("info"), v.literal("alert"), v.literal("reminder")),
      read: v.boolean(),
      link: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_user_read", ["userId", "read"]),

    // Security: Server-side rate limiting tracking
    rateLimits: defineTable({
      key: v.string(),
      attempts: v.number(),
      windowStart: v.number(),
      lockedUntil: v.optional(v.number()),
    }).index("by_key", ["key"]),

    // Security: Email verification, Password reset & Email change OTP tracking
    verificationTokens: defineTable({
      identifier: v.string(), // email
      purpose: v.union(
        v.literal("email_verification"),
        v.literal("password_reset"),
        v.literal("email_change")
      ),
      codeHash: v.string(), // SHA-256 hash of 6-digit OTP
      targetEmail: v.optional(v.string()), // target new email for email_change flow
      attempts: v.number(),
      expiresAt: v.number(),
      lastSentAt: v.number(),
      used: v.boolean(),
    })
      .index("by_identifier_purpose", ["identifier", "purpose"])
      .index("by_identifier", ["identifier"]),

    // Professional onboarding: Private verification documents
    providerDocuments: defineTable({
      providerId: v.id("providers"),
      userId: v.id("users"),
      category: v.union(v.literal("identity"), v.literal("professional_proof"), v.literal("other")),
      documentType: v.string(), // "cni", "passport", "diplome", "carte_pro", "autorisation", "autre"
      storageId: v.string(),
      originalName: v.string(),
      mimeType: v.string(),
      size: v.number(),
      uploadedAt: v.number(),
    })
      .index("by_providerId", ["providerId"])
      .index("by_userId", ["userId"]),

    // Professional onboarding: Audit trail of verification lifecycle
    verificationHistory: defineTable({
      providerId: v.id("providers"),
      userId: v.id("users"),
      action: v.union(
        v.literal("onboarding_started"),
        v.literal("dossier_submitted"),
        v.literal("review_started"),
        v.literal("complement_requested"),
        v.literal("dossier_resubmitted"),
        v.literal("approved"),
        v.literal("rejected")
      ),
      previousStatus: v.optional(v.string()),
      newStatus: v.string(),
      adminId: v.optional(v.id("users")),
      reasons: v.optional(v.array(v.string())),
      comment: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_providerId", ["providerId"])
      .index("by_userId", ["userId"]),

    // Patient Emergency Contacts (designed for single primary now, multiple in future)
    emergencyContacts: defineTable({
      userId: v.id("users"),
      fullName: v.string(),
      relationship: v.string(), // "conjoint", "parent", "enfant", "frere_soeur", "ami", "proche", "autre"
      phone: v.string(),
      email: v.optional(v.string()),
      notes: v.optional(v.string()),
      isPrimary: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_userId", ["userId"]),

    // Account Security Audit Log
    securityEvents: defineTable({
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
      timestamp: v.number(),
      metadata: v.optional(v.string()),
    })
      .index("by_userId", ["userId"])
      .index("by_timestamp", ["timestamp"]),

    // Module 4: Professional Healthcare Services Catalog
    providerServices: defineTable({
      providerId: v.id("providers"),
      canonicalServiceId: v.string(),
      customLabel: v.optional(v.string()),
      description: v.optional(v.string()),
      price: v.number(), // in MRU
      duration: v.number(), // in minutes
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_providerId", ["providerId"])
      .index("by_provider_active", ["providerId", "active"]),

    // Module 4: Provider Weekly Recurring Availability
    providerAvailability: defineTable({
      providerId: v.id("providers"),
      weeklySchedule: v.array(
        v.object({
          dayOfWeek: v.number(), // 1 = Monday, ..., 7 = Sunday
          enabled: v.boolean(),
          periods: v.array(
            v.object({
              start: v.string(), // "08:30"
              end: v.string(), // "12:30"
            })
          ),
        })
      ),
      leadTimeMinutes: v.optional(v.number()), // default 60 min
      slotDurationMinutes: v.optional(v.number()), // default 30 min
      updatedAt: v.number(),
    }).index("by_providerId", ["providerId"]),

    // Module 4: Provider Specific Date Exceptions
    providerExceptions: defineTable({
      providerId: v.id("providers"),
      date: v.string(), // "YYYY-MM-DD"
      isUnavailable: v.boolean(),
      periods: v.optional(
        v.array(
          v.object({
            start: v.string(),
            end: v.string(),
          })
        )
      ),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_providerId", ["providerId"])
      .index("by_provider_date", ["providerId", "date"]),

    // Module 4: Provider Leaves / Vacation Periods
    providerLeaves: defineTable({
      providerId: v.id("providers"),
      startDate: v.string(), // "YYYY-MM-DD"
      endDate: v.string(), // "YYYY-MM-DD"
      reason: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_providerId", ["providerId"]),

    // Module 4: Patient Favorites
    patientFavorites: defineTable({
      userId: v.id("users"),
      providerId: v.id("providers"),
      createdAt: v.number(),
    })
      .index("by_userId", ["userId"])
      .index("by_user_provider", ["userId", "providerId"]),

    // Module 4: Recurring Care Series
    recurrenceSeries: defineTable({
      patientId: v.id("users"),
      providerId: v.id("providers"),
      serviceId: v.optional(v.id("providerServices")),
      serviceSnapshot: v.optional(
        v.object({
          name: v.string(),
          price: v.number(),
          duration: v.number(),
        })
      ),
      rule: v.union(v.literal("daily"), v.literal("weekly"), v.literal("custom_weekdays")),
      weekdays: v.optional(v.array(v.number())), // 1=Mon ... 7=Sun
      startDate: v.string(), // "YYYY-MM-DD"
      time: v.string(), // "09:00"
      totalOccurrences: v.number(),
      address: v.string(),
      notes: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
      beneficiaryId: v.optional(v.id("users")),
      bookedByUserId: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_patient", ["patientId"])
      .index("by_provider", ["providerId"]),

    // =========================================================================
    // MODULE 5: MAURICARE CIRCLE (Cercle de proches & coordination familiale)
    // =========================================================================

    // Patient's circle container
    circles: defineTable({
      patientId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_patientId", ["patientId"]),

    // Authorized Circle members
    circleMembers: defineTable({
      circleId: v.id("circles"),
      patientId: v.id("users"), // Patient owner of the circle
      memberUserId: v.id("users"), // The invited authenticated user
      relationship: v.union(
        v.literal("child"),
        v.literal("spouse"),
        v.literal("parent"),
        v.literal("sibling"),
        v.literal("family"),
        v.literal("caregiver"),
        v.literal("trusted_person"),
        v.literal("other")
      ),
      status: v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
      permissions: v.array(v.string()),
      invitedAt: v.number(),
      acceptedAt: v.number(),
      revokedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_circle", ["circleId"])
      .index("by_patientId", ["patientId"])
      .index("by_memberUserId", ["memberUserId"])
      .index("by_patient_and_member", ["patientId", "memberUserId"])
      .index("by_member_status", ["memberUserId", "status"]),

    // Circle invitations for trusted persons
    circleInvitations: defineTable({
      circleId: v.id("circles"),
      patientId: v.id("users"),
      inviteeEmail: v.string(),
      relationship: v.string(),
      permissions: v.array(v.string()),
      token: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("expired"),
        v.literal("cancelled")
      ),
      expiresAt: v.number(),
      invitedAt: v.number(),
      respondedAt: v.optional(v.number()),
    })
      .index("by_token", ["token"])
      .index("by_circle", ["circleId"])
      .index("by_patientId", ["patientId"])
      .index("by_inviteeEmail", ["inviteeEmail"])
      .index("by_patient_email", ["patientId", "inviteeEmail"]),

    // Circle security & privacy audit trail
    circleAuditEvents: defineTable({
      circleId: v.id("circles"),
      patientId: v.id("users"),
      actorUserId: v.id("users"),
      membershipId: v.optional(v.id("circleMembers")),
      invitationId: v.optional(v.id("circleInvitations")),
      action: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })
      .index("by_circle", ["circleId"])
      .index("by_patientId", ["patientId"])
      .index("by_actor", ["actorUserId"]),

    // =========================================================================
    // MODULE 6: MAURICARE RELAY (Collaboration clinique & continuité des soins)
    // =========================================================================

    // Relay consultation requests between healthcare professionals
    relayRequests: defineTable({
      patientId: v.id("users"), // Patient receiving care
      requestingProviderId: v.id("providers"), // Approved provider requesting assistance
      requestingUserId: v.id("users"), // User account of requesting provider
      requestedSpecialty: specialtyValidator, // Required specialty (medecin, infirmier, etc.)
      assignedProviderId: v.optional(v.id("providers")), // Responding professional if assigned/accepted
      assignedUserId: v.optional(v.id("users")), // User account of responding provider
      appointmentId: v.optional(v.id("appointments")), // Optional triggering visit
      reason: v.string(), // Clinical reason for request
      urgencyLevel: v.union(v.literal("standard"), v.literal("priority")),
      status: v.union(
        v.literal("draft"),
        v.literal("requested"),
        v.literal("accepted"),
        v.literal("in_progress"),
        v.literal("answered"),
        v.literal("completed"),
        v.literal("declined"),
        v.literal("cancelled")
      ),
      clinicalContext: v.object({
        observations: v.string(),
        carePerformed: v.optional(v.string()),
        symptoms: v.optional(v.array(v.string())),
      }),
      selectedVitals: v.optional(
        v.object({
          bloodPressure: v.optional(v.string()),
          pulse: v.optional(v.number()),
          temperature: v.optional(v.number()),
          spO2: v.optional(v.number()),
          recordedAt: v.optional(v.number()),
        })
      ),
      attachments: v.optional(
        v.array(
          v.object({
            storageId: v.string(),
            name: v.string(),
            mimeType: v.string(),
            size: v.number(),
            category: v.optional(v.string()), // "wound_photo", "care_document", "lab_extract"
          })
        )
      ),
      professionalResponse: v.optional(
        v.object({
          summary: v.string(),
          professionalOpinion: v.string(),
          recommendedNextStep: v.string(),
          followUpAdvised: v.boolean(),
          responderUserId: v.id("users"),
          respondedAt: v.number(),
        })
      ),
      relayOutcome: v.optional(v.string()), // Patient-safe care summary
      createdAt: v.number(),
      acceptedAt: v.optional(v.number()),
      answeredAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
    })
      .index("by_patient", ["patientId"])
      .index("by_requester", ["requestingProviderId"])
      .index("by_responder", ["assignedProviderId"])
      .index("by_status", ["status"])
      .index("by_specialty", ["requestedSpecialty"])
      .index("by_specialty_status", ["requestedSpecialty", "status"])
      .index("by_appointment", ["appointmentId"])
      .index("by_created", ["createdAt"]),

    // Professional-to-Professional conversation messages within a Relay request
    relayMessages: defineTable({
      relayId: v.id("relayRequests"),
      senderUserId: v.id("users"),
      senderProviderId: v.id("providers"),
      content: v.string(),
      attachments: v.optional(
        v.array(
          v.object({
            storageId: v.string(),
            name: v.string(),
            mimeType: v.string(),
            size: v.number(),
          })
        )
      ),
      createdAt: v.number(),
    })
      .index("by_relay", ["relayId"])
      .index("by_relay_created", ["relayId", "createdAt"]),

    // Relay security & clinical traceability audit events
    relayAuditEvents: defineTable({
      relayId: v.id("relayRequests"),
      patientId: v.id("users"),
      actorUserId: v.id("users"),
      actorProviderId: v.optional(v.id("providers")),
      action: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })
      .index("by_relay", ["relayId"])
      .index("by_patient", ["patientId"])
      .index("by_actor", ["actorUserId"]),

    // =========================================================================
    // MODULE 7: MAURICARE HOMELAB (Prélèvements à domicile & analyses médicales)
    // =========================================================================

    // Catalogue canonique des analyses de laboratoire
    labTestCatalog: defineTable({
      code: v.string(), // "nfs", "glycemia", "creatinine", etc.
      name: v.string(), // "Numération Formule Sanguine (NFS)"
      nameAr: v.string(), // Libellé en Arabe
      category: v.string(), // "hematologie", "biochimie", "metabolique", "lipidique", "autre"
      sampleType: v.string(), // "sang_total", "serum", "plasma", "urines"
      fastingRequired: v.boolean(),
      prescriptionRequired: v.boolean(),
      preparationInstructions: v.optional(v.string()),
      preparationInstructionsAr: v.optional(v.string()),
      indicativePrice: v.number(), // in MRU
      active: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_category", ["category"])
      .index("by_active", ["active"]),

    // Laboratoires partenaires agréés
    laboratoryPartners: defineTable({
      name: v.string(),
      code: v.string(), // e.g. "lab-central-nkc", "lab-chiss-nkc"
      phone: v.string(),
      email: v.string(),
      address: v.string(),
      city: v.string(),
      active: v.boolean(),
      supportedCategories: v.array(v.string()),
      openingHours: v.optional(v.string()),
      collectionFee: v.number(), // frais de déplacement à domicile en MRU
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_active", ["active"]),

    // Utilisateurs rattachés à un laboratoire partenaire
    laboratoryUsers: defineTable({
      userId: v.id("users"),
      laboratoryId: v.id("laboratoryPartners"),
      role: v.union(v.literal("lab_tech"), v.literal("lab_manager"), v.literal("lab_director")),
      active: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_lab", ["laboratoryId"])
      .index("by_user_lab", ["userId", "laboratoryId"]),

    // Demandes d'analyses et de prélèvements HomeLab
    homeLabRequests: defineTable({
      sampleCode: v.string(), // Code de suivi convivial: HL-2026-XXXX
      patientId: v.id("users"), // Patient bénéficiaire
      actorUserId: v.id("users"), // Auteur de la commande (patient, soignant ou proche mandaté)
      actorType: v.union(v.literal("patient"), v.literal("circle_member"), v.literal("professional")),
      laboratoryId: v.optional(v.id("laboratoryPartners")),
      appointmentId: v.optional(v.id("appointments")), // Lien optionnel avec visite
      status: v.union(
        v.literal("requested"),
        v.literal("validated"),
        v.literal("scheduled"),
        v.literal("collector_assigned"),
        v.literal("collection_in_progress"),
        v.literal("sample_collected"),
        v.literal("in_transit"),
        v.literal("received_by_lab"),
        v.literal("processing"),
        v.literal("result_available"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rejected"),
        v.literal("collection_failed")
      ),
      scheduledDate: v.string(), // "YYYY-MM-DD"
      scheduledTimeSlot: v.string(), // "08:00 - 10:00"
      address: v.string(),
      city: v.string(),
      phone: v.string(),
      patientNotes: v.optional(v.string()),
      prescriptionStorageId: v.optional(v.string()), // Ordonnance numérisée
      collectorId: v.optional(v.id("providers")), // Soignant / préleveur assigné
      collectorName: v.optional(v.string()),
      collectionFailureReason: v.optional(v.string()),
      pricingSnapshot: v.optional(
        v.object({
          collectionFee: v.number(),
          analysesAmount: v.number(),
          totalAmount: v.number(),
          currency: v.string(),
        })
      ),
      collectedAt: v.optional(v.number()),
      receivedByLabAt: v.optional(v.number()),
      resultPublishedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_patient", ["patientId"])
      .index("by_actor", ["actorUserId"])
      .index("by_lab", ["laboratoryId"])
      .index("by_collector", ["collectorId"])
      .index("by_status", ["status"])
      .index("by_sampleCode", ["sampleCode"])
      .index("by_scheduledDate", ["scheduledDate"]),

    // Détail des analyses incluses dans une demande (plusieurs analyses par prélèvement)
    homeLabRequestItems: defineTable({
      requestId: v.id("homeLabRequests"),
      testCatalogId: v.id("labTestCatalog"),
      testCode: v.string(),
      testName: v.string(),
      category: v.string(),
      indicativePrice: v.number(),
      fastingRequired: v.boolean(),
    })
      .index("by_request", ["requestId"])
      .index("by_test", ["testCode"]),

    // Résultats d'analyses émis par le laboratoire partenaire
    homeLabResults: defineTable({
      requestId: v.id("homeLabRequests"),
      patientId: v.id("users"),
      laboratoryId: v.id("laboratoryPartners"),
      status: v.union(v.literal("draft"), v.literal("published"), v.literal("amended")),
      version: v.number(), // 1 pour original, 2+ pour amendements
      documentStorageId: v.optional(v.string()), // PDF officiel du laboratoire
      generalConclusion: v.optional(v.string()), // Conclusion rédigée par le biologiste
      structuredResults: v.optional(
        v.array(
          v.object({
            testName: v.string(),
            analyte: v.string(),
            value: v.string(),
            unit: v.optional(v.string()),
            referenceRange: v.optional(v.string()),
            abnormalFlag: v.optional(v.boolean()),
            comment: v.optional(v.string()),
          })
        )
      ),
      publishedByUserId: v.id("users"),
      publishedAt: v.number(),
      amendmentReason: v.optional(v.string()),
      previousResultId: v.optional(v.id("homeLabResults")),
    })
      .index("by_request", ["requestId"])
      .index("by_patient", ["patientId"])
      .index("by_lab", ["laboratoryId"])
      .index("by_status", ["status"]),

    // Journal d'audit et de traçabilité HomeLab
    homeLabAuditEvents: defineTable({
      requestId: v.id("homeLabRequests"),
      patientId: v.id("users"),
      actorUserId: v.id("users"),
      action: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })
      .index("by_request", ["requestId"])
      .index("by_patient", ["patientId"])
      .index("by_actor", ["actorUserId"]),

    // =========================================================================
    // MODULE 8: MAURICARE CHRONIC (Suivi longitudinal & constantes de santé)
    // =========================================================================

    // Catalogue des pathologies et situations de suivi longitudinal
    conditionCatalog: defineTable({
      code: v.string(), // "hypertension", "diabete_t2", "suivi_post_operatoire", etc.
      label: v.string(), // "Hypertension Artérielle (HTA)"
      labelAr: v.string(), // Libellé Arabe
      category: v.string(), // "chronique", "post_operatoire", "temporaire", "cardiometabolique", "respiratoire"
      description: v.optional(v.string()),
      defaultMeasurementCodes: v.array(v.string()), // e.g. ["bp", "pulse"]
      active: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_category", ["category"])
      .index("by_active", ["active"]),

    // Affectation d'un état de santé ou pathologie à un patient
    patientConditions: defineTable({
      patientId: v.id("users"),
      conditionCode: v.string(),
      conditionName: v.string(),
      type: v.union(v.literal("clinical_confirmed"), v.literal("self_monitoring")),
      status: v.union(v.literal("active"), v.literal("resolved"), v.literal("paused")),
      diagnosedAt: v.optional(v.number()),
      confirmedByUserId: v.optional(v.id("users")), // Si validé formellement par un soignant
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_patient", ["patientId"])
      .index("by_patient_status", ["patientId", "status"]),

    // Programmes de suivi longitudinal (actifs, en pause, terminés)
    monitoringPrograms: defineTable({
      patientId: v.id("users"),
      conditionCode: v.optional(v.string()),
      title: v.string(), // e.g. "Protocole Surveillance Tensionnelle", "Suivi Post-Chirurgie"
      titleAr: v.optional(v.string()),
      programType: v.union(
        v.literal("clinical_followup"),
        v.literal("self_monitoring"),
        v.literal("post_operative"),
        v.literal("temporary_rehab")
      ),
      measurementCodes: v.array(v.string()), // e.g. ["bp", "pulse"]
      expectedFrequency: v.string(), // "daily", "twice_daily", "weekly", "as_needed"
      status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("cancelled")),
      responsibleProviderId: v.optional(v.id("providers")),
      responsibleUserId: v.optional(v.id("users")),
      startDate: v.string(), // "YYYY-MM-DD"
      endDate: v.optional(v.string()), // "YYYY-MM-DD"
      notes: v.optional(v.string()),
      shareWithCircle: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_patient", ["patientId"])
      .index("by_patient_status", ["patientId", "status"])
      .index("by_provider", ["responsibleProviderId"]),

    // Définitions canoniques des grandeurs de mesures
    measurementDefinitions: defineTable({
      code: v.string(), // "bp", "pulse", "glucose", "temperature", "weight", "spo2", "hba1c", "pain_score"
      name: v.string(),
      nameAr: v.string(),
      category: v.string(), // "vital", "metabolic", "renal", "respiratory", "symptom"
      unit: v.string(), // "mmHg", "bpm", "mg/dL", "°C", "kg", "%", "score 0-10"
      isPaired: v.optional(v.boolean()), // true pour tension (systolique + diastolique)
      minPlausible: v.optional(v.number()),
      maxPlausible: v.optional(v.number()),
      active: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_category", ["category"]),

    // Série temporelle d'observations de santé longitudinales
    healthObservations: defineTable({
      patientId: v.id("users"),
      monitoringProgramId: v.optional(v.id("monitoringPrograms")),
      measurementCode: v.string(), // "bp", "pulse", "glucose", "temperature", "weight", "spo2", "hba1c", "pain_score"
      numericValue: v.optional(v.number()),
      secondaryNumericValue: v.optional(v.number()), // Pression diastolique pour "bp"
      textValue: v.optional(v.string()), // Observations qualitatives
      unit: v.string(),
      observedAt: v.number(), // Date/heure réelle du relevé (UTC timestamp)
      recordedAt: v.number(), // Date/heure de saisie dans MauriCare
      recordedByUserId: v.id("users"),
      recordedByRole: v.string(), // "patient", "professionnel", "circle_member", "system"
      source: v.union(
        v.literal("patient_manual"),
        v.literal("professional_manual"),
        v.literal("consultation"),
        v.literal("homelab"),
        v.literal("connected_device")
      ),
      sourceReferenceId: v.optional(v.string()), // Idempotence : appointmentId, homeLabResultId, vitalId
      context: v.optional(v.string()), // "a_jeun", "apres_repas", "au_repos", "apres_effort"
      notes: v.optional(v.string()),
      attentionFlag: v.optional(v.boolean()),
      attentionSeverity: v.optional(v.string()), // "info", "warning"
      isCorrected: v.optional(v.boolean()),
      correctionReason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_patient", ["patientId"])
      .index("by_patient_measurement", ["patientId", "measurementCode"])
      .index("by_patient_measurement_observed", ["patientId", "measurementCode", "observedAt"])
      .index("by_patient_observed", ["patientId", "observedAt"])
      .index("by_program", ["monitoringProgramId"])
      .index("by_source_ref", ["sourceReferenceId"]),

    // Règles d'attention de surveillance clinique configurées (Seuils non-alarmistes)
    monitoringRules: defineTable({
      monitoringProgramId: v.optional(v.id("monitoringPrograms")),
      measurementCode: v.string(),
      lowerBound: v.optional(v.number()),
      upperBound: v.optional(v.number()),
      secondaryLowerBound: v.optional(v.number()),
      secondaryUpperBound: v.optional(v.number()),
      severity: v.union(v.literal("info"), v.literal("warning")),
      messageFr: v.string(),
      messageAr: v.string(),
      enabled: v.boolean(),
      protocolReference: v.optional(v.string()),
      configuredByUserId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_measurement", ["measurementCode"])
      .index("by_program", ["monitoringProgramId"]),

    // Traçabilité et audit des programmes de surveillance
    monitoringAuditEvents: defineTable({
      patientId: v.id("users"),
      actorUserId: v.id("users"),
      action: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })
      .index("by_patient", ["patientId"])
      .index("by_actor", ["actorUserId"]),

    // ==========================================
    // MODULE 9 : MAURICARE VOICE AI
    // ==========================================

    // Métadonnées d'interaction vocale & conversationnelle (Sans stockage audio permanent)
    assistantInteractions: defineTable({
      userId: v.id("users"),
      role: v.string(), // "patient" | "professionnel" | "admin"
      inputMode: v.union(v.literal("voice"), v.literal("text")),
      language: v.string(), // "fr" | "ar"
      sanitizedTranscript: v.optional(v.string()), // Minimisé, sans données médicales excessives
      detectedIntent: v.string(),
      status: v.union(
        v.literal("completed"),
        v.literal("clarification_needed"),
        v.literal("ready_for_confirmation"),
        v.literal("cancelled"),
        v.literal("failed")
      ),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_created", ["createdAt"]),

    // Registre d'audit immuable des actions concrètes déclenchées via l'assistant
    assistantActionAudit: defineTable({
      userId: v.id("users"),
      role: v.string(),
      intent: v.string(),
      actionName: v.string(),
      beneficiaryId: v.optional(v.id("users")),
      targetEntityId: v.optional(v.string()),
      confirmedAt: v.number(),
      executionStatus: v.union(v.literal("success"), v.literal("error")),
      details: v.optional(v.any()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_intent", ["intent"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

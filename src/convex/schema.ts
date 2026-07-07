import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Healthcare provider specialties
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

// Appointment statuses
export const APPOINTMENT_STATUS = {
  PENDING: "en_attente",
  CONFIRMED: "confirme",
  IN_PROGRESS: "en_cours",
  COMPLETED: "termine",
  CANCELLED: "annule",
} as const;

export const appointmentStatusValidator = v.union(
  v.literal(APPOINTMENT_STATUS.PENDING),
  v.literal(APPOINTMENT_STATUS.CONFIRMED),
  v.literal(APPOINTMENT_STATUS.IN_PROGRESS),
  v.literal(APPOINTMENT_STATUS.COMPLETED),
  v.literal(APPOINTMENT_STATUS.CANCELLED),
);

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
      phone: v.optional(v.string()),
      city: v.optional(v.string()),
      isProvider: v.optional(v.boolean()),
      specialty: v.optional(specialtyValidator),
      licenseNumber: v.optional(v.string()),
      bio: v.optional(v.string()),
      yearsOfExperience: v.optional(v.number()),
      verified: v.optional(v.boolean()),
    }).index("email", ["email"]),

    // Healthcare providers directory
    providers: defineTable({
      userId: v.id("users"),
      specialty: specialtyValidator,
      licenseNumber: v.string(),
      bio: v.optional(v.string()),
      yearsOfExperience: v.optional(v.number()),
      verified: v.boolean(),
      city: v.string(),
      available: v.boolean(),
      consultationFee: v.optional(v.number()),
      languages: v.optional(v.array(v.string())),
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
    })
      .index("by_userId", ["userId"])
      .index("by_specialty", ["specialty"])
      .index("by_city", ["city"])
      .index("by_available", ["available"]),

    // Appointments / bookings
    appointments: defineTable({
      patientId: v.id("users"),
      providerId: v.id("providers"),
      date: v.string(),
      time: v.string(),
      status: appointmentStatusValidator,
      notes: v.optional(v.string()),
      address: v.optional(v.string()),
      duration: v.optional(v.number()), // in minutes
      cancellationReason: v.optional(v.string()),
    })
      .index("by_patient", ["patientId"])
      .index("by_provider", ["providerId"])
      .index("by_status", ["status"])
      .index("by_date", ["date"]),

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
      .index("by_appointment", ["appointmentId"]),

    // Reviews and ratings
    reviews: defineTable({
      patientId: v.id("users"),
      providerId: v.id("providers"),
      appointmentId: v.id("appointments"),
      rating: v.number(),
      comment: v.optional(v.string()),
    })
      .index("by_provider", ["providerId"])
      .index("by_patient", ["patientId"]),

    // Notifications
    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      message: v.string(),
      type: v.union(v.literal("info"), v.literal("alert"), v.literal("reminder")),
      read: v.boolean(),
      link: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_user_read", ["userId", "read"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

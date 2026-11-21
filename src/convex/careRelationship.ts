import { GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import { Id, DataModel } from "./_generated/dataModel";
import { APPOINTMENT_STATUS, ROLES } from "./schema";

/**
 * Shared Care-Relationship Authorization Helper
 * 
 * Defines centralized security rules for access between Patients and Healthcare Professionals:
 * 
 * 1. MEDICAL RECORD ACCESS:
 *    Allowed ONLY if there is at least one appointment with status:
 *    - "confirme"
 *    - "termine"
 *    Statuses "en_attente" and "annule" alone NEVER grant medical record access.
 * 
 * 2. MESSAGING-SEND ACCESS:
 *    Allowed if there is at least one appointment with status:
 *    - "en_attente"
 *    - "confirme"
 *    - "termine"
 *    Status "annule" alone does NOT authorize initiating or sending new messages.
 * 
 * 3. MESSAGING-READ ACCESS (HISTORICAL):
 *    Allowed if a valid messaging-send relationship exists OR if historical messages
 *    already exist between the caller and the counterpart.
 */

export interface CareRelationshipResult {
  hasMedicalAccess: boolean;
  hasMessagingAccess: boolean;
  providerId?: Id<"providers">;
  patientId?: Id<"users">;
  professionalUserId?: Id<"users">;
}

/**
 * Resolves relationship between two users (e.g. caller and counterpart).
 */
export async function getCareRelationship(
  db: GenericDatabaseReader<DataModel>,
  userAId: Id<"users">,
  userBId: Id<"users">
): Promise<CareRelationshipResult> {
  if (userAId === userBId) {
    return { hasMedicalAccess: true, hasMessagingAccess: true };
  }

  const userA = await db.get(userAId);
  const userB = await db.get(userBId);
  if (!userA || !userB) {
    return { hasMedicalAccess: false, hasMessagingAccess: false };
  }

  // Check for Admin: Admin is never part of healthcare clinical messaging or medical records
  if (userA.role === ROLES.ADMIN || userB.role === ROLES.ADMIN) {
    return { hasMedicalAccess: false, hasMessagingAccess: false };
  }

  // Identify who is Patient and who is Professional
  let patientUserId: Id<"users"> | undefined;
  let professionalUserId: Id<"users"> | undefined;
  let isSenderPatient = false;
  let isSenderProfessional = false;

  if (userA.role === ROLES.PATIENT && userB.role === ROLES.PROFESSIONNEL) {
    patientUserId = userAId;
    professionalUserId = userBId;
    isSenderPatient = true;
  } else if (userB.role === ROLES.PATIENT && userA.role === ROLES.PROFESSIONNEL) {
    patientUserId = userBId;
    professionalUserId = userAId;
    isSenderProfessional = true;
  } else {
    // Patient-Patient and Professional-Professional messaging is strictly denied
    return { hasMedicalAccess: false, hasMessagingAccess: false };
  }

  // Find provider record for professional
  const provider = await db
    .query("providers")
    .withIndex("by_userId", (q) => q.eq("userId", professionalUserId!))
    .first();

  if (!provider) {
    return { hasMedicalAccess: false, hasMessagingAccess: false };
  }

  // Retrieve appointments between this provider and patient
  const appointments = await db
    .query("appointments")
    .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
    .filter((q) => q.eq(q.field("patientId"), patientUserId!))
    .collect();

  // 1. Medical Record: strictly "confirme" or "termine"
  const hasMedicalAccess = appointments.some(
    (a) =>
      a.status === APPOINTMENT_STATUS.CONFIRMED ||
      a.status === APPOINTMENT_STATUS.COMPLETED
  );

  // 2. Messaging Access:
  let hasMessagingAccess = false;

  if (isSenderPatient) {
    // PATIENT -> PROFESSIONAL:
    // Allowed when target is a real Provider linked to a professionnel user and verified === true
    hasMessagingAccess = provider.verified === true;
  } else if (isSenderProfessional) {
    // PROFESSIONAL -> PATIENT:
    // Allowed when:
    // A. An eligible appointment relationship exists: "en_attente", "confirme", "termine"
    const hasEligibleAppointment = appointments.some(
      (a) =>
        a.status === APPOINTMENT_STATUS.PENDING ||
        a.status === APPOINTMENT_STATUS.CONFIRMED ||
        a.status === APPOINTMENT_STATUS.COMPLETED
    );

    if (hasEligibleAppointment) {
      hasMessagingAccess = true;
    } else {
      // B. OR that Patient already initiated a legitimate conversation with this Professional
      const patientInitiated = await db
        .query("messages")
        .withIndex("by_sender_receiver", (q) =>
          q.eq("senderId", patientUserId!).eq("receiverId", professionalUserId!)
        )
        .first();

      hasMessagingAccess = !!patientInitiated;
    }
  }

  return {
    hasMedicalAccess,
    hasMessagingAccess,
    providerId: provider._id,
    patientId: patientUserId,
    professionalUserId,
  };
}

/**
 * Deterministically parses MauriCare appointment date (YYYY-MM-DD) and time (HH:mm)
 * into a UTC epoch timestamp in milliseconds.
 * Mauritania is strictly on UTC/GMT (GMT+0) year-round.
 */
export function parseAppointmentUtcTimestamp(dateStr: string, timeStr: string): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const [hoursStr, minutesStr] = timeStr.split(":");

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed month
  const day = parseInt(dayStr, 10);
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hours) ||
    isNaN(minutes)
  ) {
    throw new Error(`Format de date/heure invalide: ${dateStr} ${timeStr}`);
  }

  return Date.UTC(year, month, day, hours, minutes, 0, 0);
}

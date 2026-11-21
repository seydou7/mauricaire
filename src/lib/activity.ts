import { getLocalizedServiceLabel } from "./services";

export interface ActivityNotification {
  _id?: string;
  id?: string;
  title?: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  type?: "info" | "alert" | "reminder";
  _creationTime?: number;
  createdAt?: number;
  eventCode?: string;
  eventData?: any;
}

/**
 * Parses legacy French activity strings and converts them into structured semantic data.
 */
function parseLegacyFrenchActivity(text: string): {
  type: string;
  patientName?: string;
  delegatedBy?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  count?: string;
  senderName?: string;
} | null {
  const clean = text.trim();

  // Pattern 1: Consultation booked (with optional delegation)
  // e.g. "sidi dio^ (réservé par son proche test invit) a réservé une consultation (Pansement simple ou complexe) pour le 2026-11-20 à 16:00"
  const r1 = /^(.*?)(?:\s*\(réservé par son proche\s+(.*?)\))?\s+a réservé une consultation\s+\((.*?)\)\s+pour(?: le)?\s+(\d{4}-\d{2}-\d{2})\s+à\s+(\d{1,2}:\d{2})\.?$/i;
  const m1 = r1.exec(clean);
  if (m1) {
    return {
      type: "consultation_booked",
      patientName: m1[1].trim(),
      delegatedBy: m1[2]?.trim(),
      serviceName: m1[3].trim(),
      date: m1[4].trim(),
      time: m1[5].trim(),
    };
  }

  // Pattern 2: Series scheduled (with optional delegation)
  // e.g. "sidi dio^ (réservé par son proche test invit) a programmé une série de 5 séances (Pansement simple ou complexe) à partir du 2026-11-20 à 16:00"
  const r2 = /^(.*?)(?:\s*\(réservé par son proche\s+(.*?)\))?\s+a programmé une série de\s+(\d+)\s+séances\s+\((.*?)\)\s+à partir du\s+(\d{4}-\d{2}-\d{2})\s+à\s+(\d{1,2}:\d{2})\.?$/i;
  const m2 = r2.exec(clean);
  if (m2) {
    return {
      type: "series_scheduled",
      patientName: m2[1].trim(),
      delegatedBy: m2[2]?.trim(),
      count: m2[3].trim(),
      serviceName: m2[4].trim(),
      date: m2[5].trim(),
      time: m2[6].trim(),
    };
  }

  // Pattern 3: New message received
  // e.g. "Vous avez reçu un nouveau message de sidi dio^"
  const r3 = /^Vous avez reçu un nouveau message de\s+(.*?)\.?$/i;
  const m3 = r3.exec(clean);
  if (m3) {
    return {
      type: "new_message",
      senderName: m3[1].trim(),
    };
  }

  // Pattern 4: Booked for you
  // e.g. "test invit a réservé une consultation (Pansement simple ou complexe) pour vous le 2026-11-20 à 16:00."
  const r4 = /^(.*?)\s+a réservé une consultation\s+\((.*?)\)\s+pour vous le\s+(\d{4}-\d{2}-\d{2})\s+à\s+(\d{1,2}:\d{2})\.?$/i;
  const m4 = r4.exec(clean);
  if (m4) {
    return {
      type: "booked_for_you",
      patientName: m4[1].trim(),
      serviceName: m4[2].trim(),
      date: m4[3].trim(),
      time: m4[4].trim(),
    };
  }

  // Pattern 5: Series planned for patient
  // e.g. "Une série de 5 séances (Pansement simple ou complexe) a été planifiée pour sidi dio^."
  const r5 = /^Une série de\s+(\d+)\s+séances\s+\((.*?)\)\s+a été planifiée pour\s+(.*?)\.?$/i;
  const m5 = r5.exec(clean);
  if (m5) {
    return {
      type: "series_planned_for",
      count: m5[1].trim(),
      serviceName: m5[2].trim(),
      patientName: m5[3].trim(),
    };
  }

  // Pattern 6: Appointment reserved for patient
  // e.g. "Un rendez-vous (Pansement simple ou complexe) a été réservé pour sidi dio^ le 2026-11-20 à 16:00."
  const r6 = /^Un rendez-vous\s+\((.*?)\)\s+a été réservé pour\s+(.*?)\s+le\s+(\d{4}-\d{2}-\d{2})\s+à\s+(\d{1,2}:\d{2})\.?$/i;
  const m6 = r6.exec(clean);
  if (m6) {
    return {
      type: "appointment_reserved_for",
      serviceName: m6[1].trim(),
      patientName: m6[2].trim(),
      date: m6[3].trim(),
      time: m6[4].trim(),
    };
  }

  // Pattern 7: Status notifications
  if (/Votre demande de consultation.*?confirmée/i.test(clean)) {
    return { type: "consultation_confirmed" };
  }
  if (/Votre consultation.*?clôturée/i.test(clean)) {
    return { type: "consultation_completed" };
  }
  if (/Votre rendez-vous.*?annulé/i.test(clean)) {
    return { type: "appointment_cancelled" };
  }

  return null;
}

/**
 * Formats an activity notification into localized text (FR or AR).
 * In Arabic mode, translates the grammatical structure and medical vocabulary
 * while preserving patient and doctor names with auto-direction.
 */
export function formatLocalizedActivity(
  notification: ActivityNotification | null | undefined,
  lang: string
): string {
  if (!notification) return "";

  const isAr = lang === "ar";

  // If already in French and notification has standard French message
  if (!isAr) {
    return notification.message;
  }

  // If explicit Arabic translation is stored in the database
  if (notification.messageAr) {
    return notification.messageAr;
  }

  // Parse legacy French message
  const parsed = parseLegacyFrenchActivity(notification.message);
  if (!parsed) {
    // If not matching legacy patterns, return original message
    return notification.message;
  }

  const localizedService = parsed.serviceName
    ? getLocalizedServiceLabel(parsed.serviceName, "ar")
    : "";

  switch (parsed.type) {
    case "consultation_booked": {
      const delegated = parsed.delegatedBy ? ` (حجزه قريبه ${parsed.delegatedBy})` : "";
      return `${parsed.patientName}${delegated} حجز استشارة (${localizedService}) ليوم ${parsed.date} في ${parsed.time}`;
    }

    case "series_scheduled": {
      const delegated = parsed.delegatedBy ? ` (برمجه قريبه ${parsed.delegatedBy})` : "";
      return `${parsed.patientName}${delegated} برمج سلسلة من ${parsed.count} جلسات (${localizedService}) ابتداءً من ${parsed.date} في ${parsed.time}`;
    }

    case "new_message":
      return `لقد تلقيت رسالة جديدة من ${parsed.senderName}`;

    case "booked_for_you":
      return `قام ${parsed.patientName} بحجز استشارة (${localizedService}) لك ليوم ${parsed.date} في ${parsed.time}`;

    case "series_planned_for":
      return `تمت برمجة سلسلة من ${parsed.count} جلسات (${localizedService}) للمريض ${parsed.patientName}`;

    case "appointment_reserved_for":
      return `تم حجز موعد (${localizedService}) للمريض ${parsed.patientName} ليوم ${parsed.date} في ${parsed.time}`;

    case "consultation_confirmed":
      return `تم تأكيد طلب الاستشارة الخاص بك.`;

    case "consultation_completed":
      return `تم اختتام الاستشارة الخاصة بك.`;

    case "appointment_cancelled":
      return `تم إلغاء الموعد الخاص بك.`;

    default:
      return notification.message;
  }
}

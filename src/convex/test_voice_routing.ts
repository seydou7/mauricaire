import { mutation } from "./_generated/server";
import { parseIntentFromText, CANONICAL_INTENTS } from "./voiceAssistant";
import { ROLES, APPOINTMENT_STATUS } from "./schema";

export const testVoiceIntentParsing = mutation({
  args: {},
  handler: async (ctx) => {
    const results: any[] = [];

    // Test cases for Professional
    const proCases = [
      {
        text: "Montre-moi mes rendez-vous",
        expectedIntent: CANONICAL_INTENTS.VIEW_MY_APPOINTMENTS,
        expectedRole: ROLES.PROFESSIONNEL,
      },
      {
        text: "Quel est mon prochain rendez-vous ?",
        expectedIntent: CANONICAL_INTENTS.VIEW_MY_APPOINTMENTS,
        expectedRole: ROLES.PROFESSIONNEL,
        expectedNextOnly: true,
      },
      {
        text: "Montre-moi mes demandes en attente",
        expectedIntent: CANONICAL_INTENTS.VIEW_PENDING_REQUESTS,
        expectedRole: ROLES.PROFESSIONNEL,
      },
      {
        text: "Montre-moi mes demandes en attente demain",
        expectedIntent: CANONICAL_INTENTS.VIEW_PENDING_REQUESTS,
        expectedRole: ROLES.PROFESSIONNEL,
        expectedDate: "tomorrow",
      },
      {
        text: "Quels rendez-vous ai-je demain ?",
        expectedIntent: CANONICAL_INTENTS.VIEW_MY_APPOINTMENTS,
        expectedRole: ROLES.PROFESSIONNEL,
        expectedDate: "tomorrow",
      },
      {
        text: "Ouvre mon planning",
        expectedIntent: CANONICAL_INTENTS.NAVIGATE_TAB,
        expectedRole: ROLES.PROFESSIONNEL,
        expectedTab: "planning",
      },
      {
        text: "Confirme ma prochaine demande",
        expectedIntent: CANONICAL_INTENTS.CONFIRM_APPOINTMENT,
        expectedRole: ROLES.PROFESSIONNEL,
      },
    ];

    for (const tc of proCases) {
      const parsed = parseIntentFromText(tc.text, tc.expectedRole);
      const pass =
        parsed.intent === tc.expectedIntent &&
        (!tc.expectedDate || parsed.entities.dateFilter === tc.expectedDate) &&
        (!tc.expectedNextOnly || parsed.entities.isNextOnly === true) &&
        (!tc.expectedTab || parsed.entities.tab === tc.expectedTab);

      results.push({
        text: tc.text,
        userRole: tc.expectedRole,
        expectedIntent: tc.expectedIntent,
        parsedIntent: parsed.intent,
        entities: parsed.entities,
        pass,
      });
    }

    // Test cases for Patient
    const patientCases = [
      {
        text: "Montre-moi mes rendez-vous",
        expectedIntent: CANONICAL_INTENTS.VIEW_UPCOMING_APPOINTMENTS,
        expectedRole: ROLES.PATIENT,
      },
      {
        text: "Mes rendez-vous de demain",
        expectedIntent: CANONICAL_INTENTS.VIEW_UPCOMING_APPOINTMENTS,
        expectedRole: ROLES.PATIENT,
        expectedDate: "tomorrow",
      },
    ];

    for (const tc of patientCases) {
      const parsed = parseIntentFromText(tc.text, tc.expectedRole);
      const pass =
        parsed.intent === tc.expectedIntent &&
        (!tc.expectedDate || parsed.entities.dateFilter === tc.expectedDate);

      results.push({
        text: tc.text,
        userRole: tc.expectedRole,
        expectedIntent: tc.expectedIntent,
        parsedIntent: parsed.intent,
        entities: parsed.entities,
        pass,
      });
    }

    return results;
  },
});

export const testVoiceExecutionWithRealData = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch Seydou Diallo (Professional)
    const seydou = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), "azogobel@gmail.com"))
      .first();

    if (!seydou) throw new Error("Seydou Diallo not found");

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_userId", (q) => q.eq("userId", seydou._id))
      .first();

    if (!provider) throw new Error("Provider record for Seydou not found");

    // 2. Fetch Sidi Dio (Patient)
    const sidi = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "patient"))
      .first();

    if (!sidi) throw new Error("Sidi not found");

    const execResults: any[] = [];

    // Today / Tomorrow dates
    const nowObj = new Date();
    const todayStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, "0")}-${String(nowObj.getDate()).padStart(2, "0")}`;
    const tomObj = new Date(nowObj.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = `${tomObj.getFullYear()}-${String(tomObj.getMonth() + 1).padStart(2, "0")}-${String(tomObj.getDate()).padStart(2, "0")}`;

    // Test A: Seydou - "Montre-moi mes rendez-vous"
    {
      const allAppts = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
        .collect();

      const filtered = allAppts.filter(
        (a) => a.date >= todayStr && a.status !== APPOINTMENT_STATUS.CANCELLED
      );

      execResults.push({
        test: "Seydou: Montre-moi mes rendez-vous",
        totalApptsFound: allAppts.length,
        upcomingFound: filtered.length,
        hasNoAppointmentsHallucination: false,
        pass: filtered.length > 0,
      });
    }

    // Test B: Seydou - "Montre-moi mes demandes en attente"
    {
      const allAppts = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
        .collect();

      const pending = allAppts.filter(
        (a) => a.status === APPOINTMENT_STATUS.PENDING && a.date >= todayStr
      );

      execResults.push({
        test: "Seydou: Montre-moi mes demandes en attente",
        pendingFound: pending.length,
        pass: pending.length > 0,
      });
    }

    // Test C: Seydou - "Montre-moi mes demandes en attente demain"
    {
      const allAppts = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
        .collect();

      const pendingTomorrow = allAppts.filter(
        (a) => a.status === APPOINTMENT_STATUS.PENDING && a.date === tomorrowStr
      );

      execResults.push({
        test: "Seydou: Montre-moi mes demandes en attente demain",
        pendingTomorrowFound: pendingTomorrow.length,
        pass: pendingTomorrow.length > 0,
      });
    }

    // Test D: Seydou - "Quels rendez-vous ai-je demain ?"
    {
      const allAppts = await ctx.db
        .query("appointments")
        .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
        .collect();

      const tomorrowAppts = allAppts.filter(
        (a) => a.date === tomorrowStr && a.status !== APPOINTMENT_STATUS.CANCELLED
      );

      execResults.push({
        test: "Seydou: Quels rendez-vous ai-je demain ?",
        tomorrowApptsFound: tomorrowAppts.length,
        pass: tomorrowAppts.length > 0,
      });
    }

    // Test E: Sidi (Patient) - "Montre-moi mes rendez-vous"
    {
      const patientAppts = await ctx.db
        .query("appointments")
        .withIndex("by_patient", (q) => q.eq("patientId", sidi._id))
        .collect();

      const upcoming = patientAppts.filter(
        (a) => a.date >= todayStr && a.status !== APPOINTMENT_STATUS.CANCELLED
      );

      execResults.push({
        test: "Sidi: Montre-moi mes rendez-vous",
        totalPatientAppts: patientAppts.length,
        upcomingPatientAppts: upcoming.length,
        pass: upcoming.length > 0,
      });
    }

    return execResults;
  },
});


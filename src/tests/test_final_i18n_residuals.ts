import { CANONICAL_SERVICES } from "../convex/serviceCatalog";
import {
  getLocalizedServiceLabel,
  getLocalizedSpecialtyLabel,
  getLocalizedAppointmentNote,
} from "../lib/services";
import { formatLocalizedActivity } from "../lib/activity";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("TEST SUITE: FINAL I18N RESIDUALS & BUSINESS VOCABULARY");
console.log("=======================================================\n");

// --- 1. SERVICE LOCALIZATION TESTS ---
console.log("1. Canonical Service Localization");

// Test specific Human QA blocker: Pansement simple ou complexe
const pansementAr = getLocalizedServiceLabel("Pansement simple ou complexe", "ar");
assert(
  pansementAr === "تضميد الجروح البسيطة والمعقدة",
  `'Pansement simple ou complexe' in AR -> '${pansementAr}' (expected 'تضميد الجروح البسيطة والمعقدة')`
);

const pansementFr = getLocalizedServiceLabel("Pansement simple ou complexe", "fr");
assert(
  pansementFr === "Pansement simple ou complexe",
  `'Pansement simple ou complexe' in FR -> '${pansementFr}' (expected 'Pansement simple ou complexe')`
);

// Test canonical ID resolution
const pansementByIdAr = getLocalizedServiceLabel("infirmier_pansement", "ar");
assert(
  pansementByIdAr === "تضميد الجروح البسيطة والمعقدة",
  `'infirmier_pansement' by ID in AR -> '${pansementByIdAr}'`
);

// Test all canonical services bidirectional
let allCanonicalPassed = true;
for (const svc of CANONICAL_SERVICES) {
  const arVal = getLocalizedServiceLabel(svc.label, "ar");
  const frVal = getLocalizedServiceLabel(svc.label, "fr");
  if (arVal !== svc.labelAr || frVal !== svc.label) {
    allCanonicalPassed = false;
    console.error(`Mismatch for canonical service ${svc.id}: AR='${arVal}', expected='${svc.labelAr}'`);
  }
}
assert(allCanonicalPassed, `All ${CANONICAL_SERVICES.length} canonical services translate symmetrically between FR and AR`);

// Test snapshot object resolution
const snapshotObj = { name: "Injection (IM / SC / IV directe)", price: 200, duration: 20 };
assert(
  getLocalizedServiceLabel(snapshotObj, "ar") === "حقن (عضلي / تحت الجلد / وريدي مباشر)",
  "Snapshot object localized correctly in AR"
);
assert(
  getLocalizedServiceLabel(snapshotObj, "fr") === "Injection (IM / SC / IV directe)",
  "Snapshot object localized correctly in FR"
);

// --- 2. SPECIALTY & NOTES LOCALIZATION ---
console.log("\n2. Specialty & Controlled Note Localization");

assert(getLocalizedSpecialtyLabel("infirmier", "ar") === "ممرض(ة) دولة", "Specialty 'infirmier' -> 'ممرض(ة) دولة'");
assert(getLocalizedSpecialtyLabel("infirmier", "fr") === "Infirmier(ère) d'État", "Specialty 'infirmier' -> 'Infirmier(ère) d'État'");
assert(getLocalizedSpecialtyLabel("kinestherapeute", "ar") === "أخصائي علاج طبيعي", "Specialty 'kinestherapeute' -> 'أخصائي علاج طبيعي'");
assert(getLocalizedSpecialtyLabel("aide_soignant", "ar") === "مساعد(ة) تمريض", "Specialty 'aide_soignant' -> 'مساعد(ة) تمريض'");

// Controlled note vs User free text
const defaultNoteAr = getLocalizedAppointmentNote("Demande de prise en charge à domicile", "ar");
assert(defaultNoteAr === "طلب رعاية صحية منزلية", "System default note translated in AR");

const defaultNoteFr = getLocalizedAppointmentNote("Demande de prise en charge à domicile", "fr");
assert(defaultNoteFr === "Demande de prise en charge à domicile", "System default note in FR");

const userFreeNote = "Patient diabétique sous insuline, sonner à la porte gauche";
assert(
  getLocalizedAppointmentNote(userFreeNote, "ar") === userFreeNote,
  "User free-text note strictly preserved without machine alteration in AR"
);
assert(
  getLocalizedAppointmentNote(userFreeNote, "fr") === userFreeNote,
  "User free-text note strictly preserved without machine alteration in FR"
);

// --- 3. RECENT ACTIVITY FEED LOCALIZATION ---
console.log("\n3. Recent Activity Feed Semantic Localization");

// Test QA sentence 1: Delegated booking
const qaActivity1 = {
  message: "sidi dio^ (réservé par son proche test invit) a réservé une consultation (Pansement simple ou complexe) pour le 2026-11-20 à 16:00",
};
const formatted1Ar = formatLocalizedActivity(qaActivity1, "ar");
assert(
  formatted1Ar.includes("sidi dio^") &&
  formatted1Ar.includes("test invit") &&
  formatted1Ar.includes("تضميد الجروح البسيطة والمعقدة") &&
  formatted1Ar.includes("2026-11-20") &&
  formatted1Ar.includes("16:00"),
  `QA Activity 1 AR formatted accurately: '${formatted1Ar}'`
);

const formatted1Fr = formatLocalizedActivity(qaActivity1, "fr");
assert(
  formatted1Fr === qaActivity1.message,
  "QA Activity 1 in FR returns original French message cleanly"
);

// Test QA sentence 2: Recurring series
const qaActivity2 = {
  message: "sidi dio^ a programmé une série de 5 séances (Pansement simple ou complexe) à partir du 2026-11-20 à 16:00.",
};
const formatted2Ar = formatLocalizedActivity(qaActivity2, "ar");
assert(
  formatted2Ar.includes("sidi dio^") &&
  formatted2Ar.includes("5") &&
  formatted2Ar.includes("تضميد الجروح البسيطة والمعقدة") &&
  formatted2Ar.includes("2026-11-20"),
  `QA Activity 2 AR formatted accurately: '${formatted2Ar}'`
);

// Test QA sentence 3: Direct message
const qaActivity3 = {
  message: "Vous avez reçu un nouveau message de sidi dio^",
};
const formatted3Ar = formatLocalizedActivity(qaActivity3, "ar");
assert(
  formatted3Ar === "لقد تلقيت رسالة جديدة من sidi dio^",
  `QA Activity 3 AR formatted accurately: '${formatted3Ar}'`
);

// Test notification with explicit messageAr
const notificationWithExplicitAr = {
  message: "Message en français",
  messageAr: "رسالة بالعربية من قاعدة البيانات",
};
assert(
  formatLocalizedActivity(notificationWithExplicitAr, "ar") === "رسالة بالعربية من قاعدة البيانات",
  "Explicit DB messageAr takes precedence in AR mode"
);
assert(
  formatLocalizedActivity(notificationWithExplicitAr, "fr") === "Message en français",
  "Explicit DB message in FR mode returns French"
);

// --- 4. LANDING PAGE I18N PARITY & COVERAGE ---
console.log("\n4. Landing Page Translation Parity & Coverage");

const frPath = path.resolve(process.cwd(), "src/locales/fr/translation.json");
const arPath = path.resolve(process.cwd(), "src/locales/ar/translation.json");
const frData = JSON.parse(fs.readFileSync(frPath, "utf8"));
const arData = JSON.parse(fs.readFileSync(arPath, "utf8"));

function getLeafKeys(obj: any, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k in obj) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getLeafKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const allFrKeys = getLeafKeys(frData);
const allArKeys = getLeafKeys(arData);

assert(allFrKeys.length === allArKeys.length, `100% leaf count parity: FR=${allFrKeys.length}, AR=${allArKeys.length}`);

const missingInAr = allFrKeys.filter((k) => !allArKeys.includes(k));
const missingInFr = allArKeys.filter((k) => !allFrKeys.includes(k));
assert(missingInAr.length === 0, `Zero missing keys in AR (missing: ${missingInAr.length})`);
assert(missingInFr.length === 0, `Zero missing keys in FR (missing: ${missingInFr.length})`);

// Verify landing namespace completeness
const requiredLandingKeys = [
  "landing.hero_badge",
  "landing.hero_title_prefix",
  "landing.hero_title_highlight",
  "landing.hero_subtitle",
  "landing.hero_cta_patient",
  "landing.hero_cta_pro",
  "landing.trust_free",
  "landing.trust_secure",
  "landing.trust_247",
  "landing.why_title",
  "landing.why_subtitle",
  "landing.feature_search_title",
  "landing.feature_search_desc",
  "landing.feature_booking_title",
  "landing.feature_booking_desc",
  "landing.feature_record_title",
  "landing.feature_record_desc",
  "landing.section_patients_badge",
  "landing.section_patients_title",
  "landing.section_patients_desc",
  "landing.section_dashboard_badge",
  "landing.section_dashboard_title",
  "landing.section_dashboard_desc",
  "landing.section_pro_badge",
  "landing.section_pro_title",
  "landing.section_pro_desc",
  "landing.how_it_works_title",
  "landing.step_1_title",
  "landing.step_2_title",
  "landing.step_3_title",
  "landing.final_cta_title",
  "landing.final_cta_desc",
  "landing.final_cta_patient",
  "landing.final_cta_pro",
  "landing.footer_tagline",
  "landing.footer_quick_links",
  "landing.footer_features",
  "landing.footer_how_it_works",
  "landing.footer_signup_patient",
  "landing.footer_signup_pro",
  "landing.footer_contact_support",
  "landing.footer_address",
  "landing.footer_all_rights",
  "landing.footer_made_with",
  "landing.footer_for_mauritania",
];

let allLandingKeysPresent = true;
for (const k of requiredLandingKeys) {
  if (!allFrKeys.includes(k) || !allArKeys.includes(k)) {
    allLandingKeysPresent = false;
    console.error(`Missing required landing key: ${k}`);
  }
}
assert(allLandingKeysPresent, `All ${requiredLandingKeys.length} landing page keys are present in both FR and AR`);

console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}

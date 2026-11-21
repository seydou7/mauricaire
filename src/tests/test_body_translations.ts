import fs from "fs";
import path from "path";

console.log("==================================================");
console.log("MAURICARE BODY CONTENT LOCALIZATION TEST SUITE");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

const localesDir = path.resolve(process.cwd(), "src/locales");
const frJson = JSON.parse(fs.readFileSync(path.join(localesDir, "fr/translation.json"), "utf8"));
const arJson = JSON.parse(fs.readFileSync(path.join(localesDir, "ar/translation.json"), "utf8"));

function getLeafPaths(obj: any, prefix = ""): string[] {
  let paths: string[] = [];
  for (const k in obj) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      paths = paths.concat(getLeafPaths(obj[k], full));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

function getVal(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

// 1. Symmetric Leaf Key Parity
const frPaths = getLeafPaths(frJson);
const arPaths = getLeafPaths(arJson);
const frSet = new Set(frPaths);
const arSet = new Set(arPaths);

assert(frPaths.length === arPaths.length, `Symmetric Leaf Key Count (FR: ${frPaths.length}, AR: ${arPaths.length})`);
assert(frPaths.length >= 1100, `Rich localization coverage (Keys count = ${frPaths.length} >= 1100)`);

const missingInAr = frPaths.filter(p => !arSet.has(p));
const missingInFr = arPaths.filter(p => !frSet.has(p));
assert(missingInAr.length === 0, `Zero keys missing in AR (found: ${missingInAr.length})`);
assert(missingInFr.length === 0, `Zero keys missing in FR (found: ${missingInFr.length})`);

// 2. Validate Essential Dashboard & Body Namespaces
const criticalNamespaces = [
  "dashboard",
  "planning",
  "caregivers",
  "patients",
  "messages",
  "demandes",
  "patient_details",
  "booking",
  "chronic",
  "homelab",
  "relay",
  "profile",
  "appointments",
  "reviews",
  "specialties",
  "status",
  "common"
];

for (const ns of criticalNamespaces) {
  assert(frJson[ns] !== undefined, `Namespace '${ns}' defined in FR`);
  assert(arJson[ns] !== undefined, `Namespace '${ns}' defined in AR`);
}

// 3. Validate Arabic Script Presence in AR translations
const sampleArKeys = [
  "dashboard.restricted_access_title",
  "dashboard.consultations_today",
  "dashboard.my_patients",
  "dashboard.recent_activity",
  "dashboard.attending_caregivers",
  "planning.patient_title",
  "planning.all_tab",
  "caregivers.title",
  "caregivers.search_directory_placeholder",
  "patients.count_with_relation",
  "messages.unread_count",
  "patient_details.document_name",
  "patient_details.doc_cat_prescription",
  "booking.choose_provider",
  "booking.service_wanted",
  "chronic.concerned_patient",
  "chronic.types.blood_pressure",
  "homelab.fasting_rule_mandatory",
  "homelab.partner_lab",
  "relay.triage_mode",
  "relay.status_requested",
  "profile.civil_status_title",
  "profile.act_title_required",
  "appointments.status_confirmed",
  "reviews.your_review"
];

const arabicRegex = /[\u0600-\u06FF]/;
for (const k of sampleArKeys) {
  const arVal = getVal(arJson, k);
  assert(typeof arVal === "string" && arabicRegex.test(arVal), `Arabic characters present in key '${k}': "${arVal}"`);
}

// 4. Validate Dynamic Date & Number formatting in Arabic locale
const testDate = new Date("2026-11-20T10:00:00Z");
const frDateStr = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(testDate);
const arDateStr = new Intl.DateTimeFormat("ar-MR", { weekday: "long", day: "numeric", month: "long" }).format(testDate);

assert(typeof frDateStr === "string" && frDateStr.length > 0, `FR date format: "${frDateStr}"`);
assert(typeof arDateStr === "string" && arabicRegex.test(arDateStr), `AR-MR date format in Arabic script: "${arDateStr}"`);

console.log("==================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log(">>> ALL BODY LOCALIZATION CHECKS PASSED AUTHORITATIVELY <<<");
}

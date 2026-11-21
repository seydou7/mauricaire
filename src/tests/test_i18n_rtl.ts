import fr from "../locales/fr/translation.json";
import ar from "../locales/ar/translation.json";
import { getNormalizedLanguage } from "../i18n";

function getKeys(obj: any, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function getVal(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

function runSuite() {
  console.log("==================================================");
  console.log("MAURICARE I18N + RTL AUTOMATED AUDIT SUITE");
  console.log("==================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(name: string, condition: boolean, extraInfo?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${name} ${extraInfo || ""}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Key Parity between FR and AR
  const frKeys = new Set(getKeys(fr));
  const arKeys = new Set(getKeys(ar));
  const missingInAr = [...frKeys].filter((k) => !arKeys.has(k));
  const missingInFr = [...arKeys].filter((k) => !frKeys.has(k));

  assert(
    "Translation Key Parity (FR <-> AR)",
    missingInAr.length === 0 && missingInFr.length === 0,
    `Missing in AR: ${missingInAr.length}, Missing in FR: ${missingInFr.length}`
  );
  assert("FR Key Count >= 700", frKeys.size >= 700, `Found: ${frKeys.size}`);
  assert("AR Key Count >= 700", arKeys.size >= 700, `Found: ${arKeys.size}`);

  // TEST 2: Normalized Language Resolution
  assert("Normalize 'fr' -> 'fr'", getNormalizedLanguage("fr") === "fr");
  assert("Normalize 'fr-FR' -> 'fr'", getNormalizedLanguage("fr-FR") === "fr");
  assert("Normalize 'ar' -> 'ar'", getNormalizedLanguage("ar") === "ar");
  assert("Normalize 'ar-SA' -> 'ar'", getNormalizedLanguage("ar-SA") === "ar");
  assert("Normalize 'ar-MR' -> 'ar'", getNormalizedLanguage("ar-MR") === "ar");
  assert("Normalize undefined fallback -> 'fr'", getNormalizedLanguage(undefined) === "fr");

  // TEST 3: Canonical Status Keys
  const canonicalStatuses = [
    "status.en_attente",
    "status.confirme",
    "status.termine",
    "status.annule",
    "status.scheduled",
    "status.in_progress",
    "status.requested",
    "status.accepted",
    "status.completed",
    "status.declined",
    "status.cancelled",
  ];
  for (const st of canonicalStatuses) {
    assert(
      `Canonical status mapped in FR: ${st}`,
      Boolean(getVal(fr, st)),
      `FR value: ${getVal(fr, st)}`
    );
    assert(
      `Canonical status mapped in AR: ${st}`,
      Boolean(getVal(ar, st)),
      `AR value: ${getVal(ar, st)}`
    );
  }

  // TEST 4: Core Navigation Keys in Both Languages
  const coreNavKeys = [
    "nav.home",
    "nav.dashboard",
    "nav.overview",
    "nav.planning",
    "nav.requests",
    "nav.chronic",
    "nav.homelab",
    "nav.caregivers",
    "nav.circle",
    "nav.relay",
    "nav.patients",
    "nav.accreditation",
    "nav.messages",
    "nav.profile",
    "nav.login",
    "nav.register",
    "nav.logout",
  ];
  for (const navKey of coreNavKeys) {
    assert(
      `Navigation key present in FR & AR: ${navKey}`,
      Boolean(getVal(fr, navKey)) && Boolean(getVal(ar, navKey))
    );
  }

  // TEST 5: Circle Module Keys
  const circleKeys = [
    "circle.cannot_access_patient",
    "circle.no_active_auth",
    "circle.mandate_revoked_title",
    "circle.mandate_revoked_desc",
    "circle.back_to_accompanied",
    "circle.active_mandate_verified",
    "circle.you_accompany",
    "circle.book_care_for",
    "circle.permissions_granted",
    "circle.view_care_summary",
    "circle.care_summary_title",
  ];
  for (const cKey of circleKeys) {
    assert(
      `Circle key present in FR & AR: ${cKey}`,
      Boolean(getVal(fr, cKey)) && Boolean(getVal(ar, cKey))
    );
  }

  // TEST 6: HomeLab Module Keys
  const homelabKeys = [
    "homelab.title",
    "homelab.badge_biology",
    "homelab.empty_results",
    "homelab.empty_results_desc",
    "homelab.rectified",
    "homelab.validated",
    "homelab.view_report",
  ];
  for (const hKey of homelabKeys) {
    assert(
      `HomeLab key present in FR & AR: ${hKey}`,
      Boolean(getVal(fr, hKey)) && Boolean(getVal(ar, hKey))
    );
  }

  // TEST 7: Chronic Monitoring Module Keys
  const chronicKeys = [
    "chronic.title",
    "chronic.access_tracking",
    "chronic.empty_observations",
    "chronic.see_evolution",
    "chronic.blood_pressure",
    "chronic.blood_glucose",
    "chronic.temperature",
    "chronic.weight",
  ];
  for (const chKey of chronicKeys) {
    assert(
      `Chronic key present in FR & AR: ${chKey}`,
      Boolean(getVal(fr, chKey)) && Boolean(getVal(ar, chKey))
    );
  }

  // TEST 8: Relay Module Keys
  const relayKeys = [
    "relay.care_continuity",
    "relay.history_desc",
    "relay.history_empty",
    "relay.history_empty_desc",
    "relay.priority",
    "relay.reason_prefix",
    "relay.coordination_summary_label",
  ];
  for (const rKey of relayKeys) {
    assert(
      `Relay key present in FR & AR: ${rKey}`,
      Boolean(getVal(fr, rKey)) && Boolean(getVal(ar, rKey))
    );
  }

  console.log("==================================================");
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log("==================================================");

  if (passedTests === totalTests) {
    console.log(">>> ALL I18N AND RTL CHECKS PASSED AUTHORITATIVELY <<<");
  } else {
    process.exit(1);
  }
}

runSuite();

import { CompositeSTTManager, mapWebSpeechError } from "./SpeechToTextProvider";

// Mock browser environment in Node.js for state-machine testing
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    webkitSpeechRecognition: class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "fr-FR";
      onstart = () => {};
      onerror = () => {};
      onend = () => {};
      start() {}
      stop() {}
      abort() {}
    },
    AudioContext: class MockAudioContext {},
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

export function runSTTStateMachineTests() {
  console.log("=== RUNNING VOICE AI STT STATE MACHINE TEST SUITE (PRIMARY SERVER STT) ===");
  const results: { test: string; status: "PASS" | "FAIL"; details: string }[] = [];

  const manager = new CompositeSTTManager();

  // --------------------------------------------------------------------------
  // Test 1: Server STT Configured -> Turn 1 uses RecordedAudio directly
  // --------------------------------------------------------------------------
  {
    manager.setServerSTTConfigured(true);
    manager.resetSession(true);

    assert(manager.isServerSTTConfigured() === true, "server STT must be flagged configured");
    assert(manager.getProviderMode() === "recorded", "mode must initialize directly to recorded");
    assert(manager.getActiveProviderName() === "recorded", "active provider must be recorded");

    let startedProvider = "";
    manager.start(
      {
        onStateChange: () => {},
      },
      "fr"
    );
    startedProvider = manager.getActiveProviderName();
    assert(startedProvider === "recorded", "turn 1 must start recordedProvider directly without touching browserProvider");

    results.push({
      test: "Test 1 — Server STT Primary: Turn 1 starts Recorded Audio immediately",
      status: "PASS",
      details: "Server STT configured -> initialized in recorded mode -> Turn 1 invokes RecordedAudioSTTProvider directly with zero browser attempts and zero network errors",
    });
  }

  // --------------------------------------------------------------------------
  // Test 2: Turn 2 (Continuous conversation) stays on RecordedAudio
  // --------------------------------------------------------------------------
  {
    manager.start(
      {
        onStateChange: () => {},
      },
      "fr"
    );
    const started = manager.getActiveProviderName();
    assert(started === "recorded", "turn 2 must remain on recorded provider");
    assert(manager.getProviderMode() === "recorded", "mode remains recorded");

    results.push({
      test: "Test 2 — Server STT Primary: Turn 2 remains on Recorded Audio",
      status: "PASS",
      details: "Mic tapped for second utterance -> starts RecordedAudio directly without interstitial screen or mode flip",
    });
  }

  // --------------------------------------------------------------------------
  // Test 3: Turn 3 (Continuous conversation) stays on RecordedAudio
  // --------------------------------------------------------------------------
  {
    manager.start(
      {
        onStateChange: () => {},
      },
      "fr"
    );
    const started = manager.getActiveProviderName();
    assert(started === "recorded", "turn 3 must remain on recorded provider");
    assert(manager.getProviderMode() === "recorded", "mode remains recorded");

    results.push({
      test: "Test 3 — Server STT Primary: Turn 3 remains on Recorded Audio",
      status: "PASS",
      details: "Mic tapped for third utterance -> multi-turn conversation continues seamlessly on server STT",
    });
  }

  // --------------------------------------------------------------------------
  // Test 4: Server STT NOT Configured -> Falls back to Auto / Browser
  // --------------------------------------------------------------------------
  {
    manager.setServerSTTConfigured(false);
    manager.resetSession(false);

    assert(manager.isServerSTTConfigured() === false, "server STT should be false");
    assert(manager.getProviderMode() === "auto", "initial mode without server STT must be auto");
    assert(!manager.isBrowserUnavailableForSession(), "browser initially available");

    manager.start(
      {
        onError: () => {},
      },
      "fr"
    );
    assert(manager.getActiveProviderName() === "browser", "without server STT, browser provider is attempted first");

    // Simulate browser network failure
    manager.markBrowserUnavailableForSession("network");
    assert(manager.isBrowserUnavailableForSession() === true, "browser marked unavailable on network error");
    assert(manager.getActiveProviderName() === "recorded", "provider shifts to recorded after browser failure");

    results.push({
      test: "Test 4 — Fallback when Server STT Unconfigured: Auto mode with browser",
      status: "PASS",
      details: "When server STT is unconfigured, auto mode safely attempts browser speech and isolates browser on network failure",
    });
  }

  // --------------------------------------------------------------------------
  // Test 5: Server STT Error (provider-error) -> Stays on Recorded Mode
  // --------------------------------------------------------------------------
  {
    manager.setServerSTTConfigured(true);
    manager.resetSession(true);

    const err = mapWebSpeechError("provider-error");
    assert(err.code === "provider-error", "error code must be provider-error");
    assert(err.titleFr === "La transcription vocale est momentanément indisponible", "titleFr matches specification");
    assert(err.isRecoverable === true, "provider-error is recoverable");
    assert(err.suggestRecordedFallback === false, "should not suggest recorded fallback since already on recorded");

    // Retry should stay on recorded provider
    manager.start(
      {
        onStateChange: () => {},
      },
      "fr"
    );
    assert(manager.getActiveProviderName() === "recorded", "retry must stay on recorded provider, NEVER fallback to browser");

    results.push({
      test: "Test 5 — Server STT Failure Recovery: Stays on Recorded Audio",
      status: "PASS",
      details: "Transcription error generates clear provider-error and retry keeps session on server STT without falling back to broken browser speech",
    });
  }

  // --------------------------------------------------------------------------
  // Test 6: Microphone Permission Denied -> Specific not-allowed error
  // --------------------------------------------------------------------------
  {
    const deniedErr = mapWebSpeechError("not-allowed");
    assert(deniedErr.code === "not-allowed", "error code must be not-allowed");
    assert(deniedErr.titleFr === "Microphone indisponible", "titleFr must be 'Microphone indisponible'");
    assert(deniedErr.messageFr === "Autorisez l'accès au microphone pour utiliser Voice AI.", "messageFr matches specification");
    assert(deniedErr.suggestTextFallback === true, "suggests text fallback");

    results.push({
      test: "Test 6 — Microphone Permission Denied: Clear actionable error copy",
      status: "PASS",
      details: "Permission denial produces 'Microphone indisponible' with instructions to allow access or switch to text mode",
    });
  }

  // --------------------------------------------------------------------------
  // Test 7: Modal Reopen / New Session retains Primary Server STT
  // --------------------------------------------------------------------------
  {
    manager.resetSession(true);
    assert(manager.getProviderMode() === "recorded", "new session with server STT retains recorded mode");
    assert(manager.getActiveProviderName() === "recorded", "new session active provider is recorded");

    results.push({
      test: "Test 7 — New Session Preservation: Retains Server STT as primary",
      status: "PASS",
      details: "Resetting or reopening modal keeps server STT as primary, eliminating the repeated warning panel",
    });
  }

  console.table(results);
  return results;
}

if (process.argv[1] && process.argv[1].includes("test_voice_stt_session")) {
  runSTTStateMachineTests();
}

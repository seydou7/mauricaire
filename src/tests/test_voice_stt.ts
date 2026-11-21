import { runSTTStateMachineTests } from "../services/voice/test_voice_stt_session";

try {
  runSTTStateMachineTests();
  console.log(">>> ALL VOICE STT TESTS PASSED <<<");
  process.exit(0);
} catch (err: any) {
  console.error("FAIL: Voice STT tests failed:", err.message);
  process.exit(1);
}

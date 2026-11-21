import { execSync } from "child_process";

/**
 * Runner script to execute verifyDemoReadiness through Convex CLI
 */
function main() {
  console.log("==================================================");
  console.log("MAURICARE DEMO SCENARIO & READINESS SANITY TEST");
  console.log("==================================================");

  try {
    const rawOutput = execSync(
      'npx convex run seedClientDemo:verifyDemoReadiness',
      {
        cwd: "/Applications/MAMP/htdocs/Lab/mauricaire",
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `/Users/seydoukellel/.nvm/versions/node/v24.12.0/bin:${process.env.PATH}`,
        },
      }
    );

    // Convex run returns JSON string or formatted object
    console.log(rawOutput);

    if (rawOutput.includes('"status": "FAIL"') || rawOutput.includes("status: 'FAIL'")) {
      console.error("FAIL: Demo readiness check returned failure.");
      process.exit(1);
    }

    console.log(">>> ALL DEMO READINESS CHECKS PASSED AUTHORITATIVELY <<<");
    process.exit(0);
  } catch (err: any) {
    console.error("Error executing verifyDemoReadiness:", err.message);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }
}

main();

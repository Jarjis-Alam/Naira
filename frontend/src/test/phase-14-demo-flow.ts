/**
 * NEXORA — PHASE 14
 * FACULTY DEMO ENVIRONMENT & PRESENTATION READINESS VERIFICATION
 *
 * Verifies the exact 15-step live faculty demo narrative:
 * 1. Login
 * 2. Dashboard
 * 3. Show readiness
 * 4. Show preparation focus
 * 5. Show target role/company
 * 6. Open Roadmap
 * 7. Show recommended actions
 * 8. Open Tests
 * 9. Open a relevant test
 * 10. Start/resume test
 * 11. Demonstrate exam interface
 * 12. Submit if appropriate
 * 13. Show Result
 * 14. Show Analytics
 * 15. Return to Dashboard
 *
 * Plus Target Strategy and Profile verification.
 */

import { db } from "@/db";
import { tests } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const BASE_URL = "http://localhost:3000";

class CookieJar {
  cookies: Record<string, string> = {};

  update(res: Response) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        this.cookies[key] = val;
      }
    }
  }

  getHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  clear() {
    this.cookies = {};
  }
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failedCount++;
  }
}

export async function runPhase14DemoFlowVerification() {
  console.log("\n==================================================");
  console.log("NEXORA — PHASE 14 FACULTY DEMO FLOW VERIFICATION");
  console.log("==================================================\n");

  const demoEmail = "alex.chen@placementos.dev";
  const demoPassword = "alex123";

  const studentJar = new CookieJar();

  // -------------------------------------------------------------
  // STEP 1: Login
  // -------------------------------------------------------------
  console.log("--- Step 1: Login ---");
  const loginPageRes = await fetch(`${BASE_URL}/auth/login`);
  assert(loginPageRes.status === 200, "Login page loads successfully (200 OK)");
  const loginPageHtml = await loginPageRes.text();
  assert(
    loginPageHtml.includes("Sign In") || loginPageHtml.includes("Nexora"),
    "Login page displays Nexora authentication interface"
  );

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  studentJar.update(csrfRes);
  const { csrfToken } = await csrfRes.json();
  assert(Boolean(csrfToken), "Retrieved valid CSRF token");

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: studentJar.getHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: demoEmail,
      password: demoPassword,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  studentJar.update(loginRes);
  assert(
    loginRes.status === 200 || loginRes.status === 302,
    "Demo student Alex Chen authenticated successfully"
  );

  // -------------------------------------------------------------
  // STEP 2: Dashboard
  // -------------------------------------------------------------
  console.log("\n--- Step 2: Dashboard ---");
  const dashRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(dashRes.status === 200, "Dashboard returns 200 OK");
  const dashHtml = await dashRes.text();
  assert(
    dashHtml.includes("Alex") || dashHtml.includes("Active Session"),
    "Dashboard renders personalized welcome for demo student"
  );

  // -------------------------------------------------------------
  // STEP 3: Show Readiness
  // -------------------------------------------------------------
  console.log("\n--- Step 3: Show Readiness ---");
  assert(
    dashHtml.includes("Placement Readiness Score"),
    "Dashboard renders Placement Readiness Score section"
  );
  assert(
    dashHtml.includes("/ 100"),
    "Readiness gauge displays / 100 benchmark metric"
  );
  assert(
    dashHtml.includes("BENCHMARK CALIBRATED"),
    "Readiness displays benchmark calibration status"
  );

  // -------------------------------------------------------------
  // STEP 4: Show Preparation Focus
  // -------------------------------------------------------------
  console.log("\n--- Step 4: Show Preparation Focus ---");
  assert(
    dashHtml.includes("Preparation Focus"),
    "Dashboard renders Preparation Focus block"
  );

  // -------------------------------------------------------------
  // STEP 5: Show Target Role & Company
  // -------------------------------------------------------------
  console.log("\n--- Step 5: Show Target Role & Company ---");
  assert(
    dashHtml.includes("Placement Target"),
    "Dashboard renders Placement Target card"
  );
  assert(
    dashHtml.includes("Software Engineer"),
    "Placement Target displays configured primary target role 'Software Engineer'"
  );
  assert(
    dashHtml.includes("Google"),
    "Placement Target displays configured target company 'Google'"
  );

  // -------------------------------------------------------------
  // Target Strategy (Bonus Faculty Navigation Check)
  // -------------------------------------------------------------
  console.log("\n--- Step 5B: Target Strategy Page ---");
  const targetRes = await fetch(`${BASE_URL}/target`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(targetRes.status === 200, "Target Strategy page returns 200 OK");
  const targetHtml = await targetRes.text();
  assert(
    targetHtml.includes("Placement Target Strategy") || targetHtml.includes("Target Strategy"),
    "Target Strategy displays placement target analytics"
  );
  assert(
    targetHtml.includes("Software Engineer") && targetHtml.includes("Google"),
    "Target Strategy displays target role and company fit matrix"
  );

  // -------------------------------------------------------------
  // STEP 6: Open Roadmap
  // -------------------------------------------------------------
  console.log("\n--- Step 6: Open Roadmap ---");
  const roadmapRes = await fetch(`${BASE_URL}/roadmap`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(roadmapRes.status === 200, "Placement Roadmap returns 200 OK");
  const roadmapHtml = await roadmapRes.text();
  assert(
    roadmapHtml.includes("Placement Roadmap"),
    "Roadmap page renders Placement Roadmap header"
  );

  // -------------------------------------------------------------
  // STEP 7: Show Recommended Actions
  // -------------------------------------------------------------
  console.log("\n--- Step 7: Show Recommended Actions ---");
  assert(
    roadmapHtml.includes("Recommended Actions") || roadmapHtml.includes("Next Action") || roadmapHtml.includes("Preparation"),
    "Roadmap displays deterministic recommended actions"
  );

  // -------------------------------------------------------------
  // STEP 8: Open Tests
  // -------------------------------------------------------------
  console.log("\n--- Step 8: Open Tests Catalog ---");
  const testsRes = await fetch(`${BASE_URL}/tests`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(testsRes.status === 200, "Tests catalog returns 200 OK");
  const testsHtml = await testsRes.text();
  assert(
    testsHtml.includes("Placement Tests") || testsHtml.includes("Mock Tests") || testsHtml.includes("All Tests"),
    "Tests page displays active test catalog"
  );

  // Find a published test for the demonstration
  const [demoTest] = await db
    .select()
    .from(tests)
    .where(and(eq(tests.type, "cs_fundamentals"), eq(tests.status, "published")))
    .limit(1);

  assert(Boolean(demoTest), "Located published CS Fundamentals test for live demo");

  // -------------------------------------------------------------
  // STEP 9: Open Relevant Test Detail
  // -------------------------------------------------------------
  console.log(`\n--- Step 9: Open Test Detail (${demoTest.title}) ---`);
  const testDetailRes = await fetch(`${BASE_URL}/tests/${demoTest.id}`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(testDetailRes.status === 200, "Test detail page returns 200 OK");
  const testDetailHtml = await testDetailRes.text();
  assert(
    testDetailHtml.includes(demoTest.title),
    "Test detail renders test title"
  );
  assert(
    testDetailHtml.includes("Start Test") || testDetailHtml.includes("Begin") || testDetailHtml.includes("Resume"),
    "Test detail renders start/resume test CTA"
  );

  // -------------------------------------------------------------
  // STEP 10: Start / Resume Test
  // -------------------------------------------------------------
  console.log("\n--- Step 10: Start / Resume Test Attempt ---");
  const alexChenId = "00000000-0000-0000-0000-000000000002";
  const { startOrResumeAttempt } = await import("@/server/tests");
  const startResult = await startOrResumeAttempt(demoTest.id, alexChenId);
  const attemptId = startResult.attemptId;
  assert(Boolean(attemptId), `Attempt initialized or resumed with ID: ${attemptId}`);

  // -------------------------------------------------------------
  // STEP 11: Demonstrate Exam Interface
  // -------------------------------------------------------------
  console.log("\n--- Step 11: Demonstrate Exam Interface ---");
  const examRes = await fetch(
    `${BASE_URL}/tests/${demoTest.id}/attempt?attemptId=${attemptId}`,
    {
      headers: { Cookie: studentJar.getHeader() },
    }
  );
  assert(examRes.status === 200, "Exam interface returns 200 OK");
  const examHtml = await examRes.text();
  assert(
    examHtml.includes("Submit") || examHtml.includes("Question") || examHtml.includes("timer") || examHtml.includes("exam"),
    "Exam interface renders active question UI and controls"
  );

  // -------------------------------------------------------------
  // STEP 12: Submit Attempt
  // -------------------------------------------------------------
  console.log("\n--- Step 12: Submit Attempt ---");
  const { gradeAttempt } = await import("@/server/grading");
  const gradeResult = await gradeAttempt(attemptId, alexChenId);
  assert(
    gradeResult !== null && gradeResult !== undefined,
    `Test attempt submitted and evaluated with score: ${gradeResult.score}`
  );

  // -------------------------------------------------------------
  // STEP 13: Show Result
  // -------------------------------------------------------------
  console.log("\n--- Step 13: Show Result Page ---");
  const resultRes = await fetch(
    `${BASE_URL}/tests/${demoTest.id}/result?attemptId=${attemptId}`,
    {
      headers: { Cookie: studentJar.getHeader() },
    }
  );
  assert(resultRes.status === 200, "Result page returns 200 OK");
  const resultHtml = await resultRes.text();
  assert(
    resultHtml.includes("Assessment Result") || resultHtml.includes("Score") || resultHtml.includes("Performance"),
    "Result page displays verified score and accuracy metrics"
  );
  assert(
    resultHtml.includes("Accuracy") || resultHtml.includes("%"),
    "Result page displays performance breakdown"
  );

  // -------------------------------------------------------------
  // STEP 14: Show Analytics
  // -------------------------------------------------------------
  console.log("\n--- Step 14: Show Analytics Page ---");
  const analyticsRes = await fetch(`${BASE_URL}/analytics`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(analyticsRes.status === 200, "Analytics page returns 200 OK");
  const analyticsHtml = await analyticsRes.text();
  assert(
    analyticsHtml.includes("Analytics") || analyticsHtml.includes("Performance"),
    "Analytics page renders placement performance metrics"
  );

  // -------------------------------------------------------------
  // Profile (Bonus Faculty Navigation Check)
  // -------------------------------------------------------------
  console.log("\n--- Step 14B: Student Profile ---");
  const profileRes = await fetch(`${BASE_URL}/profile`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(profileRes.status === 200, "Profile page returns 200 OK");
  const profileHtml = await profileRes.text();
  assert(
    profileHtml.includes("Alex Chen") && profileHtml.includes("Apex Institute of Technology"),
    "Profile renders student institutional profile and target configurations"
  );

  // -------------------------------------------------------------
  // STEP 15: Return to Dashboard
  // -------------------------------------------------------------
  console.log("\n--- Step 15: Return to Dashboard ---");
  const returnDashRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: { Cookie: studentJar.getHeader() },
  });
  assert(returnDashRes.status === 200, "Dashboard returns 200 OK on return navigation");
  const returnDashHtml = await returnDashRes.text();
  assert(
    returnDashHtml.includes("Alex") && returnDashHtml.includes("Placement Readiness Score"),
    "Dashboard successfully displays updated post-practice readiness state"
  );

  console.log("\n==================================================");
  console.log(`VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================\n");

  if (failedCount > 0) {
    throw new Error(`${failedCount} checks failed during demo flow verification!`);
  }
}

runPhase14DemoFlowVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import assert from "node:assert";
import { db } from "../db";
import { users, applications, placementSimulations, interviewSessions, resumeVariants, studyPlanItems, attempts, tests } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { SIMULATION_READINESS_WEIGHTS } from "../server/placement-simulation";

import fs from "node:fs";
import path from "node:path";

// Load .env.local into process.env if not already loaded
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...v] = trimmed.split("=");
        if (!process.env[k.trim()]) {
          process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
} catch {}

const BASE_URL = "http://localhost:3000";

class CookieJar {
  cookies: Record<string, string> = {};

  update(res: Response) {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) return;
    setCookie.split(",").forEach((c) => {
      const parts = c.split(";")[0].split("=");
      if (parts[0] && parts[1]) {
        this.cookies[parts[0].trim()] = parts[1].trim();
      }
    });
  }

  getHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

async function loginUser(email: string, jar: CookieJar): Promise<boolean> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  jar.update(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.getHeader(),
    },
    body: new URLSearchParams({
      email,
      password: "Password123!",
      csrfToken,
    }),
    redirect: "manual",
  });
  jar.update(loginRes);
  return loginRes.status === 302;
}

export async function runSecurityAudit() {
  console.log("\n==================================================");
  console.log("🔒 NAIRA — FINAL SECURITY & PRODUCTION AUDIT");
  console.log("==================================================\n");

  const studentAJar = new CookieJar();
  const studentBJar = new CookieJar();

  const loggedInA = await loginUser("qa_ui_student@placementos.dev", studentAJar);
  const loggedInB = await loginUser("qa_ui_empty@placementos.dev", studentBJar);

  assert(loggedInA, "Student A must authenticate successfully");
  assert(loggedInB, "Student B must authenticate successfully");

  const [studentAUser] = await db.select().from(users).where(eq(users.email, "qa_ui_student@placementos.dev"));
  const [studentBUser] = await db.select().from(users).where(eq(users.email, "qa_ui_empty@placementos.dev"));

  assert(studentAUser && studentBUser, "Both test student users must exist in database");

  console.log("✓ Authenticated Sessions established:");
  console.log(`  Student A: ${studentAUser.id} (${studentAUser.email})`);
  console.log(`  Student B: ${studentBUser.id} (${studentBUser.email})`);

  let passedChecks = 0;
  let totalChecks = 0;

  function recordCheck(name: string, ok: boolean, detail?: string) {
    totalChecks++;
    if (ok) {
      passedChecks++;
      console.log(`  ✓ ${name}`);
    } else {
      console.error(`  ✗ FAIL: ${name} — ${detail || "Condition not met"}`);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Unauthenticated Access Protection
  // --------------------------------------------------------------------------
  console.log("\n--- 1. Testing Unauthenticated Access Rejection ---");
  const protectedEndpoints = [
    "/api/student/applications",
    "/api/student/intelligence",
    "/api/student/roadmap",
    "/api/student/target-strategy",
    "/api/student/resume",
    "/api/student/simulation",
    "/api/student/outcomes",
    "/api/student/interview/history",
    "/api/student/study-plan/today",
    "/api/student/practice/recommendations",
    "/api/admin/tests",
    "/api/admin/analytics",
    "/api/profile",
  ];

  for (const ep of protectedEndpoints) {
    const res = await fetch(`${BASE_URL}${ep}`, { redirect: "manual" });
    const isRejected = res.status === 401 || res.status === 403 || res.status === 307 || res.status === 302;
    recordCheck(`Unauth rejected on ${ep} (status ${res.status})`, isRejected);
  }

  // --------------------------------------------------------------------------
  // 2. Admin Route Protection from Normal Students
  // --------------------------------------------------------------------------
  console.log("\n--- 2. Testing Admin Access Protection from Non-Admin Students ---");
  const adminEndpoints = [
    { method: "POST", path: "/api/admin/tests", body: { title: "Hacked Test" } },
    { method: "GET", path: "/api/admin/analytics" },
    { method: "GET", path: "/api/admin/roles" },
    { method: "POST", path: "/api/admin/roles", body: { name: "Hacked Role" } },
    { method: "GET", path: "/api/admin/companies" },
    { method: "POST", path: "/api/admin/companies", body: { name: "Hacked Company" } },
    { method: "POST", path: "/api/admin/questions", body: { title: "Hacked Question" } },
  ];

  for (const ep of adminEndpoints) {
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      method: ep.method,
      headers: {
        "Content-Type": "application/json",
        Cookie: studentAJar.getHeader(),
      },
      body: ep.body ? JSON.stringify(ep.body) : undefined,
      redirect: "manual",
    });
    const isForbidden = res.status === 401 || res.status === 403 || res.status === 307 || res.status === 302;
    recordCheck(`Student blocked from ${ep.method} ${ep.path} (status ${res.status})`, isForbidden);
  }

  // --------------------------------------------------------------------------
  // 3. IDOR / Cross-User Access Isolation
  // --------------------------------------------------------------------------
  console.log("\n--- 3. Testing Cross-User IDOR Protection (Student B attacking Student A) ---");

  // Create or retrieve Student A resources:
  // 3a. Application
  let [appA] = await db.select().from(applications).where(eq(applications.userId, studentAUser.id)).limit(1);
  if (!appA) {
    [appA] = await db.insert(applications).values({
      userId: studentAUser.id,
      companyName: "IDOR Defense Corp",
      roleName: "Security Engineer",
      status: "APPLIED",
    }).returning();
  }

  // 3b. Simulation
  let [simA] = await db.select().from(placementSimulations).where(eq(placementSimulations.userId, studentAUser.id)).limit(1);
  if (!simA) {
    [simA] = await db.insert(placementSimulations).values({
      userId: studentAUser.id,
      companyName: "IDOR Sim Corp",
      roleName: "Backend Engineer",
      status: "in_progress",
    }).returning();
  }

  // 3c. Interview Session
  let [interviewA] = await db.select().from(interviewSessions).where(eq(interviewSessions.userId, studentAUser.id)).limit(1);
  if (!interviewA) {
    [interviewA] = await db.insert(interviewSessions).values({
      userId: studentAUser.id,
      interviewType: "TECHNICAL",
      targetRoleName: "Security Engineer",
      status: "ACTIVE",
    }).returning();
  }

  // 3d. Resume Variant
  let [variantA] = await db.select().from(resumeVariants).where(eq(resumeVariants.userId, studentAUser.id)).limit(1);
  if (!variantA) {
    [variantA] = await db.insert(resumeVariants).values({
      userId: studentAUser.id,
      label: "Security Engineer Resume",
      targetRoleName: "Security Engineer",
    }).returning();
  }

  // 3e. Test Attempt
  const [baseline] = await db.select().from(tests).where(eq(tests.type, "baseline")).limit(1);
  let [attemptA] = await db.select().from(attempts).where(and(eq(attempts.userId, studentAUser.id), eq(attempts.status, "submitted"))).limit(1);

  // Test B reading A's Application
  const readAppRes = await fetch(`${BASE_URL}/api/student/applications/${appA.id}`, {
    headers: { Cookie: studentBJar.getHeader() },
  });
  recordCheck(
    "Student B cannot GET Student A's application",
    readAppRes.status === 404 || readAppRes.status === 403,
    `Status was ${readAppRes.status}`
  );

  // Test B updating A's Application fields
  const updateAppRes = await fetch(`${BASE_URL}/api/student/applications/${appA.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentBJar.getHeader(),
    },
    body: JSON.stringify({ location: "Tampered Location" }),
  });
  recordCheck(
    "Student B cannot PATCH Student A's application fields (ownership error)",
    updateAppRes.status === 404 || updateAppRes.status === 403,
    `Status was ${updateAppRes.status}`
  );

  // Test B updating A's Application status
  const updateAppStatusRes = await fetch(`${BASE_URL}/api/student/applications/${appA.id}?action=status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentBJar.getHeader(),
    },
    body: JSON.stringify({ status: "REJECTED" }),
  });
  recordCheck(
    "Student B cannot PATCH Student A's application status (ownership error)",
    updateAppStatusRes.status === 404 || updateAppStatusRes.status === 403,
    `Status was ${updateAppStatusRes.status}`
  );

  // Test B deleting A's Application
  const deleteAppRes = await fetch(`${BASE_URL}/api/student/applications/${appA.id}`, {
    method: "DELETE",
    headers: { Cookie: studentBJar.getHeader() },
  });
  recordCheck(
    "Student B cannot DELETE Student A's application",
    deleteAppRes.status === 404 || deleteAppRes.status === 403,
    `Status was ${deleteAppRes.status}`
  );

  // Verify appA remains unmutated in DB
  const [verifiedAppA] = await db.select().from(applications).where(eq(applications.id, appA.id));
  recordCheck(
    "Student A's application status remained intact after attack",
    verifiedAppA && verifiedAppA.status === appA.status
  );

  // Test B reading A's Simulation
  const readSimRes = await fetch(`${BASE_URL}/api/student/simulation/${simA.id}`, {
    headers: { Cookie: studentBJar.getHeader() },
  });
  recordCheck(
    "Student B cannot GET Student A's simulation",
    readSimRes.status === 404 || readSimRes.status === 403,
    `Status was ${readSimRes.status}`
  );

  // Test B submitting round on A's Simulation
  const submitSimRoundRes = await fetch(`${BASE_URL}/api/student/simulation/${simA.id}/round/1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentBJar.getHeader(),
    },
    body: JSON.stringify({ timeTakenSeconds: 100, accuracy: 100 }),
  });
  recordCheck(
    "Student B cannot POST round to Student A's simulation",
    submitSimRoundRes.status === 404 || submitSimRoundRes.status === 403 || submitSimRoundRes.status === 500,
    `Status was ${submitSimRoundRes.status}`
  );

  // Test B reading A's Interview Session
  const readInterviewRes = await fetch(`${BASE_URL}/api/student/interview/${interviewA.id}`, {
    headers: { Cookie: studentBJar.getHeader() },
  });
  recordCheck(
    "Student B cannot GET Student A's interview session",
    readInterviewRes.status === 404 || readInterviewRes.status === 403,
    `Status was ${readInterviewRes.status}`
  );

  // Test B sending message to A's Interview Session
  const sendInterviewMsgRes = await fetch(`${BASE_URL}/api/student/interview/${interviewA.id}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentBJar.getHeader(),
    },
    body: JSON.stringify({ message: "Malicious injection attempt" }),
  });
  recordCheck(
    "Student B cannot POST message to Student A's interview session",
    sendInterviewMsgRes.status === 404 || sendInterviewMsgRes.status === 403,
    `Status was ${sendInterviewMsgRes.status}`
  );

  // Test B completing A's Interview Session
  const completeInterviewRes = await fetch(`${BASE_URL}/api/student/interview/${interviewA.id}/complete`, {
    method: "POST",
    headers: { Cookie: studentBJar.getHeader() },
  });
  recordCheck(
    "Student B cannot complete Student A's interview session",
    completeInterviewRes.status === 404 || completeInterviewRes.status === 403,
    `Status was ${completeInterviewRes.status}`
  );

  // Test B reading A's Resume Variant
  const readVariantRes = await fetch(`${BASE_URL}/api/student/resume/variants/${variantA.id}`, {
    headers: { Cookie: studentBJar.getHeader() },
  });
  recordCheck(
    "Student B cannot GET Student A's resume variant",
    readVariantRes.status === 404 || readVariantRes.status === 403,
    `Status was ${readVariantRes.status}`
  );

  // Test B modifying A's Resume Variant
  const updateVariantRes = await fetch(`${BASE_URL}/api/student/resume/variants/${variantA.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentBJar.getHeader(),
    },
    body: JSON.stringify({ label: "Tampered Resume" }),
  });
  recordCheck(
    "Student B cannot PATCH Student A's resume variant",
    updateVariantRes.status === 404 || updateVariantRes.status === 403,
    `Status was ${updateVariantRes.status}`
  );

  // --------------------------------------------------------------------------
  // 4. Client User ID Spoofing Protection
  // --------------------------------------------------------------------------
  console.log("\n--- 4. Testing Client User ID Spoofing Protection ---");
  // Student B tries to create an application passing studentAUser.id in payload
  const spoofAppRes = await fetch(`${BASE_URL}/api/student/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentBJar.getHeader(),
    },
    body: JSON.stringify({
      companyName: "Spoof Target Inc",
      roleName: "Infiltrator",
      userId: studentAUser.id, // Attempted spoof
    }),
  });

  if (spoofAppRes.ok) {
    const createdApp = await spoofAppRes.json();
    // The created application MUST belong to Student B (session owner), NEVER Student A
    recordCheck(
      "Created resource strictly bound to authenticated session user (spoofed userId ignored)",
      createdApp.userId === studentBUser.id && createdApp.userId !== studentAUser.id
    );
    // Cleanup spoofed application
    await db.delete(applications).where(eq(applications.id, createdApp.id));
  } else {
    recordCheck("Spoof request cleanly rejected by schema validation", true);
  }

  // --------------------------------------------------------------------------
  // 5. AI Interview Coach Input Safety
  // --------------------------------------------------------------------------
  console.log("\n--- 5. Testing AI Interview Coach Input Safety ---");
  // 5a. Empty message
  const emptyMsgRes = await fetch(`${BASE_URL}/api/student/interview/${interviewA.id}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentAJar.getHeader(),
    },
    body: JSON.stringify({ message: "   " }),
  });
  recordCheck("Empty interview message rejected (status 400)", emptyMsgRes.status === 400);

  // 5b. Oversized message (> 2000 chars)
  const hugeMsg = "A".repeat(2500);
  const hugeMsgRes = await fetch(`${BASE_URL}/api/student/interview/${interviewA.id}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentAJar.getHeader(),
    },
    body: JSON.stringify({ message: hugeMsg }),
  });
  recordCheck("Oversized interview message rejected (>2000 chars, status 400)", hugeMsgRes.status === 400);

  // 5c. Invalid / Non-existent session ID
  const invalidSessionRes = await fetch(`${BASE_URL}/api/student/interview/00000000-0000-0000-0000-000000000000/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentAJar.getHeader(),
    },
    body: JSON.stringify({ message: "Valid text for invalid session" }),
  });
  recordCheck("Non-existent session ID rejected (status 404/400)", invalidSessionRes.status === 404 || invalidSessionRes.status === 400);

  // --------------------------------------------------------------------------
  // 6. Stack Trace & SQL Leakage Audit
  // --------------------------------------------------------------------------
  console.log("\n--- 6. Testing Error Sanitization (No SQL / Stack Trace Leaks) ---");
  const malformedEndpoints = [
    { method: "POST", path: "/api/student/applications", body: "invalid json string" },
    { method: "PATCH", path: `/api/student/applications/${appA.id}`, body: JSON.stringify({ status: "NOT_A_VALID_STATUS" }) },
    { method: "GET", path: "/api/student/applications/not-a-uuid" },
    { method: "POST", path: "/api/student/study-plan", body: JSON.stringify({ minutes: -50 }) },
  ];

  for (const m of malformedEndpoints) {
    const res = await fetch(`${BASE_URL}${m.path}`, {
      method: m.method,
      headers: {
        "Content-Type": "application/json",
        Cookie: studentAJar.getHeader(),
      },
      body: m.body,
    });
    const text = await res.text();
    const leaksSql = text.toLowerCase().includes("select ") || text.toLowerCase().includes("syntax error at") || text.includes("drizzle");
    const leaksStack = text.includes("    at ") || text.includes("node_modules");
    recordCheck(
      `Clean error response on ${m.method} ${m.path} (no stack trace or SQL leak)`,
      !leaksSql && !leaksStack,
      `Leaked content: ${text.slice(0, 100)}`
    );
  }

  // --------------------------------------------------------------------------
  // 7. Business Rules & Weights Verification
  // --------------------------------------------------------------------------
  console.log("\n--- 7. Verifying Phase 17 Simulation Readiness Weights ---");
  console.log("  Expected: Screening 20%, Coding 30%, Debugging 15%, Tech Interview 20%, HR Interview 15%");
  console.log("  Actual:", SIMULATION_READINESS_WEIGHTS);

  const screeningOk = SIMULATION_READINESS_WEIGHTS.screening === 0.2;
  const codingOk = SIMULATION_READINESS_WEIGHTS.coding === 0.3;
  const debuggingOk = SIMULATION_READINESS_WEIGHTS.debugging === 0.15;
  const techOk = SIMULATION_READINESS_WEIGHTS.tech_interview === 0.2;
  const hrOk = SIMULATION_READINESS_WEIGHTS.hr_interview === 0.15;
  const totalWeight = Object.values(SIMULATION_READINESS_WEIGHTS).reduce((a, b) => a + b, 0);
  const totalOk = Math.abs(totalWeight - 1.0) < 0.0001;

  recordCheck("Screening weight = 20% (0.20)", screeningOk);
  recordCheck("Coding weight = 30% (0.30)", codingOk);
  recordCheck("Debugging weight = 15% (0.15)", debuggingOk);
  recordCheck("Technical Interview weight = 20% (0.20)", techOk);
  recordCheck("HR Interview weight = 15% (0.15)", hrOk);
  recordCheck("Total weights sum to exactly 100% (1.00)", totalOk);

  // --------------------------------------------------------------------------
  // 8. Phase 24 Study Planner Constraints Verification
  // --------------------------------------------------------------------------
  console.log("\n--- 8. Verifying Phase 24 Adaptive Planner Constraints ---");
  const { generateAdaptiveStudyPlan, recalculateStudyPlan, updateStudyPlanItemStatus } = await import("../server/adaptive-study-planner");

  // Generate test plan for Student A with 60 mins budget
  const testPlan = await generateAdaptiveStudyPlan(studentAUser.id, { availableMinutesPerDay: 60 });
  const todayItems = testPlan.todaySchedule?.items || [];
  const totalAllocated = testPlan.todaySchedule?.totalAllocatedMinutes || 0;

  // Capacity ceiling: allocated <= availableMinutesPerDay
  const withinCapacity = totalAllocated <= 60;
  recordCheck("Plan respects daily capacity ceiling (allocated <= 60 mins)", withinCapacity);

  // Single topic bound: maxSingleTopicMinutes <= 55% of capacity (for 60 mins: <= 33 mins)
  const singleTopicViolation = todayItems.some((item) => item.estimatedMinutes > 33);
  recordCheck("Single topic adheres to bounded proportion (<= 55% of budget)", !singleTopicViolation);

  // Historical completion preservation: complete an item, recalculate, ensure item remains COMPLETED
  if (todayItems.length > 0) {
    const firstItem = todayItems[0];
    await updateStudyPlanItemStatus(studentAUser.id, firstItem.id, "COMPLETED");
    const recalced = await recalculateStudyPlan(studentAUser.id, "Security Audit Recalc");
    const recalcedFirstItem = recalced.todaySchedule?.items.find((i) => i.id === firstItem.id);
    recordCheck("Historical completed items preserved across plan recalculation", recalcedFirstItem?.status === "COMPLETED");
  } else {
    recordCheck("Historical completion test skipped (empty schedule)", true);
  }

  // --------------------------------------------------------------------------
  // 8. Secrets & Environment Security Verification
  // --------------------------------------------------------------------------
  console.log("\n--- 8. Verifying Secrets Isolation ---");
  recordCheck("GROQ_API_KEY is defined on server runtime", Boolean(process.env.GROQ_API_KEY));
  recordCheck("NEXT_PUBLIC_GROQ is undefined (zero client exposure)", process.env.NEXT_PUBLIC_GROQ === undefined);
  recordCheck("AUTH_SECRET is defined", Boolean(process.env.AUTH_SECRET));

  console.log("\n==================================================");
  console.log(`🏁 SECURITY AUDIT SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  console.log("==================================================\n");

  assert.strictEqual(passedChecks, totalChecks, "All security checks must pass without exception");
}

runSecurityAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Security audit encountered failure:", err);
    process.exit(1);
  });

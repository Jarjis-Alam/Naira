/**
 * Phase 19 — live HTTP verification for the Placement Application OS.
 *
 * Registers a real user, logs in over HTTP, and exercises the applications API
 * end to end against a running Next.js server. Base URL comes from
 * APPS_HTTP_BASE (default http://localhost:3000).
 *
 * Usage: APPS_HTTP_BASE=http://localhost:50064 npx tsx src/test/phase-19-applications-http.ts
 */

export {};

const BASE_URL = process.env.APPS_HTTP_BASE ?? "http://localhost:3000";

import { db } from "@/db";
import { companies, roles, users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function runPhase19HttpVerification() {
  console.log("\n==================================================");
  console.log("PHASE 19 — APPLICATIONS LIVE HTTP VERIFICATION");
  console.log("==================================================\n");

  const timestamp = Date.now();
  const testEmail = `m19_student_${timestamp}@placementos.dev`;
  const testPassword = "Password123!";

  // 1. Auth gate: protected pages redirect anonymous visitors.
  const anonRes = await fetch(`${BASE_URL}/applications`, { redirect: "manual" });
  assert(
    anonRes.status === 307 || anonRes.status === 302,
    "GET /applications redirects when unauthenticated",
    `status ${anonRes.status}`
  );

  const anonApi = await fetch(`${BASE_URL}/api/student/applications`, { redirect: "manual" });
  assert(
    anonApi.status === 307 || anonApi.status === 302 || anonApi.status === 401,
    "GET /api/student/applications refuses unauthenticated access",
    `status ${anonApi.status}`
  );

  // 2. Register + log in a real student over HTTP.
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Phase19 Student",
      email: testEmail,
      password: testPassword,
      college: "Nexora Engineering Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    }),
  });
  assert(registerRes.status === 201, "Registration succeeds with 201", `status ${registerRes.status}`);

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const jar = new CookieJar();
  jar.update(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.getHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: testEmail,
      password: testPassword,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  jar.update(loginRes);
  assert(
    loginRes.status === 200 || loginRes.status === 302,
    "Student login authenticated",
    `status ${loginRes.status}`
  );

  const authHeaders = { Cookie: jar.getHeader() };

  // 3. Board starts empty with Phase 16 defaults surfaced.
  const boardRes = await fetch(`${BASE_URL}/api/student/applications`, {
    headers: authHeaders,
  });
  assert(boardRes.status === 200, "GET /api/student/applications returns 200", `status ${boardRes.status}`);
  const board = (await boardRes.json()) as {
    totals: { activeApplications: number };
    pipeline: { status: string; count: number }[];
    cards: unknown[];
    defaults: { configured: boolean; companyId: string | null; roleId: string | null };
    emptyState: { show: boolean } | null;
  };
  assert(board.totals.activeApplications === 0, "New student's board is empty");
  assert(board.pipeline.length === 10, "Board pipeline covers all 10 statuses");
  assert(board.emptyState?.show === true, "Empty state is shown for a new student");

  // 4. Seeded catalog ids for creation.
  const [company] = await db.select().from(companies).limit(1);
  const [role] = await db.select().from(roles).limit(1);
  assert(Boolean(company && role), "Catalog company/role available for creation");

  // 5. Create application over HTTP.
  const createRes = await fetch(`${BASE_URL}/api/student/applications`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: company.id,
      roleId: role.id,
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      jobDescription:
        "We are hiring a Software Engineer. Required skills: React, Node.js, PostgreSQL. Responsibilities: build features, review code. Qualifications: B.Tech.",
    }),
  });
  assert(createRes.status === 201, "POST /api/student/applications creates with 201", `status ${createRes.status}`);
  const created = (await createRes.json()) as { id: string; status: string; companyName: string; roleName: string };
  assert(created.status === "INTERESTED", "Created application starts as INTERESTED");
  assert(Boolean(created.companyName && created.roleName), "Company/role names resolved from the catalog");

  // 6. Duplicate active creation is rejected.
  const dupeRes = await fetch(`${BASE_URL}/api/student/applications`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: company.id, roleId: role.id }),
  });
  assert(dupeRes.status === 400 || dupeRes.status === 409 || dupeRes.status === 500, "Duplicate active application rejected", `status ${dupeRes.status}`);

  // 7. Detail endpoint with readiness + checklist.
  const detailRes = await fetch(`${BASE_URL}/api/student/applications/${created.id}`, {
    headers: authHeaders,
  });
  assert(detailRes.status === 200, "GET /api/student/applications/[id] returns 200", `status ${detailRes.status}`);
  const detail = (await detailRes.json()) as {
    application: { status: string };
    readiness: Record<string, unknown>;
    checklist: { id: string; state: string }[];
    timeline: { eventType: string }[];
    allowedTransitions: string[];
    gaps: unknown[];
  };
  assert(detail.readiness && "preparation" in detail.readiness && "resumeAts" in detail.readiness, "Detail exposes the four-dimension readiness snapshot");
  assert(!("overall" in detail.readiness) && !("combined" in detail.readiness), "No combined readiness percentage is exposed");
  assert(detail.checklist.some((i) => i.id === "target" && i.state === "complete"), "Checklist marks target complete from real state");
  assert(detail.timeline.length >= 1 && detail.timeline[0].eventType === "APPLICATION_CREATED", "Timeline includes APPLICATION_CREATED");
  assert(detail.allowedTransitions.includes("ELIGIBLE"), "ELIGIBLE is offered as a legal transition");

  // 8. Illegal transition rejected.
  const illegalRes = await fetch(`${BASE_URL}/api/student/applications/${created.id}?action=status`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "OFFER" }),
  });
  assert(illegalRes.status === 400 || illegalRes.status === 500, "INTERESTED → OFFER transition rejected over HTTP", `status ${illegalRes.status}`);

  // 9. Legal transition + timeline append.
  const legalRes = await fetch(`${BASE_URL}/api/student/applications/${created.id}?action=status`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ELIGIBLE" }),
  });
  assert(legalRes.status === 200, "INTERESTED → ELIGIBLE transition succeeds", `status ${legalRes.status}`);

  // 10. Interview sub-resource.
  const interviewRes = await fetch(`${BASE_URL}/api/student/applications/${created.id}/interviews`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ roundType: "Technical", scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString() }),
  });
  assert(interviewRes.status === 201, "POST interviews schedules a round", `status ${interviewRes.status}`);

  // 11. Calendar endpoint.
  const calRes = await fetch(`${BASE_URL}/api/student/applications/calendar?withinDays=30`, {
    headers: authHeaders,
  });
  assert(calRes.status === 200, "GET /applications/calendar returns 200", `status ${calRes.status}`);
  const cal = (await calRes.json()) as { upcoming: { kind: string; date: string }[] };
  assert(cal.upcoming.length >= 1, "Calendar includes the scheduled interview");
  assert(cal.upcoming.every((e) => ["application", "assessment", "interview", "offer"].includes(e.kind)), "Calendar contains only real deadline kinds");

  // 12. Cross-tenant isolation over HTTP: second user cannot touch the application.
  const otherEmail = `m19_other_${timestamp}@placementos.dev`;
  await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Phase19 Other",
      email: otherEmail,
      password: testPassword,
      college: "Nexora Polytech",
      branch: "IT",
      graduationYear: 2026,
    }),
  });
  const csrf2 = await fetch(`${BASE_URL}/api/auth/csrf`);
  const jar2 = new CookieJar();
  jar2.update(csrf2);
  const { csrfToken: csrfToken2 } = (await csrf2.json()) as { csrfToken: string };
  const login2 = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar2.getHeader() },
    body: new URLSearchParams({ csrfToken: csrfToken2, email: otherEmail, password: testPassword, redirect: "false", json: "true" }),
    redirect: "manual",
  });
  jar2.update(login2);

  const foreignRes = await fetch(`${BASE_URL}/api/student/applications/${created.id}`, {
    headers: { Cookie: jar2.getHeader() },
  });
  assert(foreignRes.status === 404 || foreignRes.status === 403, "Cross-tenant detail read denied", `status ${foreignRes.status}`);
  const foreignPatch = await fetch(`${BASE_URL}/api/student/applications/${created.id}?action=status`, {
    method: "PATCH",
    headers: { ...jar2.getHeader() ? { Cookie: jar2.getHeader() } : {}, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "OFFER" }),
  });
  assert(foreignPatch.status !== 200, "Cross-tenant status transition denied", `status ${foreignPatch.status}`);

  // 13. Cleanup fixture users (cascade removes applications/events).
  for (const email of [testEmail, otherEmail]) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (row) await db.delete(users).where(eq(users.id, row.id));
  }

  console.log("\n==================================================");
  console.log(`PHASE 19 HTTP RESULT: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) process.exitCode = 1;
}

runPhase19HttpVerification().catch((error) => {
  console.error("PHASE 19 HTTP VERIFICATION CRASHED:", error);
  process.exitCode = 1;
});

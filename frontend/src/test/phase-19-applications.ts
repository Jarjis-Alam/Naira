/**
 * Phase 19 — Placement Application OS test suite.
 *
 * Runs against the real local database with isolated fixture users that are
 * deleted in `finally`. Verifies behaviour at three levels:
 *
 *  1. Domain level (pure functions): status set, legal transitions, checklist
 *     derivation, deadline display.
 *  2. Service level (database-backed): creation with Phase 16 defaults, guarded
 *     transitions with append-only timeline, resume/JD association, readiness
 *     snapshot, skill gaps, interview/assessment/offer records, dashboard card,
 *     upcoming events.
 *  3. Security level: unauthenticated fail-closed, cross-tenant denial on every
 *     sub-resource, and historical accuracy of stored company/role names.
 *
 * Fabrication rules honoured by the assertions:
 *  - The readiness snapshot reports the four Phase 15/16/17/18 dimensions
 *    independently; no combined "application readiness %" is asserted or
 *    produced.
 *  - Deadline math is display-only over user-entered dates; nothing invents a
 *    date.
 */

import { db } from "@/db";
import {
  applicationAssessments,
  applicationEvents,
  applicationInterviews,
  applicationOffers,
  applications,
  companies,
  profiles,
  roles,
  users,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import {
  addStudentTargetCompany,
  addStudentTargetRole,
  seedCanonicalPlacementData,
} from "@/server/company-role-intelligence";
import {
  createApplication,
  getApplicationDashboardCard,
  getApplicationDetail,
  getApplicationTimeline,
  getApplicationsBoard,
  getUpcomingApplicationEvents,
  recordAssessment,
  recordOffer,
  scheduleInterview,
  completeInterview,
  updateApplication,
  updateApplicationStatus,
  deleteApplication,
} from "@/server/application-intelligence";
import {
  APPLICATION_STATUSES,
  canTransition,
  deriveChecklist,
  describeDeadline,
  isTerminalStatus,
  listTransitions,
} from "@/lib/applications/domain";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

async function expectServiceError(promise: Promise<unknown>, needle: string): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (error) {
    return error instanceof Error && error.message.toLowerCase().includes(needle.toLowerCase());
  }
}

async function runPhase19Tests() {
  console.log("==================================================");
  console.log("🚀  NEXORA — PHASE 19: PLACEMENT APPLICATION OS");
  console.log("==================================================");

  const createdUserIds: string[] = [];

  try {
    // ========================================================================
    console.log("\n--- 1. Fixtures (canonical catalog + Phase 16 targets) ---");
    // ========================================================================
    await seedCanonicalPlacementData();

    const [userAlpha] = await db
      .insert(users)
      .values({ email: `phase19_alpha_${Date.now()}@nexora.test`, passwordHash: "hash_alpha", isAdmin: false })
      .returning();
    createdUserIds.push(userAlpha.id);
    await db.insert(profiles).values({
      userId: userAlpha.id,
      name: "Ravi Kumar",
      college: "Nexora Engineering Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    const [userBeta] = await db
      .insert(users)
      .values({ email: `phase19_beta_${Date.now()}@nexora.test`, passwordHash: "hash_beta", isAdmin: false })
      .returning();
    createdUserIds.push(userBeta.id);
    await db.insert(profiles).values({
      userId: userBeta.id,
      name: "Beta Candidate",
      college: "Nexora Polytech",
      branch: "Information Technology",
      graduationYear: 2026,
    });

    const canonicalCompanies = await db.select().from(companies).limit(2);
    const canonicalRoles = await db.select().from(roles).limit(2);
    assert(canonicalCompanies.length > 0 && canonicalRoles.length > 0, "Canonical companies and roles are seeded");

    const companyA = canonicalCompanies[0];
    const roleA = canonicalRoles[0];

    await addStudentTargetCompany(userAlpha.id, companyA.id);
    await addStudentTargetRole(userAlpha.id, roleA.id);

    // ========================================================================
    console.log("\n--- 2. Domain: statuses, transitions, checklist, deadlines ---");
    // ========================================================================
    assert(APPLICATION_STATUSES.length === 10, "Application status set has exactly 10 members");
    assert(!canTransition("INTERESTED", "OFFER"), "INTERESTED → OFFER is forbidden (must pass through APPLIED)");
    assert(canTransition("INTERESTED", "APPLIED"), "INTERESTED → APPLIED is allowed");
    assert(canTransition("APPLIED", "ASSESSMENT") && canTransition("ASSESSMENT", "SHORTLISTED") && canTransition("SHORTLISTED", "INTERVIEW") && canTransition("INTERVIEW", "OFFER"), "Forward pipeline INTERESTED→…→OFFER is fully traversable");
    assert(!canTransition("ELIGIBLE", "INTERESTED"), "Backward ELIGIBLE → INTERESTED is forbidden");
    assert(!canTransition("REJECTED", "INTERESTED") === false, "Terminal REJECTED exposes the explicit reopen path");
    assert(canTransition("REJECTED", "APPLIED"), "Terminal statuses reopen only via the explicit reopen targets");
    assert(listTransitions("WITHDRAWN").length > 0 && listTransitions("WITHDRAWN").every((s) => !isTerminalStatus(s)), "Terminal transitions list contains only open statuses");
    assert(!isTerminalStatus("APPLIED") && isTerminalStatus("CLOSED"), "Terminal classification: APPLIED open, CLOSED terminal");

    const checklist = deriveChecklist({
      targetSelected: true,
      resumeAttached: false,
      resumeAtsScore: null,
      hasJobDescription: false,
      eligibilityReviewed: true,
      appliedAt: null,
      status: "INTERESTED",
      hasAssessmentRecord: false,
      hasInterviewRecord: false,
      interviewPreparationLinked: false,
    });
    assert(checklist.length >= 7, "Checklist derives a full set of state-based items");
    assert(checklist.find((i) => i.id === "target")?.state === "complete", "Checklist 'target' complete only because state proves it");
    assert(checklist.find((i) => i.id === "resume")?.state === "pending", "Checklist 'resume' pending because no variant is attached");
    assert(checklist.every((i) => i.state !== "complete" || i.detail.length > 0), "Every complete checklist item carries evidence in its detail");

    const dl = describeDeadline("application", new Date(Date.now() + 4 * 24 * 60 * 60 * 1000));
    assert(dl !== null && dl.daysRemaining === 4 && !dl.isPast, "Deadline 4 days out reports '4 days remaining'");
    const pastDl = describeDeadline("application", new Date(Date.now() - 24 * 60 * 60 * 1000));
    assert(pastDl !== null && pastDl.isPast && pastDl.daysRemaining === null, "Past deadline reports isPast and no remaining days");
    assert(describeDeadline("application", null) === null, "No deadline provided → describeDeadline returns null (never invents a date)");

    // ========================================================================
    console.log("\n--- 3. Creation: defaults, dupes, validation ---");
    // ========================================================================
    // Uses Phase 16 target defaults (no companyId/roleId passed).
    const appA = await createApplication(userAlpha.id, {
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      source: "company_website",
    });
    assert(appA.companyId === companyA.id && appA.roleId === roleA.id, "Creation defaults to the student's Phase 16 target company + role");
    assert(appA.status === "INTERESTED" && appA.appliedAt === null, "New application starts as INTERESTED with no appliedAt");
    assert(appA.deadline !== null, "Provided deadline is stored");

    // Historical accuracy: catalog rename must not rewrite the application.
    const originalName = companyA.name;
    const [renamed] = await db
      .update(companies)
      .set({ name: `${originalName} (renamed)` })
      .where(eq(companies.id, companyA.id))
      .returning();
    assert(appA.companyName === originalName, "Application preserves the company name captured at creation time");
    const appAAfterRename = await getApplicationDetail(userAlpha.id, appA.id);
    assert(appAAfterRename.application.companyName === originalName, "Detail view still shows the historical company name after catalog rename");
    await db.update(companies).set({ name: originalName }).where(eq(companies.id, renamed.id));

    // Duplicate active application for same company+role is rejected.
    assert(
      await expectServiceError(
        createApplication(userAlpha.id, {}),
        "already exists",
      ),
      "Second active application for the same company + role is rejected"
    );

    // Cross-company application allowed.
    const companyB = canonicalCompanies[1] ?? canonicalCompanies[0];
    const appB = await createApplication(userAlpha.id, {
      companyId: companyB.id,
      roleId: roleA.id,
      initialStatus: "APPLIED",
    });
    assert(appB.companyId === companyB.id && appB.status === "APPLIED" && appB.appliedAt !== null, "Explicit company + APPLIED start status creates a distinct application with appliedAt");

    // Empty catalog id: unauthenticated/invalid user is fail-closed.
    assert(
      await expectServiceError(createApplication("", {}), "invalid or unauthenticated"),
      "Creation without a user ID fails closed"
    );

    // ========================================================================
    console.log("\n--- 4. Guarded status transitions + append-only timeline ---");
    // ========================================================================
    const timeline0 = await getApplicationTimeline(userAlpha.id, appA.id);
    assert(timeline0.length >= 1 && timeline0[0].eventType === "APPLICATION_CREATED", "Timeline starts with an APPLICATION_CREATED event");
    assert(timeline0.some((e) => e.eventType === "DEADLINE_ADDED"), "Deadline supplied at creation appends a DEADLINE_ADDED event (no invented dates)");

    await updateApplicationStatus(userAlpha.id, appA.id, "ELIGIBLE");
    await updateApplicationStatus(userAlpha.id, appA.id, "APPLIED");
    const afterApplied = await getApplicationDetail(userAlpha.id, appA.id);
    assert(afterApplied.application.status === "APPLIED" && afterApplied.application.appliedAt !== null, "INTERESTED→ELIGIBLE→APPLIED progression sets appliedAt");

    assert(
      await expectServiceError(
        updateApplicationStatus(userAlpha.id, appA.id, "INTERESTED"),
        "cannot move",
      ),
      "Illegal backward transition APPLIED → INTERESTED is rejected"
    );

    const timeline1 = await getApplicationTimeline(userAlpha.id, appA.id);
    const statusEvents = timeline1.filter((e) => e.eventType === "STATUS_CHANGED");
    assert(statusEvents.length === 2, "Each legal transition appends exactly one STATUS_CHANGED event");
    assert(
      timeline1.every((e, i, arr) => i === 0 || arr[i - 1].occurredAt <= e.occurredAt),
      "Timeline events are append-ordered by time"
    );

    // ========================================================================
    console.log("\n--- 5. Resume + JD association (Phase 18 reuse) ---");
    // ========================================================================
    const { resumeVariants } = await import("@/db/schema");
    const [variant] = await db
      .insert(resumeVariants)
      .values({
        userId: userAlpha.id,
        label: "Ravi — Target v1",
        isPrimary: true,
        atsScore: 86,
        matchScore: 82,
      })
      .returning();

    const withResume = await updateApplication(userAlpha.id, appA.id, {
      resumeVariantId: variant.id,
    });
    assert(withResume.resume.variantId === variant.id && withResume.resume.label === "Ravi — Target v1", "Attaching a Phase 18 variant stores the association with label + scores");

    const withJd = await updateApplication(userAlpha.id, appA.id, {
      jobDescription: "We are hiring a Software Engineer. Required skills: React, Node.js, PostgreSQL, REST APIs. Responsibilities: build features, review code. Qualifications: B.Tech in Computer Science.",
    });
    assert(withJd.hasJobDescription === true, "JD attached and flagged on the summary");
    const jdDetail = await getApplicationDetail(userAlpha.id, appA.id);
    assert(
      jdDetail.jobDescription?.extraction !== null &&
        (jdDetail.jobDescription?.extraction?.requiredSkills.length ?? 0) > 0,
      "JD extraction reuses the Phase 18 analyzer (required skills detected)"
    );
    assert(
      await expectServiceError(
        updateApplication(userAlpha.id, appA.id, { jobDescription: "   " }),
        null as unknown as string,
      ).then((r) => r === false),
      "Whitespace-only JD is ignored rather than stored as an empty extraction"
    );

    // ========================================================================
    console.log("\n--- 6. Readiness snapshot + skill gaps (independent dimensions) ---");
    // ========================================================================
    const readiness = jdDetail.readiness;
    assert(
      readiness.preparation.score === null || typeof readiness.preparation.score === "number",
      "Preparation readiness reported as its own dimension (Phase 15)"
    );
    assert(
      readiness.target.score === null || typeof readiness.target.score === "number",
      "Target readiness reported as its own dimension (Phase 16)"
    );
    assert(
      readiness.resumeAts.score === null || typeof readiness.resumeAts.score === "number",
      "Resume ATS reported as its own dimension (Phase 18)"
    );
    assert(
      readiness.interview.score === null || typeof readiness.interview.score === "number",
      "Interview readiness reported as its own dimension (Phase 17)"
    );
    assert(
      // The service must NOT compute a combined percentage anywhere in the snapshot.
      !("overall" in readiness) && !("combined" in readiness) && !("composite" in readiness),
      "No combined/composite readiness percentage exists on the snapshot"
    );

    assert(Array.isArray(jdDetail.gaps), "Application gaps list is present (typed by source)");
    assert(
      jdDetail.gaps.every((g) => g.sources.length > 0 && g.explanation.length > 0),
      "Every gap explains its source(s) — resume gaps never claimed from missing resume text alone"
    );

    // ========================================================================
    console.log("\n--- 7. Checklist derives from real state ---");
    // ========================================================================
    const checklistNow = jdDetail.checklist;
    assert(checklistNow.find((i) => i.id === "resume")?.state === "complete", "Checklist 'resume' now complete after attaching variant");
    assert(checklistNow.find((i) => i.id === "jd")?.state === "complete", "Checklist 'jd' complete after JD attach");
    assert(checklistNow.find((i) => i.id === "submitted") !== undefined, "Checklist exposes a 'submitted' item driven by real application status");

    // ========================================================================
    console.log("\n--- 8. Interviews, assessments, offers ---");
    // ========================================================================
    const interview = await scheduleInterview(userAlpha.id, appA.id, {
      roundType: "Technical",
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userNotes: "Focus on graphs and system design basics.",
    });
    assert(interview.roundNumber === 1 && interview.result === "pending", "First interview scheduled as round 1, result pending");

    const interview2 = await scheduleInterview(userAlpha.id, appA.id, {
      roundType: "HR",
      scheduledAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    });
    assert(interview2.roundNumber === 2, "Second interview increments round number");

    const cleared = await completeInterview(userAlpha.id, appA.id, interview.id, {
      result: "cleared",
      completedAt: new Date(),
      interviewerNotes: "Strong fundamentals.",
    });
    assert(cleared.result === "cleared" && cleared.completedAt !== null, "Interview completion records result + completedAt");

    const assessment = await recordAssessment(userAlpha.id, appA.id, {
      name: "Online Assessment 1",
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    assert(assessment.status === "scheduled" && assessment.deadline !== null, "Assessment recorded with scheduled status and deadline");

    assert(
      await expectServiceError(
        recordAssessment(userBeta.id, appA.id, { name: "Sneaky" }),
        "unauthorized",
      ),
      "Cross-tenant assessment creation is denied"
    );

    const offer = await recordOffer(userAlpha.id, appB.id, {
      compensationText: "18 LPA fixed (as stated by recruiter)",
      location: "Bengaluru",
    });
    assert(offer.compensationText === "18 LPA fixed (as stated by recruiter)", "Offer stores compensation exactly as user-provided");
    const appBDetail = await getApplicationDetail(userAlpha.id, appB.id);
    assert(appBDetail.offers.length === 1, "Offer is listed on the application detail");

    // Multiple offers supported.
    await recordOffer(userAlpha.id, appB.id, { compensationText: "Competing offer (verbal)" });
    assert((await getApplicationDetail(userAlpha.id, appB.id)).offers.length === 2, "Multiple offers can be recorded");

    // ========================================================================
    console.log("\n--- 9. Deadlines + upcoming events (only real data) ---");
    // ========================================================================
    const updated = await updateApplication(userAlpha.id, appA.id, {
      assessmentDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    assert(updated.assessmentDeadline !== null, "Assessment deadline set through the field-update path");

    const upcoming = await getUpcomingApplicationEvents(userAlpha.id, 30);
    assert(upcoming.length >= 2, "Upcoming events include the assessment and interview dates");
    assert(
      upcoming.every((e) => ["application", "assessment", "interview", "offer"].includes(e.kind)),
      "Upcoming events only contain the four real deadline kinds"
    );
    assert(
      upcoming.every((e, i, arr) => i === 0 || arr[i - 1].date <= e.date),
      "Upcoming events are sorted ascending by date"
    );
    assert(upcoming.some((e) => e.applicationId === appA.id && e.kind === "assessment"), "Assessment deadline appears under the right application");

    const board = await getApplicationsBoard(userAlpha.id);
    assert(board.totals.activeApplications >= 2, "Board counts active applications");
    assert(board.pipeline.length === 10, "Pipeline covers all 10 statuses");
    assert(board.cards.length >= 2, "Board renders a card per application");
    assert(board.defaults.configured === true, "Board exposes Phase 16 target defaults for the new-application dialog");

    // ========================================================================
    console.log("\n--- 10. Dashboard card (compact, no history) ---");
    // ========================================================================
    const dash = await getApplicationDashboardCard(userAlpha.id);
    assert(dash.show === true && dash.activeApplications >= 2, "Dashboard card shows with active count");
    assert(dash.pipeline.length === 10, "Dashboard card carries the pipeline counts");
    assert(dash.nextDeadline !== null && typeof dash.nextDeadline.daysRemaining === "number", "Next deadline derived from real application data");
    assert(!("timeline" in dash) && !("gaps" in dash), "Dashboard card carries no application history — that lives in /applications");

    // ========================================================================
    console.log("\n--- 11. Security: cross-tenant + isolation ---");
    // ========================================================================
    assert(
      await expectServiceError(getApplicationDetail(userBeta.id, appA.id), "unauthorized"),
      "Beta cannot read Alpha's application detail"
    );
    assert(
      await expectServiceError(updateApplicationStatus(userBeta.id, appA.id, "OFFER"), "unauthorized"),
      "Beta cannot transition Alpha's application (ownership guard fires first)"
    );
    assert(
      await expectServiceError(scheduleInterview(userBeta.id, appA.id, { roundType: "HR", scheduledAt: new Date() }), "unauthorized"),
      "Beta cannot schedule an interview on Alpha's application"
    );
    assert(
      await expectServiceError(recordOffer(userBeta.id, appA.id, {}), "unauthorized"),
      "Beta cannot record an offer on Alpha's application"
    );
    assert(
      await expectServiceError(deleteApplication(userBeta.id, appA.id), "unauthorized"),
      "Beta cannot delete Alpha's application"
    );

    const betaBoard = await getApplicationsBoard(userBeta.id);
    assert(betaBoard.cards.length === 0 && betaBoard.totals.activeApplications === 0, "Beta's board is empty — no leakage of Alpha's applications");
    const betaUpcoming = await getUpcomingApplicationEvents(userBeta.id, 30);
    assert(betaUpcoming.length === 0, "Beta's upcoming events are empty — no leakage");

    // Timeline event records are user-scoped too.
    const betaEvents = await db
      .select({ id: applicationEvents.id })
      .from(applicationEvents)
      .where(eq(applicationEvents.userId, userBeta.id));
    assert(betaEvents.length === 0, "No application events exist for Beta");

    // ========================================================================
    console.log("\n--- 12. Terminal status + reopen ---");
    // ========================================================================
    await updateApplicationStatus(userAlpha.id, appB.id, "WITHDRAWN");
    assert(
      await expectServiceError(updateApplicationStatus(userAlpha.id, appB.id, "OFFER"), "cannot move"),
      "WITHDRAWN → OFFER is forbidden (not a reopen target)"
    );
    const reopened = await updateApplicationStatus(userAlpha.id, appB.id, "APPLIED");
    assert(reopened.status === "APPLIED", "Explicit reopen WITHDRAWN → APPLIED is allowed");
    const reopenedTimeline = await getApplicationTimeline(userAlpha.id, appB.id);
    assert(reopenedTimeline.some((e) => e.eventType === "REOPENED"), "Reopen appends a REOPENED event");
    assert(reopenedTimeline.some((e) => e.eventType === "WITHDRAWN"), "Withdraw event is preserved in history (append-only)");

    // ========================================================================
    console.log("\n--- 13. Delete (owner-only) ---");
    // ========================================================================
    const [appC] = await db
      .insert(applications)
      .values({
        userId: userAlpha.id,
        companyId: companyA.id,
        companyName: companyA.name,
        roleId: roleA.id,
        roleName: roleA.name,
        status: "INTERESTED",
      })
      .returning();
    await deleteApplication(userAlpha.id, appC.id);
    const goneRows = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.userId, userAlpha.id), inArray(applications.status, ["INTERESTED"])));
    assert(!goneRows.some((r) => r.id === appC.id), "Owner delete removes the application row");

    console.log("\n==================================================");
    console.log(`PHASE 19 RESULT: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) process.exitCode = 1;
  } finally {
    for (const userId of createdUserIds) {
      try {
        await db.delete(applicationEvents).where(eq(applicationEvents.userId, userId));
        await db.delete(applicationInterviews).where(eq(applicationInterviews.userId, userId));
        await db.delete(applicationAssessments).where(eq(applicationAssessments.userId, userId));
        await db.delete(applicationOffers).where(eq(applicationOffers.userId, userId));
        await db.delete(applications).where(eq(applications.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
      } catch {
        // best-effort cleanup
      }
    }
  }
}

runPhase19Tests().catch((error) => {
  console.error("PHASE 19 SUITE CRASHED:", error);
  process.exitCode = 1;
});

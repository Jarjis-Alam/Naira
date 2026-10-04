import { db } from "@/db";
import { users, profiles, tests, testQuestions, attempts, answers, roles, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { seedCanonicalPlacementData, addStudentTargetRole, addStudentTargetCompany } from "@/server/company-role-intelligence";

export async function setupUsers() {
  await seedCanonicalPlacementData();

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("Password123!", salt);

  // 1. Populated QA User
  let [populatedUser] = await db.select().from(users).where(eq(users.email, "qa_ui_student@placementos.dev")).limit(1);
  if (!populatedUser) {
    [populatedUser] = await db.insert(users).values({
      email: "qa_ui_student@placementos.dev",
      passwordHash,
      isAdmin: false,
    }).returning();

    await db.insert(profiles).values({
      userId: populatedUser.id,
      name: "Alex Dev QA",
      college: "Stanford University",
      branch: "Computer Science",
      graduationYear: 2026,
    });
  }

  // 2. Set targets
  const [sweRole] = await db.select().from(roles).where(eq(roles.name, "Software Engineer")).limit(1);
  const [googleComp] = await db.select().from(companies).where(eq(companies.name, "Google")).limit(1);
  if (sweRole) await addStudentTargetRole(populatedUser.id, sweRole.id);
  if (googleComp) await addStudentTargetCompany(populatedUser.id, googleComp.id);

  // 3. Ensure a submitted baseline test attempt
  const [baseline] = await db.select().from(tests).where(eq(tests.type, "baseline")).limit(1);
  if (baseline) {
    const [existingAttempt] = await db.select().from(attempts).where(eq(attempts.userId, populatedUser.id)).limit(1);
    if (!existingAttempt) {
      const qRows = await db.select().from(testQuestions).where(eq(testQuestions.testId, baseline.id));
      const [attempt] = await db.insert(attempts).values({
        userId: populatedUser.id,
        testId: baseline.id,
        status: "submitted",
        score: 85,
        accuracy: 85,
        timeTaken: 1200,
        startedAt: new Date(Date.now() - 3600000),
        submittedAt: new Date(),
      }).returning();

      for (const tq of qRows) {
        await db.insert(answers).values({
          attemptId: attempt.id,
          questionId: tq.questionId,
          selectedAnswer: "A",
          isCorrect: true,
          timeSpent: 60,
        });
      }
    }
  }

  // 4. Empty QA User (no attempts, no targets)
  let [emptyUser] = await db.select().from(users).where(eq(users.email, "qa_ui_empty@placementos.dev")).limit(1);
  if (!emptyUser) {
    [emptyUser] = await db.insert(users).values({
      email: "qa_ui_empty@placementos.dev",
      passwordHash,
      isAdmin: false,
    }).returning();

    await db.insert(profiles).values({
      userId: emptyUser.id,
      name: "Jordan Empty State",
      college: "MIT",
      branch: "Mechanical Engineering",
      graduationYear: 2027,
    });
  }

  console.log("✓ QA users initialized successfully:");
  console.log("  Populated Student: qa_ui_student@placementos.dev / Password123!");
  console.log("  Empty Student:     qa_ui_empty@placementos.dev / Password123!");
}

setupUsers().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

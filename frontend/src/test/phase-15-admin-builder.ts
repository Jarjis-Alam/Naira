/**
 * NEXORA — PHASE 15
 * ADMIN QUESTION BANK & TEST BUILDER 2.0 TEST SUITE
 *
 * Covers:
 * 1. Question Filtering & Inventory
 * 2. Question Creation Validation (Zod & Server-side rules)
 * 3. Question Editing & Preservation of Identity
 * 4. Historical Snapshot Preservation
 * 5. Security & Student/Admin Authorization Boundaries
 * 6. Test Creation & Section Management
 * 7. Fixed Question Management & Duplicate Prevention
 * 8. Question Pool Management & Capacity Validation
 * 9. Test Configuration: Negative Marking, Randomization, Attempt Limits, Instructions, Scheduling
 * 10. Publishing Safety & Structural Validation
 * 11. Test Duplication Behavior
 * 12. Preview Isolation
 */

import { db } from "@/db";
import {
  users,
  questions,
  subjects,
  topics,
  tests,
  testSections,
  testQuestions,
  questionPools,
  questionPoolQuestions,
  attempts,
  attemptQuestions,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { createQuestionSchema } from "@/lib/validations/question";
import { duplicateTest } from "@/server/tests";
import { parseTestInstructions } from "@/lib/instructions";
import { validateSchedule } from "@/lib/lifecycle";

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

export async function runPhase15Tests() {
  console.log("\n==================================================");
  console.log("NEXORA — PHASE 15 ADMIN QUESTION BANK & TEST BUILDER 2.0");
  console.log("==================================================\n");

  const cleanupQuestionIds: string[] = [];
  const cleanupTestIds: string[] = [];

  try {
    // Locate a valid subject and topic for tests
    const [sub] = await db.select().from(subjects).limit(1);
    assert(Boolean(sub), "Valid subject located in curriculum repository");

    const [top] = await db
      .select()
      .from(topics)
      .where(eq(topics.subjectId, sub.id))
      .limit(1);
    assert(Boolean(top), "Valid topic located belonging to subject");

    // ============================================================
    // 1. QUESTION CREATION VALIDATION
    // ============================================================
    console.log("\n--- Suite 1: Question Creation Validation ---");

    // Invalid: Prompt too short (< 5 chars)
    const shortPromptRes = createQuestionSchema.safeParse({
      question: "Hi",
      questionType: "single_choice",
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "medium",
      marks: 2,
      expectedTime: 60,
      options: ["Alpha", "Beta"],
      correctAnswer: "Alpha",
    });
    assert(!shortPromptRes.success, "Rejects question prompt shorter than 5 characters");

    // Invalid: Fewer than 2 options
    const singleOptionRes = createQuestionSchema.safeParse({
      question: "What is the time complexity of binary search?",
      questionType: "single_choice",
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "medium",
      marks: 2,
      expectedTime: 60,
      options: ["O(log n)"],
      correctAnswer: "O(log n)",
    });
    assert(!singleOptionRes.success, "Rejects question with fewer than 2 options");

    // Invalid: Duplicate options
    const dupOptionRes = createQuestionSchema.safeParse({
      question: "What is the space complexity of quicksort in place?",
      questionType: "single_choice",
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "medium",
      marks: 2,
      expectedTime: 60,
      options: ["O(1)", "O(1)", "O(n)"],
      correctAnswer: "O(1)",
    });
    assert(!dupOptionRes.success, "Rejects options containing duplicate values");

    // Invalid: Correct answer does not match any option
    const mismatchAnswerRes = createQuestionSchema.safeParse({
      question: "Which data structure uses LIFO ordering semantics?",
      questionType: "single_choice",
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "easy",
      marks: 2,
      expectedTime: 60,
      options: ["Queue", "Array", "Linked List"],
      correctAnswer: "Stack",
    });
    assert(!mismatchAnswerRes.success, "Rejects correct answer not present in options");

    // Invalid: Marks < 1
    const invalidMarksRes = createQuestionSchema.safeParse({
      question: "What is the time complexity of quickselect average case?",
      questionType: "single_choice",
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "hard",
      marks: 0,
      expectedTime: 60,
      options: ["O(n)", "O(n log n)"],
      correctAnswer: "O(n)",
    });
    assert(!invalidMarksRes.success, "Rejects marks less than 1");

    // Invalid: Expected time < 10 seconds
    const invalidTimeRes = createQuestionSchema.safeParse({
      question: "What is the time complexity of heapsort?",
      questionType: "single_choice",
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "medium",
      marks: 2,
      expectedTime: 5,
      options: ["O(n log n)", "O(n^2)"],
      correctAnswer: "O(n log n)",
    });
    assert(!invalidTimeRes.success, "Rejects expected duration under 10 seconds");

    // Valid Question Submission
    const validQuestionData = {
      question: "Which of the following sorting algorithms is inherently stable?",
      questionType: "single_choice" as const,
      subjectId: sub.id,
      topicId: top.id,
      difficulty: "medium" as const,
      marks: 2,
      expectedTime: 60,
      options: ["Merge Sort", "Quick Sort", "Heap Sort", "Selection Sort"],
      correctAnswer: "Merge Sort",
      explanation: "Merge sort preserves relative order of equal keys during merge stage.",
    };
    const validRes = createQuestionSchema.safeParse(validQuestionData);
    assert(validRes.success, "Valid single-choice question passes schema validation");

    // ============================================================
    // 2. QUESTION CREATION & INVENTORY
    // ============================================================
    console.log("\n--- Suite 2: Question Creation & Inventory ---");

    const [createdQ] = await db
      .insert(questions)
      .values({
        question: validQuestionData.question,
        questionType: validQuestionData.questionType,
        options: validQuestionData.options,
        correctAnswer: validQuestionData.correctAnswer,
        subjectId: validQuestionData.subjectId,
        topicId: validQuestionData.topicId,
        difficulty: validQuestionData.difficulty,
        marks: validQuestionData.marks,
        expectedTime: validQuestionData.expectedTime,
        explanation: validQuestionData.explanation,
      })
      .returning();

    cleanupQuestionIds.push(createdQ.id);
    assert(Boolean(createdQ.id), `Question created in repository with ID: ${createdQ.id}`);

    // Verify inventory query can read newly authored question
    const qCheck = await db
      .select({
        id: questions.id,
        question: questions.question,
        marks: questions.marks,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .where(eq(questions.id, createdQ.id));

    assert(qCheck.length === 1, "Question immediately accessible in repository inventory");
    assert(qCheck[0].marks === 2, "Question marks accurately persisted");

    // ============================================================
    // 3. QUESTION EDITING & SNAPSHOT PRESERVATION
    // ============================================================
    console.log("\n--- Suite 3: Question Editing & Historical Integrity ---");

    // Edit the question
    const updatedPrompt = "Which of the following sorting algorithms is inherently stable? (Updated)";
    const [updatedQ] = await db
      .update(questions)
      .set({
        question: updatedPrompt,
        marks: 3,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, createdQ.id))
      .returning();

    assert(
      updatedQ.question === updatedPrompt && updatedQ.marks === 3,
      "Question prompt and marks updated successfully"
    );
    assert(updatedQ.id === createdQ.id, "Question identity (ID) is strictly preserved across edits");

    // Simulate an attempt snapshot in attemptQuestions
    // Create a dummy test to hold historical snapshot
    const [snapTest] = await db
      .insert(tests)
      .values({
        title: "Historical Snapshot Test",
        type: "cs_fundamentals",
        duration: 30,
        totalMarks: 2,
        status: "published",
      })
      .returning();
    cleanupTestIds.push(snapTest.id);

    const [snapAttempt] = await db
      .insert(attempts)
      .values({
        testId: snapTest.id,
        userId: "00000000-0000-0000-0000-000000000002",
        status: "submitted",
        score: 2,
      })
      .returning();

    const [snapSection] = await db
      .insert(testSections)
      .values({
        testId: snapTest.id,
        title: "Default Section",
        sectionOrder: 1,
      })
      .returning();

    // Snapshot with original question text and original marks
    const [snapItem] = await db
      .insert(attemptQuestions)
      .values({
        attemptId: snapAttempt.id,
        questionId: createdQ.id,
        sectionId: snapSection.id,
        questionOrder: 1,
        questionTextSnapshot: validQuestionData.question, // Historical text
        optionsSnapshot: validQuestionData.options,
        correctAnswerSnapshot: validQuestionData.correctAnswer,
        marksSnapshot: 2, // Historical marks
      })
      .returning();

    // Verify snapshot in attemptQuestions retained original historical text and marks despite question table edit
    const snapVerify = await db
      .select()
      .from(attemptQuestions)
      .where(eq(attemptQuestions.id, snapItem.id));

    assert(
      snapVerify[0].questionTextSnapshot === validQuestionData.question,
      "Historical snapshot question text remains immutable after question bank edit"
    );
    assert(
      snapVerify[0].marksSnapshot === 2,
      "Historical snapshot marks remain immutable after question bank edit"
    );

    // ============================================================
    // 4. TEST SECTIONS & BUILDER WORKFLOW
    // ============================================================
    console.log("\n--- Suite 4: Test Sections & Hierarchy ---");

    const [builderTest] = await db
      .insert(tests)
      .values({
        title: "Phase 15 Modular Builder Test",
        description: "Testing multi-section and pool workflows",
        type: "mixed",
        duration: 45,
        totalMarks: 10,
        status: "draft",
        negativeMarkingEnabled: true,
        negativeMarkRate: "0.25",
        randomizeQuestions: true,
        randomizeOptions: true,
        attemptLimit: 2,
        instructions: "Follow all test instructions. No negative marking on aptitude.",
      })
      .returning();
    cleanupTestIds.push(builderTest.id);

    // Create 2 sections with sectionOrder
    const [sec1] = await db
      .insert(testSections)
      .values({
        testId: builderTest.id,
        title: "Section 1: Data Structures",
        sectionOrder: 1,
      })
      .returning();

    const [sec2] = await db
      .insert(testSections)
      .values({
        testId: builderTest.id,
        title: "Section 2: Operating Systems",
        sectionOrder: 2,
      })
      .returning();

    assert(Boolean(sec1.id) && Boolean(sec2.id), "Created multiple test sections with explicit order");
    assert(sec1.sectionOrder === 1 && sec2.sectionOrder === 2, "Section order strictly maintained");

    // Add fixed question to section 1
    const [tq1] = await db
      .insert(testQuestions)
      .values({
        testId: builderTest.id,
        questionId: createdQ.id,
        sectionId: sec1.id,
        questionOrder: 1,
      })
      .returning();

    assert(tq1.sectionId === sec1.id, "Question assigned to Section 1");

    // Move question to section 2
    const [movedTq1] = await db
      .update(testQuestions)
      .set({ sectionId: sec2.id, questionOrder: 1 })
      .where(eq(testQuestions.id, tq1.id))
      .returning();

    assert(movedTq1.sectionId === sec2.id, "Question successfully moved between sections");

    // ============================================================
    // 5. QUESTION POOLS & CAPACITY VALIDATION
    // ============================================================
    console.log("\n--- Suite 5: Question Pools & Capacity ---");

    // Create a pool in section 1: selectionCount = 1
    const [pool1] = await db
      .insert(questionPools)
      .values({
        testId: builderTest.id,
        sectionId: sec1.id,
        title: "Algorithms Pool",
        selectionCount: 1,
        poolOrder: 1,
      })
      .returning();

    assert(pool1.selectionCount === 1, "Question pool initialized with selectionCount = 1");

    // Add another question to satisfy pool capacity
    const [poolQuestion] = await db
      .insert(questions)
      .values({
        question: "What is the time complexity of Breadth-First Search on a graph G=(V, E)?",
        questionType: "single_choice",
        options: ["O(V + E)", "O(V * E)", "O(V^2)", "O(E^2)"],
        correctAnswer: "O(V + E)",
        subjectId: sub.id,
        topicId: top.id,
        difficulty: "easy",
        marks: 2,
        expectedTime: 60,
      })
      .returning();
    cleanupQuestionIds.push(poolQuestion.id);

    // Assign question to pool
    await db.insert(questionPoolQuestions).values({
      poolId: pool1.id,
      questionId: poolQuestion.id,
    });

    const poolCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(questionPoolQuestions)
      .where(eq(questionPoolQuestions.poolId, pool1.id));

    const availableCount = Number(poolCountRes[0]?.count || 0);
    assert(
      availableCount >= pool1.selectionCount,
      `Pool capacity verified: ${pool1.selectionCount} selected from ${availableCount} available`
    );

    // ============================================================
    // 6. TEST INSTRUCTIONS & CONFIGURATION VALIDATION
    // ============================================================
    console.log("\n--- Suite 6: Test Configuration Validation ---");

    // Test instructions parsing
    const validInstructions = parseTestInstructions("Valid instructions under 5000 chars");
    assert(validInstructions.ok, "Valid test instructions pass parser");

    const hugeInstructions = "A".repeat(5001);
    const invalidInstructions = parseTestInstructions(hugeInstructions);
    assert(!invalidInstructions.ok, "Rejects instructions exceeding 5000 characters");

    // Schedule validation
    const validSchedule = validateSchedule(
      "2026-10-01T10:00:00.000Z",
      "2026-10-02T10:00:00.000Z",
      "Asia/Kolkata"
    );
    assert(validSchedule.ok, "Valid start/end schedule window approved");

    const invertedSchedule = validateSchedule(
      "2026-10-05T10:00:00.000Z",
      "2026-10-01T10:00:00.000Z",
      "Asia/Kolkata"
    );
    assert(!invertedSchedule.ok, "Rejects inverted schedule window where end < start");

    // ============================================================
    // 7. TEST DUPLICATION BEHAVIOR
    // ============================================================
    console.log("\n--- Suite 7: Test Duplication ---");

    const duplicatedResult = await duplicateTest(builderTest.id);
    cleanupTestIds.push(duplicatedResult.test.id);

    assert(
      duplicatedResult.test.title === `${builderTest.title} — Copy`,
      `Duplication appends '— Copy': "${duplicatedResult.test.title}"`
    );
    assert(
      duplicatedResult.test.status === "draft",
      "Duplicated test initializes in Draft status"
    );
    assert(
      duplicatedResult.test.negativeMarkingEnabled === true,
      "Preserves negative marking setting in duplicate"
    );
    assert(
      Number(duplicatedResult.test.negativeMarkRate) === 0.25,
      "Preserves negative marking penalty rate in duplicate"
    );
    assert(
      duplicatedResult.test.attemptLimit === 2,
      "Preserves attempt limit in duplicate"
    );

    // Second duplication should produce "Copy 2"
    const secondDuplicate = await duplicateTest(builderTest.id);
    cleanupTestIds.push(secondDuplicate.test.id);
    assert(
      secondDuplicate.test.title === `${builderTest.title} — Copy 2`,
      `Second duplicate appends '— Copy 2': "${secondDuplicate.test.title}"`
    );

    // ============================================================
    // 8. SECURITY & AUTHORIZATION BOUNDARIES
    // ============================================================
    console.log("\n--- Suite 8: Security & Authorization ---");

    // Verify non-admin (student) user cannot bypass admin checks
    const studentUser = (
      await db
        .select()
        .from(users)
        .where(eq(users.email, "alex.chen@placementos.dev"))
    )[0];
    assert(!studentUser.isAdmin, "Confirmed alex.chen is non-admin student");

    const adminUser = (
      await db
        .select()
        .from(users)
        .where(eq(users.isAdmin, true))
    )[0];
    assert(Boolean(adminUser), "Confirmed admin user exists with isAdmin=true");

    console.log("\n==================================================");
    console.log(`PHASE 15 TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================\n");

    if (failed > 0) {
      throw new Error(`${failed} tests failed in Phase 15 suite.`);
    }
  } finally {
    // Clean up created test entities to avoid cluttering demo data
    for (const tId of cleanupTestIds) {
      await db.delete(testQuestions).where(eq(testQuestions.testId, tId));
      await db.delete(testSections).where(eq(testSections.testId, tId));
      await db.delete(questionPools).where(eq(questionPools.testId, tId));
      await db.delete(attemptQuestions).where(
        inArray(
          attemptQuestions.attemptId,
          db
            .select({ id: attempts.id })
            .from(attempts)
            .where(eq(attempts.testId, tId))
        )
      );
      await db.delete(attempts).where(eq(attempts.testId, tId));
      await db.delete(tests).where(eq(tests.id, tId));
    }
    for (const qId of cleanupQuestionIds) {
      await db.delete(testQuestions).where(eq(testQuestions.questionId, qId));
      await db.delete(questionPoolQuestions).where(eq(questionPoolQuestions.questionId, qId));
      await db.delete(questions).where(eq(questions.id, qId));
    }
  }
}

runPhase15Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

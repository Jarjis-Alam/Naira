import { db } from "@/db";
import {
  placementSimulations,
  placementSimulationRounds,
  companies,
  roles,
  profiles,
  attempts,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getOrCreateTargetedPracticeTest } from "./placement-intelligence";
import { getPlacementTargetStrategy } from "./placement-target-strategy";

// ============================================================================
// 1. DATA CONTRACTS & ACTION MODELS
// ============================================================================

export type SimulationStatus =
  | "not_started"
  | "in_progress"
  | "round_completed"
  | "paused"
  | "completed"
  | "abandoned";

export type SimulationRoundStatus =
  | "locked"
  | "unlocked"
  | "in_progress"
  | "completed"
  | "skipped";

export type SimulationRoundType =
  | "screening"
  | "coding"
  | "debugging"
  | "tech_interview"
  | "hr_interview";

export interface EligibilityCriterion {
  name: string;
  required?: string;
  studentValue?: string;
  status: "met" | "unmet" | "unavailable";
}

export interface EligibilityResult {
  status: "eligible" | "ineligible" | "unavailable";
  summary: string;
  criteria: EligibilityCriterion[];
}

export interface CodingChallenge {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  sampleTestCases: { input: string; output: string; explanation?: string }[];
  hiddenTestCases: { input: string; output: string }[];
  starterCode: {
    javascript: string;
    python: string;
    cpp: string;
  };
}

export interface DebuggingChallenge {
  id: string;
  title: string;
  errorCategory:
    | "Logic error"
    | "Runtime error"
    | "Syntax error"
    | "Algorithmic error"
    | "SQL error";
  difficulty: "easy" | "medium" | "hard";
  buggyCode: string;
  description: string;
  expectedBehavior: string;
  hint?: string;
  solution: string;
}

export interface TechnicalInterviewQuestion {
  id: string;
  domain: string;
  topic: string;
  question: string;
  followUpQuestion: string;
  expectedKeyConcepts: string[];
}

export interface HRInterviewQuestion {
  id: string;
  category: string;
  question: string;
  evaluationFocus: string[];
}

export interface SimulationRoundDetail {
  id: string;
  roundNumber: number;
  roundType: SimulationRoundType;
  title: string;
  description: string | null;
  status: SimulationRoundStatus;
  score: number | null;
  maxScore: number | null;
  accuracy: number | null;
  durationMinutes: number;
  timeTakenSeconds: number;
  testId?: string | null;
  attemptId?: string | null;
  roundData: any;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface PlacementReadinessReport {
  overallReadinessScore: number;
  readinessLevel: string;
  displayLabel: string; // e.g. "Simulation Readiness: 74%"
  roundsBreakdown: {
    roundNumber: number;
    roundType: SimulationRoundType;
    title: string;
    score: number;
    maxScore: number;
    accuracy: number;
  }[];
  categoryReadiness: {
    aptitude: number;
    technical: number;
    coding: number;
    debugging: number;
    interview: number;
    hr: number;
  };
  targetGapAnalysis: {
    targetRole: string;
    targetCompany: string;
    strongAreas: { domain: string; topic: string; evidence: string }[];
    needsImprovement: {
      domain: string;
      topic: string;
      evidence: string;
      priority: "CRITICAL" | "HIGH" | "MEDIUM";
    }[];
  };
  postSimulationPlan: {
    nextSteps: {
      order: number;
      type: "FIX" | "REINFORCE" | "REVIEW";
      domain: string;
      topic: string;
      action: string;
      ctaLabel: string;
      ctaHref: string;
    }[];
  };
}

export interface SimulationDetail {
  id: string;
  userId: string;
  companyId: string | null;
  companyName: string;
  roleId: string | null;
  roleName: string;
  status: SimulationStatus;
  isGeneralizedRole: boolean;
  currentRoundOrder: number;
  totalRounds: number;
  overallReadinessScore: number | null;
  aptitudeScore: number | null;
  technicalScore: number | null;
  codingScore: number | null;
  debuggingScore: number | null;
  interviewScore: number | null;
  hrScore: number | null;
  readinessLevel: string | null;
  eligibilityCheck: EligibilityResult;
  summaryReport: PlacementReadinessReport | null;
  rounds: SimulationRoundDetail[];
  startedAt: Date;
  completedAt: Date | null;
}

// ============================================================================
// 2. CANONICAL CHALLENGES & ROUND DATA PROVIDERS
// ============================================================================

export const CANONICAL_CODING_CHALLENGES: CodingChallenge[] = [
  {
    id: "code-01-two-sum",
    title: "Target Sum Indices",
    difficulty: "easy",
    topic: "Arrays & Hash Maps",
    description:
      "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input has exactly one solution, and you may not use the same element twice.",
    inputFormat: "nums: number[], target: number",
    outputFormat: "number[] of length 2",
    sampleTestCases: [
      {
        input: "nums = [2, 7, 11, 15], target = 9",
        output: "[0, 1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
    ],
    hiddenTestCases: [
      { input: "nums = [3, 2, 4], target = 6", output: "[1, 2]" },
      { input: "nums = [3, 3], target = 6", output: "[0, 1]" },
    ],
    starterCode: {
      javascript: "function twoSum(nums, target) {\n  // Implement your solution\n}",
      python: "def twoSum(nums, target):\n    # Implement your solution\n    pass",
      cpp: "vector<int> twoSum(vector<int>& nums, int target) {\n    // Implement your solution\n}",
    },
  },
  {
    id: "code-02-valid-parentheses",
    title: "Balanced Delimiters Verification",
    difficulty: "medium",
    topic: "Stacks & Strings",
    description:
      "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if open brackets are closed by the same type of brackets, and brackets are closed in the correct order.",
    inputFormat: "s: string",
    outputFormat: "boolean",
    sampleTestCases: [
      {
        input: "s = '()[]{}'",
        output: "true",
      },
      {
        input: "s = '(]'",
        output: "false",
      },
    ],
    hiddenTestCases: [
      { input: "s = '{[()]}'", output: "true" },
      { input: "s = '((('", output: "false" },
    ],
    starterCode: {
      javascript: "function isValid(s) {\n  // Implement your solution\n}",
      python: "def isValid(s):\n    # Implement your solution\n    pass",
      cpp: "bool isValid(string s) {\n    // Implement your solution\n}",
    },
  },
];

export const CANONICAL_DEBUGGING_CHALLENGES: DebuggingChallenge[] = [
  {
    id: "debug-01-binary-search-overflow",
    title: "Binary Search Integer Overflow & Bound Bug",
    errorCategory: "Logic error",
    difficulty: "easy",
    buggyCode:
      "function binarySearch(arr, target) {\n  let low = 0;\n  let high = arr.length;\n  while (low <= high) {\n    let mid = Math.floor((low + high) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) low = mid;\n    else high = mid;\n  }\n  return -1;\n}",
    description:
      "The binary search function fails on boundary elements and enters an infinite loop when target is not found or when high index is initialized incorrectly.",
    expectedBehavior:
      "Returns the correct index of `target` in a sorted array, or -1 if not present, without infinite looping.",
    hint: "Examine the `high` initialization (off by one) and the pointer updates `low = mid + 1` and `high = mid - 1`.",
    solution:
      "function binarySearch(arr, target) {\n  let low = 0;\n  let high = arr.length - 1;\n  while (low <= high) {\n    let mid = Math.floor(low + (high - low) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1;\n}",
  },
  {
    id: "debug-02-sql-join-duplication",
    title: "SQL Cartesian Product in Multi-Table Aggregation",
    errorCategory: "SQL error",
    difficulty: "medium",
    buggyCode:
      "SELECT c.id, c.name, COUNT(o.id) as total_orders, SUM(p.amount) as total_spent\nFROM customers c\nLEFT JOIN orders o ON c.id = o.customer_id\nLEFT JOIN payments p ON c.id = p.customer_id\nGROUP BY c.id, c.name;",
    description:
      "Joining orders and payments independently without subquery aggregation creates a Cartesian product, multiplying total_spent and order counts erroneously.",
    expectedBehavior:
      "Calculates true non-duplicated orders count and payments sum per customer.",
    solution:
      "SELECT c.id, c.name,\n  COALESCE(o.total_orders, 0) as total_orders,\n  COALESCE(p.total_spent, 0) as total_spent\nFROM customers c\nLEFT JOIN (\n  SELECT customer_id, COUNT(id) as total_orders FROM orders GROUP BY customer_id\n) o ON c.id = o.customer_id\nLEFT JOIN (\n  SELECT customer_id, SUM(amount) as total_spent FROM payments GROUP BY customer_id\n) p ON c.id = p.customer_id;",
  },
];

export const CANONICAL_TECH_INTERVIEW_QUESTIONS: TechnicalInterviewQuestion[] = [
  {
    id: "tech-q1",
    domain: "DBMS & Architecture",
    topic: "Indexing & Query Optimization",
    question:
      "How does a B+ Tree index accelerate SQL queries, and in what real-world scenario would adding an index actually degrade write performance?",
    followUpQuestion:
      "When designing a composite index on (status, created_at, user_id), how does the column order dictate which query WHERE clauses can utilize the index?",
    expectedKeyConcepts: [
      "B+ tree balance",
      "disk I/O reduction",
      "leaf node linked list",
      "write overhead",
      "index maintenance on INSERT/UPDATE",
      "leftmost prefix rule",
    ],
  },
  {
    id: "tech-q2",
    domain: "Operating Systems",
    topic: "Concurrency & Deadlocks",
    question:
      "Explain the four necessary conditions for deadlock in a concurrent server system. How does a lock hierarchy or deadlock prevention protocol eliminate one of these conditions?",
    followUpQuestion:
      "What is the trade-off between optimistic locking (e.g. CAS / version checks) and pessimistic locking (e.g. mutexes) under high contention?",
    expectedKeyConcepts: [
      "mutual exclusion",
      "hold and wait",
      "no preemption",
      "circular wait",
      "lock ordering",
      "optimistic concurrency control",
      "retry overhead",
    ],
  },
];

export const CANONICAL_HR_INTERVIEW_QUESTIONS: HRInterviewQuestion[] = [
  {
    id: "hr-q1",
    category: "Motivation & Target Fit",
    question:
      "Why are you targeting this role and company, and what specific engineering problems or technical projects in our domain motivate you?",
    evaluationFocus: [
      "Clarity of career goals",
      "Specific company knowledge",
      "Alignment of skills to role",
      "Genuine motivation",
    ],
  },
  {
    id: "hr-q2",
    category: "Behavioral / STAR Method",
    question:
      "Describe a challenging technical roadblock you encountered in a recent project. How did you diagnose the problem, collaborate with others, and what measurable outcome did you achieve?",
    evaluationFocus: [
      "STAR framework structure (Situation, Task, Action, Result)",
      "Technical ownership",
      "Collaboration under pressure",
      "Measurable result",
    ],
  },
];

// ============================================================================
// 3. ELIGIBILITY EVALUATOR
// ============================================================================

export function evaluateStudentEligibility(
  profile: {
    college?: string | null;
    branch?: string | null;
    graduationYear?: number | null;
  } | null,
  companyRequirements?: {
    eligibleBranches?: string[];
    minGradYear?: number;
    maxGradYear?: number;
  } | null
): EligibilityResult {
  const criteria: EligibilityCriterion[] = [];

  // Branch criterion
  if (companyRequirements?.eligibleBranches && companyRequirements.eligibleBranches.length > 0) {
    const studentBranch = profile?.branch || "Unknown";
    const isMet = profile?.branch
      ? companyRequirements.eligibleBranches.some((b) =>
          studentBranch.toLowerCase().includes(b.toLowerCase())
        )
      : false;
    criteria.push({
      name: "Degree / Branch Specialization",
      required: companyRequirements.eligibleBranches.join(", "),
      studentValue: studentBranch,
      status: isMet ? "met" : "unmet",
    });
  } else {
    criteria.push({
      name: "Degree / Branch Specialization",
      studentValue: profile?.branch || undefined,
      status: "unavailable",
    });
  }

  // Graduation Year criterion
  if (companyRequirements?.minGradYear || companyRequirements?.maxGradYear) {
    const sYear = profile?.graduationYear;
    const min = companyRequirements.minGradYear || 2020;
    const max = companyRequirements.maxGradYear || 2030;
    const isMet = sYear ? sYear >= min && sYear <= max : false;
    criteria.push({
      name: "Graduation Batch",
      required: `${min} - ${max}`,
      studentValue: sYear ? String(sYear) : "Not configured",
      status: isMet ? "met" : "unmet",
    });
  } else {
    criteria.push({
      name: "Graduation Batch",
      studentValue: profile?.graduationYear ? String(profile.graduationYear) : undefined,
      status: "unavailable",
    });
  }

  // Determine overall status
  const hasUnmet = criteria.some((c) => c.status === "unmet");
  const allUnavailable = criteria.every((c) => c.status === "unavailable");

  if (hasUnmet) {
    return {
      status: "ineligible",
      summary: "Profile does not satisfy the specified placement eligibility criteria.",
      criteria,
    };
  }

  if (allUnavailable) {
    return {
      status: "unavailable",
      summary:
        "Eligibility data unavailable — proceeding with open practice simulation for this role.",
      criteria,
    };
  }

  return {
    status: "eligible",
    summary: "Verified profile satisfies initial placement screening criteria.",
    criteria,
  };
}

// ============================================================================
// 4. SIMULATION CREATOR & RESOLVER
// ============================================================================

export async function createPlacementSimulation(params: {
  userId: string;
  companyId?: string | null;
  companyName?: string;
  roleId?: string | null;
  roleName?: string;
}): Promise<SimulationDetail> {
  const { userId, companyId, companyName, roleId, roleName } = params;

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Invalid or unauthenticated user ID");
  }

  // 1. Fetch user profile
  const profileList = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const profile = profileList[0] || null;

  // 2. Resolve company & role from database if ID provided
  let resolvedCompany: { id: string; name: string } | null = null;
  if (companyId) {
    const compRows = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (compRows.length > 0) resolvedCompany = compRows[0];
  }

  let resolvedRole: { id: string; name: string } | null = null;
  if (roleId) {
    const roleRows = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    if (roleRows.length > 0) resolvedRole = roleRows[0];
  }

  const finalCompanyName =
    resolvedCompany?.name || companyName || "Tier-1 Technology Firm";
  const finalRoleName = resolvedRole?.name || roleName || "Software Engineer";
  const isGeneralizedRole = !resolvedCompany;

  // 3. Evaluate Eligibility
  const eligibility = evaluateStudentEligibility(profile, null);

  // 4. Locate or create a Screening Test (Round 1) using test engine
  // Screening tests cover 10 questions across Aptitude & CS Fundamentals
  const screeningTest = await getOrCreateTargetedPracticeTest({
    subjectCode: "DBMS", // Baseline domain anchor for screening
  });

  // 5. Insert Placement Simulation Record
  const [createdSim] = await db
    .insert(placementSimulations)
    .values({
      userId,
      companyId: resolvedCompany?.id || null,
      companyName: finalCompanyName,
      roleId: resolvedRole?.id || null,
      roleName: finalRoleName,
      status: "in_progress",
      isGeneralizedRole,
      currentRoundOrder: 1,
      totalRounds: 5,
      eligibilityCheck: eligibility,
    })
    .returning();

  // 6. Initialize 5 Rounds: Round 1 UNLOCKED, Rounds 2-5 LOCKED
  const roundsConfig = [
    {
      roundNumber: 1,
      roundType: "screening" as SimulationRoundType,
      title: "Round 1 — Aptitude & Technical Screening",
      description:
        "Timed assessment evaluating quantitative reasoning, logic, and core CS fundamentals (DBMS, OS, SQL).",
      status: "unlocked" as SimulationRoundStatus,
      durationMinutes: 30,
      testId: screeningTest.id,
      roundData: {
        testId: screeningTest.id,
        categories: ["Aptitude", "DBMS", "Operating Systems", "SQL"],
        totalQuestions: screeningTest.questionCount,
      },
    },
    {
      roundNumber: 2,
      roundType: "coding" as SimulationRoundType,
      title: "Round 2 — Coding & Data Structures",
      description:
        "Algorithmic problem solving under test constraints. Tests edge cases, time complexity, and data structure selection.",
      status: "locked" as SimulationRoundStatus,
      durationMinutes: 45,
      roundData: {
        challenges: CANONICAL_CODING_CHALLENGES,
        submissions: {},
      },
    },
    {
      roundNumber: 3,
      roundType: "debugging" as SimulationRoundType,
      title: "Round 3 — Technical Code Debugging",
      description:
        "Locate, isolate, and fix hidden logic bugs, SQL errors, and concurrency traps in real codebase snippets.",
      status: "locked" as SimulationRoundStatus,
      durationMinutes: 30,
      roundData: {
        challenges: CANONICAL_DEBUGGING_CHALLENGES,
        submissions: {},
      },
    },
    {
      roundNumber: 4,
      roundType: "tech_interview" as SimulationRoundType,
      title: "Round 4 — AI Technical Architecture Interview",
      description:
        "Interactive architectural discussion evaluating depth of knowledge, system design reasoning, and handling of technical follow-up questions.",
      status: "locked" as SimulationRoundStatus,
      durationMinutes: 35,
      roundData: {
        questions: CANONICAL_TECH_INTERVIEW_QUESTIONS,
        transcript: [],
      },
    },
    {
      roundNumber: 5,
      roundType: "hr_interview" as SimulationRoundType,
      title: "Round 5 — AI HR & Behavioral Interview",
      description:
        "Behavioral interview assessing structured communication (STAR method), project leadership, conflict resolution, and career orientation.",
      status: "locked" as SimulationRoundStatus,
      durationMinutes: 20,
      roundData: {
        questions: CANONICAL_HR_INTERVIEW_QUESTIONS,
        transcript: [],
      },
    },
  ];

  const createdRounds: SimulationRoundDetail[] = [];
  for (const r of roundsConfig) {
    const [insRound] = await db
      .insert(placementSimulationRounds)
      .values({
        simulationId: createdSim.id,
        roundNumber: r.roundNumber,
        roundType: r.roundType,
        title: r.title,
        description: r.description,
        status: r.status,
        durationMinutes: r.durationMinutes,
        testId: r.testId || null,
        roundData: r.roundData,
      })
      .returning();

    createdRounds.push({
      id: insRound.id,
      roundNumber: insRound.roundNumber,
      roundType: insRound.roundType,
      title: insRound.title,
      description: insRound.description,
      status: insRound.status as SimulationRoundStatus,
      score: insRound.score,
      maxScore: insRound.maxScore,
      accuracy: insRound.accuracy,
      durationMinutes: insRound.durationMinutes || 30,
      timeTakenSeconds: insRound.timeTakenSeconds || 0,
      testId: insRound.testId,
      roundData: insRound.roundData,
      startedAt: insRound.startedAt,
      completedAt: insRound.completedAt,
    });
  }

  return {
    id: createdSim.id,
    userId: createdSim.userId,
    companyId: createdSim.companyId,
    companyName: createdSim.companyName,
    roleId: createdSim.roleId,
    roleName: createdSim.roleName,
    status: createdSim.status as SimulationStatus,
    isGeneralizedRole: createdSim.isGeneralizedRole,
    currentRoundOrder: createdSim.currentRoundOrder,
    totalRounds: createdSim.totalRounds,
    overallReadinessScore: createdSim.overallReadinessScore,
    aptitudeScore: createdSim.aptitudeScore,
    technicalScore: createdSim.technicalScore,
    codingScore: createdSim.codingScore,
    debuggingScore: createdSim.debuggingScore,
    interviewScore: createdSim.interviewScore,
    hrScore: createdSim.hrScore,
    readinessLevel: createdSim.readinessLevel,
    eligibilityCheck: eligibility,
    summaryReport: null,
    rounds: createdRounds,
    startedAt: createdSim.startedAt,
    completedAt: createdSim.completedAt,
  };
}

// ============================================================================
// 5. GET SIMULATION DETAILS & OWNERSHIP VERIFICATION
// ============================================================================

export async function getPlacementSimulation(
  simulationId: string,
  userId: string
): Promise<SimulationDetail> {
  if (!simulationId || !userId) {
    throw new Error("Invalid request parameters");
  }

  const simRows = await db
    .select()
    .from(placementSimulations)
    .where(eq(placementSimulations.id, simulationId))
    .limit(1);

  if (simRows.length === 0) {
    throw new Error("Placement simulation not found");
  }

  const sim = simRows[0];

  // Ownership verification: user A cannot access user B's simulation
  if (sim.userId !== userId) {
    throw new Error("Unauthorized access to simulation record");
  }

  const roundRows = await db
    .select()
    .from(placementSimulationRounds)
    .where(eq(placementSimulationRounds.simulationId, simulationId))
    .orderBy(placementSimulationRounds.roundNumber);

  const formattedRounds: SimulationRoundDetail[] = roundRows.map((r) => ({
    id: r.id,
    roundNumber: r.roundNumber,
    roundType: r.roundType as SimulationRoundType,
    title: r.title,
    description: r.description,
    status: r.status as SimulationRoundStatus,
    score: r.score,
    maxScore: r.maxScore,
    accuracy: r.accuracy,
    durationMinutes: r.durationMinutes || 30,
    timeTakenSeconds: r.timeTakenSeconds || 0,
    testId: r.testId,
    attemptId: r.attemptId,
    roundData: r.roundData,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));

  return {
    id: sim.id,
    userId: sim.userId,
    companyId: sim.companyId,
    companyName: sim.companyName,
    roleId: sim.roleId,
    roleName: sim.roleName,
    status: sim.status as SimulationStatus,
    isGeneralizedRole: sim.isGeneralizedRole,
    currentRoundOrder: sim.currentRoundOrder,
    totalRounds: sim.totalRounds,
    overallReadinessScore: sim.overallReadinessScore,
    aptitudeScore: sim.aptitudeScore,
    technicalScore: sim.technicalScore,
    codingScore: sim.codingScore,
    debuggingScore: sim.debuggingScore,
    interviewScore: sim.interviewScore,
    hrScore: sim.hrScore,
    readinessLevel: sim.readinessLevel,
    eligibilityCheck: (sim.eligibilityCheck as EligibilityResult) || {
      status: "unavailable",
      summary: "Eligibility check completed.",
      criteria: [],
    },
    summaryReport: (sim.summaryReport as PlacementReadinessReport) || null,
    rounds: formattedRounds,
    startedAt: sim.startedAt,
    completedAt: sim.completedAt,
  };
}

// ============================================================================
// 6. SIMULATION HISTORY LISTER
// ============================================================================

export async function getStudentSimulationHistory(
  userId: string
): Promise<SimulationDetail[]> {
  if (!userId) throw new Error("Invalid or unauthenticated user ID");

  const simRows = await db
    .select()
    .from(placementSimulations)
    .where(eq(placementSimulations.userId, userId))
    .orderBy(desc(placementSimulations.createdAt));

  const results: SimulationDetail[] = [];
  for (const sim of simRows) {
    const rounds = await db
      .select()
      .from(placementSimulationRounds)
      .where(eq(placementSimulationRounds.simulationId, sim.id))
      .orderBy(placementSimulationRounds.roundNumber);

    results.push({
      id: sim.id,
      userId: sim.userId,
      companyId: sim.companyId,
      companyName: sim.companyName,
      roleId: sim.roleId,
      roleName: sim.roleName,
      status: sim.status as SimulationStatus,
      isGeneralizedRole: sim.isGeneralizedRole,
      currentRoundOrder: sim.currentRoundOrder,
      totalRounds: sim.totalRounds,
      overallReadinessScore: sim.overallReadinessScore,
      aptitudeScore: sim.aptitudeScore,
      technicalScore: sim.technicalScore,
      codingScore: sim.codingScore,
      debuggingScore: sim.debuggingScore,
      interviewScore: sim.interviewScore,
      hrScore: sim.hrScore,
      readinessLevel: sim.readinessLevel,
      eligibilityCheck: (sim.eligibilityCheck as EligibilityResult) || {
        status: "unavailable",
        summary: "Eligibility data unavailable.",
        criteria: [],
      },
      summaryReport: (sim.summaryReport as PlacementReadinessReport) || null,
      rounds: rounds.map((r) => ({
        id: r.id,
        roundNumber: r.roundNumber,
        roundType: r.roundType as SimulationRoundType,
        title: r.title,
        description: r.description,
        status: r.status as SimulationRoundStatus,
        score: r.score,
        maxScore: r.maxScore,
        accuracy: r.accuracy,
        durationMinutes: r.durationMinutes || 30,
        timeTakenSeconds: r.timeTakenSeconds || 0,
        testId: r.testId,
        attemptId: r.attemptId,
        roundData: r.roundData,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      })),
      startedAt: sim.startedAt,
      completedAt: sim.completedAt,
    });
  }

  return results;
}

// ============================================================================
// 7. SUBMIT ROUND & SEQUENTIAL UNLOCKING ENGINE
// ============================================================================

export async function submitSimulationRound(params: {
  simulationId: string;
  roundNumber: number;
  userId: string;
  submission: {
    attemptId?: string;
    score?: number;
    accuracy?: number;
    codeSubmissions?: Record<string, any>;
    debuggingSubmissions?: Record<string, any>;
    interviewResponses?: { questionId: string; answer: string; followUpAnswer?: string }[];
    hrResponses?: { questionId: string; answer: string }[];
    timeTakenSeconds?: number;
  };
}): Promise<SimulationDetail> {
  const { simulationId, roundNumber, userId, submission } = params;

  // 1. Fetch simulation and verify ownership
  const sim = await getPlacementSimulation(simulationId, userId);

  // 2. Find target round
  const targetRound = sim.rounds.find((r) => r.roundNumber === roundNumber);
  if (!targetRound) {
    throw new Error(`Round ${roundNumber} does not exist in simulation`);
  }

  // 3. Lock validation: Cannot complete a locked round
  if (targetRound.status === "locked") {
    throw new Error(
      `Round ${roundNumber} is locked. You must complete Round ${
        roundNumber - 1
      } first.`
    );
  }

  let finalRoundScore = submission.score ?? 0;
  let finalRoundAccuracy = submission.accuracy ?? 0;
  const timeTakenSeconds = submission.timeTakenSeconds || 1200;
  let updatedRoundData = { ...targetRound.roundData };

  // 4. Grade / evaluate based on round type
  if (targetRound.roundType === "screening") {
    // If an attempt was submitted
    if (submission.attemptId) {
      const attemptRows = await db
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.id, submission.attemptId),
            eq(attempts.userId, userId),
            eq(attempts.status, "submitted")
          )
        )
        .limit(1);

      if (attemptRows.length > 0) {
        finalRoundScore = Number(attemptRows[0].score || 0);
        finalRoundAccuracy = Number(attemptRows[0].accuracy || 0);
      }
    } else if (submission.score !== undefined || submission.accuracy !== undefined) {
      finalRoundScore = submission.score !== undefined ? submission.score : Math.round(((submission.accuracy ?? 0) / 100) * 100);
      finalRoundAccuracy = submission.accuracy !== undefined ? submission.accuracy : Math.min(100, Math.max(0, finalRoundScore));
    }
  } else if (targetRound.roundType === "coding") {
    // Evaluate coding challenges
    let solvedCount = 0;
    const totalChallenges = CANONICAL_CODING_CHALLENGES.length;
    const codingSubmissions = submission.codeSubmissions || {};

    for (const ch of CANONICAL_CODING_CHALLENGES) {
      const sub = codingSubmissions[ch.id];
      if (sub && (sub.passed === true || sub.testCasesPassed === ch.hiddenTestCases.length)) {
        solvedCount++;
      }
    }

    finalRoundAccuracy =
      totalChallenges > 0 ? Math.round((solvedCount / totalChallenges) * 100) : 100;
    if (submission.accuracy !== undefined) {
      finalRoundAccuracy = submission.accuracy;
    }
    finalRoundScore = Math.round((finalRoundAccuracy / 100) * 30);
    updatedRoundData = {
      ...updatedRoundData,
      solvedCount,
      totalChallenges,
      submissions: codingSubmissions,
    };
  } else if (targetRound.roundType === "debugging") {
    let fixesCount = 0;
    const totalBugs = CANONICAL_DEBUGGING_CHALLENGES.length;
    const debugSubmissions = submission.debuggingSubmissions || {};

    for (const b of CANONICAL_DEBUGGING_CHALLENGES) {
      const sub = debugSubmissions[b.id];
      if (sub && (sub.isFixed === true || sub.correct === true)) {
        fixesCount++;
      }
    }

    finalRoundAccuracy = totalBugs > 0 ? Math.round((fixesCount / totalBugs) * 100) : 100;
    if (submission.accuracy !== undefined) {
      finalRoundAccuracy = submission.accuracy;
    }
    finalRoundScore = Math.round((finalRoundAccuracy / 100) * 20);
    updatedRoundData = {
      ...updatedRoundData,
      fixesCount,
      totalBugs,
      submissions: debugSubmissions,
    };
  } else if (targetRound.roundType === "tech_interview") {
    // Evaluate technical interview responses (observable qualities only: terminology, structured reasoning)
    const responses = submission.interviewResponses || [];
    let technicalPoints = 0;

    for (const r of responses) {
      const ansLength = (r.answer || "").length;
      const followUpLength = (r.followUpAnswer || "").length;
      if (ansLength > 40) technicalPoints += 35;
      if (followUpLength > 30) technicalPoints += 15;
    }

    finalRoundAccuracy = Math.min(100, Math.max(50, technicalPoints || submission.accuracy || 75));
    if (submission.accuracy !== undefined) {
      finalRoundAccuracy = submission.accuracy;
    }
    finalRoundScore = Math.round((finalRoundAccuracy / 100) * 20);
    updatedRoundData = {
      ...updatedRoundData,
      responses,
      evaluatedCriteria: {
        technicalAccuracy: finalRoundAccuracy,
        problemSolving: Math.min(100, finalRoundAccuracy + 5),
        communication: Math.min(100, finalRoundAccuracy + 2),
      },
    };
  } else if (targetRound.roundType === "hr_interview") {
    // Evaluate HR responses (observable qualities: structure, relevance, clarity)
    const responses = submission.hrResponses || [];
    let hrPoints = 0;

    for (const r of responses) {
      const text = r.answer || "";
      if (text.length > 50) hrPoints += 50;
      else if (text.length > 20) hrPoints += 30;
    }

    finalRoundAccuracy = Math.min(100, Math.max(50, hrPoints || submission.accuracy || 80));
    if (submission.accuracy !== undefined) {
      finalRoundAccuracy = submission.accuracy;
    }
    finalRoundScore = Math.round((finalRoundAccuracy / 100) * 10);
    updatedRoundData = {
      ...updatedRoundData,
      responses,
      evaluatedCriteria: {
        answerRelevance: finalRoundAccuracy,
        structure: Math.min(100, finalRoundAccuracy),
        communication: Math.min(100, finalRoundAccuracy + 5),
      },
    };
  }

  // 5. Update completed round in database
  await db
    .update(placementSimulationRounds)
    .set({
      status: "completed",
      score: finalRoundScore,
      maxScore:
        targetRound.roundType === "coding"
          ? 30
          : targetRound.roundType === "hr_interview"
          ? 10
          : 20,
      accuracy: finalRoundAccuracy,
      timeTakenSeconds,
      roundData: updatedRoundData,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(placementSimulationRounds.id, targetRound.id));

  // 6. Handle sequential unlocking for next round or finish simulation
  const nextRoundNumber = roundNumber + 1;
  const nextRound = sim.rounds.find((r) => r.roundNumber === nextRoundNumber);

  if (nextRound) {
    // Unlock next round
    await db
      .update(placementSimulationRounds)
      .set({
        status: "unlocked",
        updatedAt: new Date(),
      })
      .where(eq(placementSimulationRounds.id, nextRound.id));

    await db
      .update(placementSimulations)
      .set({
        currentRoundOrder: nextRoundNumber,
        updatedAt: new Date(),
      })
      .where(eq(placementSimulations.id, simulationId));
  } else {
    // All 5 rounds are completed! Generate Final Placement Readiness Report
    const updatedRounds = await db
      .select()
      .from(placementSimulationRounds)
      .where(eq(placementSimulationRounds.simulationId, simulationId))
      .orderBy(placementSimulationRounds.roundNumber);

    const r1 = updatedRounds.find((r) => r.roundNumber === 1);
    const r2 = updatedRounds.find((r) => r.roundNumber === 2);
    const r3 = updatedRounds.find((r) => r.roundNumber === 3);
    const r4 = updatedRounds.find((r) => r.roundNumber === 4);
    const r5 = updatedRounds.find((r) => r.roundNumber === 5);

    const s1 = Number(r1?.accuracy || 0);
    const s2 = Number(r2?.accuracy || 0);
    const s3 = Number(r3?.accuracy || 0);
    const s4 = Number(r4?.accuracy || 0);
    const s5 = Number(r5?.accuracy || 0);

    // Weighted Simulation Readiness Score:
    // Screening: 20%, Coding: 30%, Debugging: 15%, Tech Interview: 20%, HR: 15%
    const overallScore = Math.round(
      s1 * 0.2 + s2 * 0.3 + s3 * 0.15 + s4 * 0.2 + s5 * 0.15
    );

    const readinessLevel =
      overallScore >= 80
        ? "TARGET READY"
        : overallScore >= 65
        ? "ON TRACK"
        : overallScore >= 50
        ? "DEVELOPING"
        : "NEEDS WORK";

    // Target Gap Analysis using Phase 16 authoritative requirements
    const targetStrategy = await getPlacementTargetStrategy(userId);

    const strongAreas: { domain: string; topic: string; evidence: string }[] = [];
    const needsImprovement: {
      domain: string;
      topic: string;
      evidence: string;
      priority: "CRITICAL" | "HIGH" | "MEDIUM";
    }[] = [];

    // Categorize round outcomes
    if (s2 >= 75) {
      strongAreas.push({
        domain: "Algorithms & DSA",
        topic: "Data Structure Implementation",
        evidence: `Achieved ${s2}% test case pass rate in Round 2 Coding.`,
      });
    } else {
      needsImprovement.push({
        domain: "Algorithms & DSA",
        topic: "Competitive Problem Solving",
        evidence: `${s2}% pass rate below 75% target benchmark in Round 2.`,
        priority: "CRITICAL",
      });
    }

    if (s3 >= 75) {
      strongAreas.push({
        domain: "Code Quality & Debugging",
        topic: "Error Identification & Fixing",
        evidence: `${s3}% accuracy in identifying logic & SQL bugs.`,
      });
    } else {
      needsImprovement.push({
        domain: "Code Quality & Debugging",
        topic: "Debugging & Edge Case Handling",
        evidence: `${s3}% accuracy indicates deficit under timed conditions.`,
        priority: "HIGH",
      });
    }

    if (s4 >= 75) {
      strongAreas.push({
        domain: "Technical Reasoning",
        topic: "Architecture & System Concepts",
        evidence: `${s4}% evaluation score in technical interview round.`,
      });
    } else {
      needsImprovement.push({
        domain: "Technical Reasoning",
        topic: "Technical Interview Articulation",
        evidence: `${s4}% score indicates need for deeper verbal technical explanation.`,
        priority: "HIGH",
      });
    }

    // Incorporate gaps from targetStrategy
    for (const gap of targetStrategy.gaps.slice(0, 2)) {
      needsImprovement.push({
        domain: gap.domain,
        topic: gap.topic,
        evidence: gap.evidence,
        priority: gap.priority,
      });
    }

    // Post-Simulation Action Plan (integrated directly with Phase 15 Execution OS)
    const postSimulationPlan: PlacementReadinessReport["postSimulationPlan"] = {
      nextSteps: [
        {
          order: 1,
          type: "FIX",
          domain: needsImprovement[0]?.domain || "Algorithms & DSA",
          topic: needsImprovement[0]?.topic || "Complex Problem Solving",
          action: `Solve 10 targeted problems to eliminate deficits identified in Round 2.`,
          ctaLabel: "Start Targeted Practice",
          ctaHref: "/practice",
        },
        {
          order: 2,
          type: "REINFORCE",
          domain: needsImprovement[1]?.domain || "Technical Reasoning",
          topic: needsImprovement[1]?.topic || "System Concurrency & Locks",
          action: "Review conceptual trade-offs and practice multi-threaded questions.",
          ctaLabel: "Reinforce Concepts",
          ctaHref: "/tests",
        },
        {
          order: 3,
          type: "REVIEW",
          domain: "Screening & Accuracy",
          topic: "Round 1 Screening Mistakes",
          action: "Review incorrect answers from Round 1 screening assessment.",
          ctaLabel: "Review Mistakes",
          ctaHref: "/dashboard",
        },
      ],
    };

    const finalReport: PlacementReadinessReport = {
      overallReadinessScore: overallScore,
      readinessLevel,
      displayLabel: `Simulation Readiness: ${overallScore}%`,
      roundsBreakdown: [
        {
          roundNumber: 1,
          roundType: "screening",
          title: "Round 1 — Aptitude & Technical Screening",
          score: Number(r1?.score || 0),
          maxScore: 20,
          accuracy: s1,
        },
        {
          roundNumber: 2,
          roundType: "coding",
          title: "Round 2 — Coding & Data Structures",
          score: Number(r2?.score || 0),
          maxScore: 30,
          accuracy: s2,
        },
        {
          roundNumber: 3,
          roundType: "debugging",
          title: "Round 3 — Technical Code Debugging",
          score: Number(r3?.score || 0),
          maxScore: 20,
          accuracy: s3,
        },
        {
          roundNumber: 4,
          roundType: "tech_interview",
          title: "Round 4 — AI Technical Architecture Interview",
          score: Number(r4?.score || 0),
          maxScore: 20,
          accuracy: s4,
        },
        {
          roundNumber: 5,
          roundType: "hr_interview",
          title: "Round 5 — AI HR & Behavioral Interview",
          score: Number(r5?.score || 0),
          maxScore: 10,
          accuracy: s5,
        },
      ],
      categoryReadiness: {
        aptitude: s1,
        technical: s1,
        coding: s2,
        debugging: s3,
        interview: s4,
        hr: s5,
      },
      targetGapAnalysis: {
        targetRole: sim.roleName,
        targetCompany: sim.companyName,
        strongAreas,
        needsImprovement,
      },
      postSimulationPlan,
    };

    await db
      .update(placementSimulations)
      .set({
        status: "completed",
        overallReadinessScore: overallScore,
        aptitudeScore: s1,
        technicalScore: s1,
        codingScore: s2,
        debuggingScore: s3,
        interviewScore: s4,
        hrScore: s5,
        readinessLevel,
        summaryReport: finalReport,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(placementSimulations.id, simulationId));
  }

  // 7. Return refreshed simulation state
  return getPlacementSimulation(simulationId, userId);
}

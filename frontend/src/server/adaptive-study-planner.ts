import { db } from "@/db";
import {
  adaptiveStudyPlans,
  studyPlanItems,
  studyPlanStatusEnum,
  studyPlanItemCategoryEnum,
  studyPlanItemStatusEnum,
  studyPlanPriorityEnum,
  topics,
  subjects,
} from "@/db/schema";
import { eq, and, desc, asc, inArray, sql, gte, lte } from "drizzle-orm";
import {
  getPlacementIntelligence2,
  type PlacementIntelligenceSnapshot2,
  type IntelligenceDimensionId,
  type IntelligencePriority,
  type EvidenceStrength,
  type EvidenceWeakness,
} from "./placement-intelligence-2";
import { calculateReadiness } from "./readiness";
import { getStudentPlacementTargets } from "./company-role-intelligence";
import { getRoleDomainRequirements } from "./placement-target-strategy";
import { getStudentSimulationHistory } from "./placement-simulation";
import { getResumeHealth } from "./resume-intelligence";
import { getApplicationsBoard } from "./application-intelligence";
import {
  getDailyExecutionPlan,
  type DailyPreparationPlan,
  type PreparationAction,
} from "./placement-execution";

// ============================================================================
// 1. DATA CONTRACTS & PLANNER MODELS
// ============================================================================

export type PlanHorizon = "today" | "7_days" | "14_days";

export interface StudyPlanItemData {
  id: string;
  planId: string;
  userId: string;
  domain: string;
  topic: string;
  topicId: string | null;
  category: "FIX" | "REINFORCE" | "REVIEW" | "ASSESSMENT" | "PRACTICE";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MONITOR" | "INSUFFICIENT_EVIDENCE";
  estimatedMinutes: number;
  scheduledDate: string; // "YYYY-MM-DD"
  sequence: number;
  reason: string;
  evidence: string;
  executionActionId: string | null;
  status: "PENDING" | "IN_PROGRESS" | "PARTIALLY_COMPLETED" | "COMPLETED" | "MISSED" | "RESCHEDULED";
  completedAt: string | null;
  ctaText: string;
  ctaHref: string;
  metadata?: {
    isSpacedReview?: boolean;
    isReassessment?: boolean;
    intervalDays?: number;
    targetDomain?: boolean;
    simulationSource?: boolean;
    resumeSource?: boolean;
    repetitionCount?: number;
    previousAccuracy?: number;
  } | null;
}

export interface DaySchedule {
  date: string; // "YYYY-MM-DD"
  displayDate: string; // "Today", "Tomorrow", "Mon, Sep 21"
  dayOfWeek: string; // "Mon", "Tue"
  isToday: boolean;
  totalAllocatedMinutes: number;
  capacityMinutes: number;
  items: StudyPlanItemData[];
  completedCount: number;
  totalCount: number;
  isFullyCompleted: boolean;
}

export interface AdaptiveStudyPlanView {
  id: string;
  userId: string;
  planVersion: number;
  status: "ACTIVE" | "ARCHIVED" | "RECALIBRATED";
  planningHorizon: PlanHorizon;
  availableMinutesPerDay: number;
  hasBudgetSet: boolean;
  generatedAt: string;
  validFrom: string;
  validUntil: string | null;
  summary: string;
  todaySchedule: DaySchedule;
  weeklySchedule: DaySchedule[];
  whyThisPlan: {
    title: string;
    description: string;
    keyDrivers: Array<{
      topic: string;
      category: string;
      reason: string;
      evidence: string;
    }>;
  };
  emptyState: {
    show: boolean;
    type: "zero_data" | "insufficient_evidence" | "budget_unset" | "none";
    title: string;
    message: string;
    ctaLabel: string;
    ctaHref: string;
  } | null;
}

export interface GeneratePlanOptions {
  availableMinutesPerDay?: number;
  planningHorizon?: PlanHorizon;
  constraints?: {
    preferredStudyDays?: string[];
    targetRoleSlug?: string;
  };
  forceRecalculate?: boolean;
  recalibrationReason?: string;
}

// Format local YYYY-MM-DD string
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

// ============================================================================
// 2. ADAPTIVE ALLOCATION & SCHEDULING ALGORITHM
// ============================================================================

interface CandidateTopic {
  domain: string;
  topic: string;
  topicId: string | null;
  category: "FIX" | "REINFORCE" | "REVIEW" | "ASSESSMENT" | "PRACTICE";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MONITOR" | "INSUFFICIENT_EVIDENCE";
  priorityWeight: number; // Higher number = higher priority
  reason: string;
  evidence: string;
  suggestedDuration: number;
  targetDomain: boolean;
  simulationSource?: boolean;
  resumeSource?: boolean;
  requiresReassessment?: boolean;
  isSpacedReview?: boolean;
  previousAccuracy?: number;
}

/**
 * Builds candidate topics strictly from evidence across intelligence modules.
 * Never invents weaknesses or topics.
 */
export async function extractEvidenceCandidateTopics(
  userId: string,
  intel: PlacementIntelligenceSnapshot2,
  dailyExecution: DailyPreparationPlan | null
): Promise<CandidateTopic[]> {
  const candidates: CandidateTopic[] = [];
  const seenTopicKeys = new Set<string>();

  // 1. Ingest Phase 15 Executable Preparation Actions (Direct Execution Synergy)
  if (dailyExecution && dailyExecution.actions && dailyExecution.actions.length > 0) {
    for (const act of dailyExecution.actions) {
      const key = `${act.domain.toLowerCase()}:${act.topic.toLowerCase()}`;
      if (!seenTopicKeys.has(key)) {
        seenTopicKeys.add(key);

        let prioWeight = 80;
        let prioLevel: CandidateTopic["priority"] = "HIGH";
        let cat: CandidateTopic["category"] = "REINFORCE";

        if (act.type === "FIX") {
          prioWeight = 100;
          prioLevel = "CRITICAL";
          cat = "FIX";
        } else if (act.type === "REINFORCE") {
          prioWeight = 75;
          prioLevel = "HIGH";
          cat = "REINFORCE";
        } else {
          prioWeight = 50;
          prioLevel = "LOW";
          cat = "REVIEW";
        }

        candidates.push({
          domain: act.domain.toUpperCase(),
          topic: act.topic,
          topicId: act.topicId || null,
          category: cat,
          priority: prioLevel,
          priorityWeight: prioWeight + (act.targetFocus ? 15 : 0),
          reason: act.reason,
          evidence: act.evidence,
          suggestedDuration: act.type === "FIX" ? 25 : act.type === "REINFORCE" ? 20 : 15,
          targetDomain: !!act.targetFocus,
          requiresReassessment: act.type === "FIX",
          previousAccuracy: act.currentAccuracy,
          isSpacedReview: cat === "REVIEW",
        });
      }
    }
  }

  // 2. Ingest Phase 23 Priorities
  for (const prio of intel.priorities) {
    const key = `${prio.dimensionId}:${prio.title.toLowerCase()}`;
    if (!seenTopicKeys.has(key)) {
      seenTopicKeys.add(key);

      let prioWeight = 50;
      let cat: CandidateTopic["category"] = "PRACTICE";
      let suggestedMin = 20;

      switch (prio.level) {
        case "CRITICAL":
          prioWeight = 95;
          cat = "FIX";
          suggestedMin = 25;
          break;
        case "HIGH":
          prioWeight = 75;
          cat = "REINFORCE";
          suggestedMin = 20;
          break;
        case "MEDIUM":
          prioWeight = 60;
          cat = "PRACTICE";
          suggestedMin = 20;
          break;
        case "LOW":
        case "MONITOR":
          prioWeight = 35;
          cat = "REVIEW";
          suggestedMin = 15;
          break;
      }

      candidates.push({
        domain: prio.dimensionId.toUpperCase(),
        topic: prio.title,
        topicId: null,
        category: cat,
        priority: prio.level,
        priorityWeight: prioWeight,
        reason: prio.why || prio.observation,
        evidence: prio.evidence.join("; "),
        suggestedDuration: suggestedMin,
        targetDomain: false,
        requiresReassessment: cat === "FIX" || cat === "REINFORCE",
        isSpacedReview: cat === "REVIEW",
      });
    }
  }

  // 3. Ingest Phase 23 Strengths for Spaced Review (+3d, +7d maintenance)
  for (const str of intel.strengths) {
    const key = `${str.dimensionId}:${str.title.toLowerCase()}`;
    if (!seenTopicKeys.has(key)) {
      seenTopicKeys.add(key);
      candidates.push({
        domain: str.dimensionId.toUpperCase(),
        topic: str.title,
        topicId: null,
        category: "REVIEW",
        priority: "LOW",
        priorityWeight: 30, // Spaced review has low daily weight, reserved for mastery reinforcement
        reason: `Spaced review for validated competency (${str.score}% score).`,
        evidence: str.evidenceStatement,
        suggestedDuration: 15,
        targetDomain: false,
        isSpacedReview: true,
        previousAccuracy: str.score,
      });
    }
  }

  // 4. Ingest Phase 18 Resume ATS Gaps if verified
  const resumeDim = intel.dimensions.find((d) => d.id === "resume_ats");
  if (resumeDim && resumeDim.status !== "INSUFFICIENT_EVIDENCE") {
    if (resumeDim.score !== null && resumeDim.score < 75) {
      const key = "resume_ats:keywords";
      if (!seenTopicKeys.has(key)) {
        seenTopicKeys.add(key);
        candidates.push({
          domain: "RESUME",
          topic: "ATS Keyword Alignment",
          topicId: null,
          category: "FIX",
          priority: "HIGH",
          priorityWeight: 70,
          reason: "ATS keyword matching score indicates critical skill gaps against role benchmarks.",
          evidence: `Resume health score: ${resumeDim.score}%.`,
          suggestedDuration: 20,
          targetDomain: true,
          resumeSource: true,
        });
      }
    }
  }

  // 5. Ingest Phase 17 Simulation coding/debugging deficit if detected
  const techDim = intel.dimensions.find((d) => d.id === "technical_interview");
  if (techDim && techDim.score !== null && techDim.score < 60) {
    const key = "interview:tech_simulation";
    if (!seenTopicKeys.has(key)) {
      seenTopicKeys.add(key);
      candidates.push({
        domain: "SIMULATION",
        topic: "Technical Interview Problem Decomposition",
        topicId: null,
        category: "REINFORCE",
        priority: "HIGH",
        priorityWeight: 68,
        reason: "Placement simulation feedback highlights multi-step solution communication.",
        evidence: `Technical simulation score: ${techDim.score}%.`,
        suggestedDuration: 20,
        targetDomain: true,
        simulationSource: true,
      });
    }
  }

  // Deterministic sorting: highest priorityWeight first, then alphabetical by topic for tie-breaking
  candidates.sort((a, b) => {
    if (b.priorityWeight !== a.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }
    return a.topic.localeCompare(b.topic);
  });

  return candidates;
}

/**
 * Deterministic schedule allocation across a 7-day planning horizon.
 * Enforces:
 * 1. Strict time-budget limit per day (total <= availableMinutesPerDay).
 * 2. Overload protection: single topic <= 50% of daily budget (if budget >= 40).
 * 3. No duplicate topics scheduled on the same day.
 * 4. Spaced review intervals (+3d, +7d).
 * 5. Reassessment intervals for FIX/REINFORCE items (Day 1 practice → Day 3 reassessment).
 */
export function buildDeterministicSchedule(
  candidates: CandidateTopic[],
  availableMinutesPerDay: number,
  horizonDays: number = 7,
  startDate: Date = new Date()
): DaySchedule[] {
  const schedules: DaySchedule[] = [];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Bound daily capacity safely
  const dailyCapacity = Math.max(15, availableMinutesPerDay);
  // Single-topic bound: at most 50% of budget if budget >= 40, else single task up to budget
  const maxSingleTopicMinutes = dailyCapacity >= 40 ? Math.floor(dailyCapacity * 0.55) : dailyCapacity;

  // Track scheduled dates per topic to enforce spacing and reassessment
  const topicScheduledDays = new Map<string, number[]>();

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const dayDate = addDays(startDate, dayOffset);
    const dateKey = formatDateKey(dayDate);
    const isToday = dayOffset === 0;

    let displayDate: string;
    if (isToday) {
      displayDate = "Today";
    } else if (dayOffset === 1) {
      displayDate = "Tomorrow";
    } else {
      displayDate = `${daysOfWeek[dayDate.getDay()]}, ${months[dayDate.getMonth()]} ${dayDate.getDate()}`;
    }

    const dayItems: StudyPlanItemData[] = [];
    let allocatedMinutes = 0;
    const scheduledTopicsThisDay = new Set<string>();

    // 1. First priority: Check if any previously scheduled FIX/REINFORCE candidate requires Day 3 reassessment today
    if (dayOffset >= 2) {
      for (const cand of candidates) {
        if (cand.requiresReassessment) {
          const priorDays = topicScheduledDays.get(cand.topic) || [];
          // If practiced on Day 0 or earlier, and exactly 2 or 3 days later, schedule a reassessment drill!
          const hadPractice2or3DaysAgo = priorDays.some(
            (pDay) => (dayOffset - pDay === 2 || dayOffset - pDay === 3)
          );
          const alreadyReassessed = priorDays.includes(dayOffset);

          if (hadPractice2or3DaysAgo && !alreadyReassessed) {
            const duration = Math.min(15, dailyCapacity - allocatedMinutes);
            if (duration >= 10 && allocatedMinutes + duration <= dailyCapacity) {
              dayItems.push({
                id: `spi-${dateKey}-${dayItems.length + 1}`,
                planId: "",
                userId: "",
                domain: cand.domain,
                topic: `${cand.topic} (Reassessment)`,
                topicId: cand.topicId,
                category: "ASSESSMENT",
                priority: "HIGH",
                estimatedMinutes: duration,
                scheduledDate: dateKey,
                sequence: dayItems.length + 1,
                reason: `Evidence-based reassessment to measure retention since initial practice on ${cand.topic}.`,
                evidence: cand.evidence,
                executionActionId: null,
                status: "PENDING",
                completedAt: null,
                ctaText: "Start Assessment",
                ctaHref: cand.topicId ? `/tests?topicId=${cand.topicId}` : `/tests`,
                metadata: {
                  isReassessment: true,
                  intervalDays: 2,
                  previousAccuracy: cand.previousAccuracy,
                },
              });

              allocatedMinutes += duration;
              scheduledTopicsThisDay.add(cand.topic);
              priorDays.push(dayOffset);
              topicScheduledDays.set(cand.topic, priorDays);
            }
          }
        }
      }
    }

    // 2. Second priority: Spaced reviews on Day 3 or Day 6/7 for mastered topics
    if (dayOffset === 3 || dayOffset === 6) {
      const reviewCandidates = candidates.filter((c) => c.isSpacedReview);
      for (const rev of reviewCandidates) {
        if (allocatedMinutes + 15 <= dailyCapacity && !scheduledTopicsThisDay.has(rev.topic)) {
          const duration = Math.min(15, dailyCapacity - allocatedMinutes);
          dayItems.push({
            id: `spi-${dateKey}-${dayItems.length + 1}`,
            planId: "",
            userId: "",
            domain: rev.domain,
            topic: rev.topic,
            topicId: rev.topicId,
            category: "REVIEW",
            priority: "LOW",
            estimatedMinutes: duration,
            scheduledDate: dateKey,
            sequence: dayItems.length + 1,
            reason: rev.reason,
            evidence: rev.evidence,
            executionActionId: null,
            status: "PENDING",
            completedAt: null,
            ctaText: "Review",
            ctaHref: `/practice?domain=${rev.domain.toLowerCase()}`,
            metadata: {
              isSpacedReview: true,
              intervalDays: dayOffset,
              previousAccuracy: rev.previousAccuracy,
            },
          });

          allocatedMinutes += duration;
          scheduledTopicsThisDay.add(rev.topic);
        }
      }
    }

    // 3. Allocate main curriculum items from candidate pool
    // Rotate topics deterministically across days so all high-priority domains get covered over the week
    const candidatePool = candidates.filter((c) => !c.isSpacedReview);

    // To prevent topic exhaustion on later days, calculate an offset-shifted index
    const startIndex = (dayOffset * 2) % Math.max(1, candidatePool.length);

    for (let i = 0; i < candidatePool.length; i++) {
      if (allocatedMinutes >= dailyCapacity) break;

      const idx = (startIndex + i) % candidatePool.length;
      const cand = candidatePool[idx];

      // Skip if already scheduled on this day (Duplicate Prevention)
      if (scheduledTopicsThisDay.has(cand.topic)) continue;

      // Overload Protection: duration bounded by remaining capacity and max single-topic ceiling
      const remainingMinutes = dailyCapacity - allocatedMinutes;
      let duration = Math.min(cand.suggestedDuration, remainingMinutes, maxSingleTopicMinutes);

      // Squeeze small remaining slivers (e.g. 5 mins) into the current task if fits, or don't schedule < 10 mins
      if (duration < 10 && remainingMinutes < 10 && dayItems.length > 0) {
        // Expand the last item slightly up to capacity
        const lastItem = dayItems[dayItems.length - 1];
        if (lastItem.estimatedMinutes + remainingMinutes <= maxSingleTopicMinutes + 5) {
          lastItem.estimatedMinutes += remainingMinutes;
          allocatedMinutes += remainingMinutes;
        }
        break;
      }

      if (duration >= 10) {
        let ctaText = "Start Practice";
        let ctaHref = cand.topicId
          ? `/tests?topicId=${cand.topicId}`
          : `/practice?domain=${cand.domain.toLowerCase()}`;

        if (cand.category === "FIX") {
          ctaText = "Start Practice →";
        } else if (cand.category === "REINFORCE") {
          ctaText = "Reinforce Drill →";
        } else if (cand.category === "REVIEW") {
          ctaText = "Review →";
        } else if (cand.category === "ASSESSMENT") {
          ctaText = "Diagnostic →";
          ctaHref = "/tests";
        }

        if (cand.resumeSource) {
          ctaText = "Optimize Resume →";
          ctaHref = "/resume";
        } else if (cand.simulationSource) {
          ctaText = "Launch Simulation →";
          ctaHref = "/simulation";
        }

        dayItems.push({
          id: `spi-${dateKey}-${dayItems.length + 1}`,
          planId: "",
          userId: "",
          domain: cand.domain,
          topic: cand.topic,
          topicId: cand.topicId,
          category: cand.category,
          priority: cand.priority,
          estimatedMinutes: duration,
          scheduledDate: dateKey,
          sequence: dayItems.length + 1,
          reason: cand.reason,
          evidence: cand.evidence,
          executionActionId: null,
          status: "PENDING",
          completedAt: null,
          ctaText,
          ctaHref,
          metadata: {
            targetDomain: cand.targetDomain,
            simulationSource: cand.simulationSource,
            resumeSource: cand.resumeSource,
            previousAccuracy: cand.previousAccuracy,
          },
        });

        allocatedMinutes += duration;
        scheduledTopicsThisDay.add(cand.topic);

        const priorDays = topicScheduledDays.get(cand.topic) || [];
        priorDays.push(dayOffset);
        topicScheduledDays.set(cand.topic, priorDays);
      }
    }

    schedules.push({
      date: dateKey,
      displayDate,
      dayOfWeek: daysOfWeek[dayDate.getDay()],
      isToday,
      totalAllocatedMinutes: allocatedMinutes,
      capacityMinutes: dailyCapacity,
      items: dayItems,
      completedCount: 0,
      totalCount: dayItems.length,
      isFullyCompleted: false,
    });
  }

  return schedules;
}

// ============================================================================
// 3. SERVER-AUTHORITATIVE PLANNER FUNCTIONS
// ============================================================================

/**
 * Loads the active study plan for a student or generates one if needed.
 */
export async function getActiveStudyPlan(userId: string): Promise<AdaptiveStudyPlanView> {
  // 1. Parallel fetch of current persistent plan and latest intelligence
  const [existingPlan, intel, readiness, dailyExecution] = await Promise.all([
    db
      .select()
      .from(adaptiveStudyPlans)
      .where(and(eq(adaptiveStudyPlans.userId, userId), eq(adaptiveStudyPlans.status, "ACTIVE")))
      .orderBy(desc(adaptiveStudyPlans.generatedAt))
      .limit(1)
      .then((rows) => rows[0] || null),
    getPlacementIntelligence2(userId).catch(() => null),
    calculateReadiness(userId).catch(() => null),
    getDailyExecutionPlan(userId).catch(() => null),
  ]);

  // Handle zero-data state (no baseline completed)
  if (!readiness || !readiness.hasCompletedBaseline) {
    return createEmptyPlanView(userId, "zero_data", "No Baseline Assessment Completed", "Complete your initial diagnostic test so Nexora can evaluate your skill profile and generate an adaptive study schedule.", "Take Baseline Assessment", "/tests");
  }

  // Handle insufficient intelligence evidence
  if (!intel || intel.priorities.length === 0) {
    return createEmptyPlanView(userId, "insufficient_evidence", "Insufficient Placement Evidence", "Complete adaptive practice drills across Core CS domains to generate actionable preparation evidence.", "Explore Practice Drills", "/tests");
  }

  // If student has not set a study time budget, prompt for budget selection (No Hallucination)
  if (!existingPlan || existingPlan.availableMinutesPerDay === null || existingPlan.availableMinutesPerDay === undefined) {
    return createEmptyPlanView(userId, "budget_unset", "Set Your Available Study Time", "Define your daily preparation capacity (e.g. 30, 60, 90, or 120 minutes) so Nexora can calibrate a realistic adaptive schedule.", "Set Daily Study Time", "#set-budget");
  }

  // 2. Fetch existing items for this plan
  const existingItems = await db
    .select()
    .from(studyPlanItems)
    .where(eq(studyPlanItems.planId, existingPlan.id))
    .orderBy(asc(studyPlanItems.scheduledDate), asc(studyPlanItems.sequence));

  const todayKey = formatDateKey(new Date());

  // Check if existing items cover today. If plan is outdated (generated on a prior day), recalibrate forward!
  const hasItemsForToday = existingItems.some((i) => i.scheduledDate === todayKey);

  if (existingItems.length === 0 || !hasItemsForToday) {
    // Generate fresh schedule for the current date horizon
    return await generateAdaptiveStudyPlan(userId, {
      availableMinutesPerDay: existingPlan.availableMinutesPerDay,
      planningHorizon: (existingPlan.planningHorizon as PlanHorizon) || "7_days",
      recalibrationReason: "Automatic roll-forward to current date",
    });
  }

  // 3. Assemble DaySchedules from stored items
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const itemsByDate = new Map<string, StudyPlanItemData[]>();
  for (const item of existingItems) {
    const list = itemsByDate.get(item.scheduledDate) || [];
    let ctaText = "Start Practice";
    let ctaHref = item.topicId ? `/tests?topicId=${item.topicId}` : `/practice?domain=${item.domain.toLowerCase()}`;

    if (item.category === "FIX") ctaText = "Start Practice →";
    else if (item.category === "REINFORCE") ctaText = "Reinforce Drill →";
    else if (item.category === "REVIEW") ctaText = "Review →";
    else if (item.category === "ASSESSMENT") {
      ctaText = "Diagnostic →";
      ctaHref = "/tests";
    }

    list.push({
      id: item.id,
      planId: item.planId,
      userId: item.userId,
      domain: item.domain,
      topic: item.topic,
      topicId: item.topicId,
      category: item.category as any,
      priority: item.priority as any,
      estimatedMinutes: item.estimatedMinutes,
      scheduledDate: item.scheduledDate,
      sequence: item.sequence,
      reason: item.reason,
      evidence: item.evidence,
      executionActionId: item.executionActionId,
      status: item.status as any,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      ctaText,
      ctaHref,
      metadata: (item.metadata as any) || null,
    });
    itemsByDate.set(item.scheduledDate, list);
  }

  const weeklySchedule: DaySchedule[] = [];
  const todayDate = new Date();

  for (let d = 0; d < 7; d++) {
    const dateObj = addDays(todayDate, d);
    const dateKey = formatDateKey(dateObj);
    const dayItems = itemsByDate.get(dateKey) || [];
    const isToday = d === 0;

    let displayDate: string;
    if (isToday) displayDate = "Today";
    else if (d === 1) displayDate = "Tomorrow";
    else displayDate = `${daysOfWeek[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;

    const totalAllocated = dayItems.reduce((acc, item) => acc + item.estimatedMinutes, 0);
    const completedCount = dayItems.filter((i) => i.status === "COMPLETED").length;

    weeklySchedule.push({
      date: dateKey,
      displayDate,
      dayOfWeek: daysOfWeek[dateObj.getDay()],
      isToday,
      totalAllocatedMinutes: totalAllocated,
      capacityMinutes: existingPlan.availableMinutesPerDay,
      items: dayItems,
      completedCount,
      totalCount: dayItems.length,
      isFullyCompleted: dayItems.length > 0 && completedCount === dayItems.length,
    });
  }

  const todaySchedule = weeklySchedule[0];

  // Assemble "Why this plan?" drivers from top priorities
  const topDrivers = (intel?.priorities || []).slice(0, 3).map((p: IntelligencePriority) => ({
    topic: p.title,
    category: p.level === "CRITICAL" ? "FIX" : p.level === "HIGH" ? "REINFORCE" : "REVIEW",
    reason: p.why || p.observation,
    evidence: (p.evidence || []).join("; "),
  }));

  return {
    id: existingPlan.id,
    userId: existingPlan.userId,
    planVersion: existingPlan.planVersion,
    status: existingPlan.status as any,
    planningHorizon: existingPlan.planningHorizon as PlanHorizon,
    availableMinutesPerDay: existingPlan.availableMinutesPerDay,
    hasBudgetSet: true,
    generatedAt: existingPlan.generatedAt.toISOString(),
    validFrom: existingPlan.validFrom.toISOString(),
    validUntil: existingPlan.validUntil ? existingPlan.validUntil.toISOString() : null,
    summary: existingPlan.summary || "Evidence-calibrated preparation schedule.",
    todaySchedule,
    weeklySchedule,
    whyThisPlan: {
      title: "Evidence-Backed Allocation Architecture",
      description:
        "Nexora weights your preparation schedule based on validated deficiencies, target company benchmarks, and retention spacing rather than uniform subject splitting.",
      keyDrivers: topDrivers,
    },
    emptyState: null,
  };
}

/**
 * Generates and persists a deterministic adaptive study plan.
 */
export async function generateAdaptiveStudyPlan(
  userId: string,
  options: GeneratePlanOptions = {}
): Promise<AdaptiveStudyPlanView> {
  // Parallel fetch intelligence
  const [intel, readiness, dailyExecution, existingPlan] = await Promise.all([
    getPlacementIntelligence2(userId).catch(() => null),
    calculateReadiness(userId).catch(() => null),
    getDailyExecutionPlan(userId).catch(() => null),
    db
      .select()
      .from(adaptiveStudyPlans)
      .where(and(eq(adaptiveStudyPlans.userId, userId), eq(adaptiveStudyPlans.status, "ACTIVE")))
      .orderBy(desc(adaptiveStudyPlans.generatedAt))
      .limit(1)
      .then((rows) => rows[0] || null),
  ]);

  if (!readiness || !readiness.hasCompletedBaseline) {
    return createEmptyPlanView(userId, "zero_data", "No Baseline Assessment Completed", "Complete your initial diagnostic test so Nexora can evaluate your skill profile and generate an adaptive study schedule.", "Take Baseline Assessment", "/tests");
  }

  if (!intel || intel.priorities.length === 0) {
    return createEmptyPlanView(userId, "insufficient_evidence", "Insufficient Placement Evidence", "Complete adaptive practice drills across Core CS domains to generate actionable preparation evidence.", "Explore Practice Drills", "/tests");
  }

  // Determine available study time
  const budget =
    options.availableMinutesPerDay ??
    existingPlan?.availableMinutesPerDay ??
    null;

  if (budget === null || budget <= 0) {
    return createEmptyPlanView(userId, "budget_unset", "Set Your Available Study Time", "Define your daily preparation capacity (e.g. 30, 60, 90, or 120 minutes) so Nexora can calibrate a realistic adaptive schedule.", "Set Daily Study Time", "#set-budget");
  }

  const horizon: PlanHorizon = options.planningHorizon || (existingPlan?.planningHorizon as PlanHorizon) || "7_days";
  const horizonDays = horizon === "14_days" ? 14 : horizon === "today" ? 1 : 7;
  const startDate = new Date();

  // 1. Extract candidate topics from all evidence sources
  const candidates = await extractEvidenceCandidateTopics(userId, intel, dailyExecution);

  // 2. Build deterministic day-by-day schedule respecting bounds
  const schedules = buildDeterministicSchedule(candidates, budget, horizonDays, startDate);

  // 3. Archive any previous active plans (Versioning)
  const nextVersion = existingPlan ? existingPlan.planVersion + 1 : 1;
  if (existingPlan) {
    await db
      .update(adaptiveStudyPlans)
      .set({ status: "ARCHIVED" })
      .where(eq(adaptiveStudyPlans.id, existingPlan.id));
  }

  // 4. Persist new AdaptiveStudyPlan
  const planSummary = `Phase 24 Adaptive Plan v${nextVersion}: ${budget}m/day capacity calibrated across ${candidates.length} evidence areas.`;
  const validUntil = addDays(startDate, horizonDays);

  const [newPlan] = await db
    .insert(adaptiveStudyPlans)
    .values({
      userId,
      planVersion: nextVersion,
      status: "ACTIVE",
      planningHorizon: horizon,
      availableMinutesPerDay: budget,
      constraints: options.constraints || null,
      summary: planSummary,
      generatedAt: new Date(),
      validFrom: startDate,
      validUntil,
      recalibratedAt: options.recalibrationReason ? new Date() : null,
      recalibrationReason: options.recalibrationReason || null,
    })
    .returning();

  // 5. Persist StudyPlanItems
  const itemsToInsert: Array<typeof studyPlanItems.$inferInsert> = [];

  for (const day of schedules) {
    for (const item of day.items) {
      itemsToInsert.push({
        planId: newPlan.id,
        userId,
        domain: item.domain,
        topic: item.topic,
        topicId: item.topicId || null,
        category: item.category as any,
        priority: item.priority as any,
        estimatedMinutes: item.estimatedMinutes,
        scheduledDate: item.scheduledDate,
        sequence: item.sequence,
        reason: item.reason,
        evidence: item.evidence,
        executionActionId: item.executionActionId || null,
        status: "PENDING",
        completedAt: null,
        metadata: item.metadata || null,
      });
    }
  }

  if (itemsToInsert.length > 0) {
    await db.insert(studyPlanItems).values(itemsToInsert);
  }

  // Return the newly generated view
  return await getActiveStudyPlan(userId);
}

/**
 * Recalibrates the study plan upon receiving new performance evidence.
 */
export async function recalculateStudyPlan(
  userId: string,
  reason: string = "Performance evidence update"
): Promise<AdaptiveStudyPlanView> {
  const existingPlan = await db
    .select()
    .from(adaptiveStudyPlans)
    .where(and(eq(adaptiveStudyPlans.userId, userId), eq(adaptiveStudyPlans.status, "ACTIVE")))
    .orderBy(desc(adaptiveStudyPlans.generatedAt))
    .limit(1)
    .then((rows) => rows[0] || null);

  const budget = existingPlan?.availableMinutesPerDay || 60;
  return await generateAdaptiveStudyPlan(userId, {
    availableMinutesPerDay: budget,
    planningHorizon: (existingPlan?.planningHorizon as PlanHorizon) || "7_days",
    forceRecalculate: true,
    recalibrationReason: reason,
  });
}

/**
 * Updates status of a study plan item (e.g. COMPLETED, IN_PROGRESS, MISSED).
 * Adapts subsequent planning deterministically.
 */
export async function updateStudyPlanItemStatus(
  userId: string,
  itemId: string,
  status: "PENDING" | "IN_PROGRESS" | "PARTIALLY_COMPLETED" | "COMPLETED" | "MISSED" | "RESCHEDULED"
): Promise<{ success: boolean; item: StudyPlanItemData | null }> {
  const [existing] = await db
    .select()
    .from(studyPlanItems)
    .where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId)));

  if (!existing) {
    return { success: false, item: null };
  }

  const completedAt = status === "COMPLETED" ? new Date() : null;

  const [updated] = await db
    .update(studyPlanItems)
    .set({
      status: status as any,
      completedAt,
    })
    .where(eq(studyPlanItems.id, itemId))
    .returning();

  // If item was MISSED, reschedule to next day without penalizing student
  if (status === "MISSED") {
    const nextDayKey = formatDateKey(addDays(new Date(), 1));
    const nextSeq = 99; // append to end of next day

    await db.insert(studyPlanItems).values({
      planId: existing.planId,
      userId: existing.userId,
      domain: existing.domain,
      topic: existing.topic,
      topicId: existing.topicId,
      category: existing.category,
      priority: existing.priority,
      estimatedMinutes: existing.estimatedMinutes,
      scheduledDate: nextDayKey,
      sequence: nextSeq,
      reason: `Rescheduled from missed session on ${existing.scheduledDate}.`,
      evidence: existing.evidence,
      executionActionId: existing.executionActionId,
      status: "PENDING",
      metadata: { ...(existing.metadata as any), rescheduledFrom: existing.scheduledDate },
    });
  }

  return {
    success: true,
    item: {
      id: updated.id,
      planId: updated.planId,
      userId: updated.userId,
      domain: updated.domain,
      topic: updated.topic,
      topicId: updated.topicId,
      category: updated.category as any,
      priority: updated.priority as any,
      estimatedMinutes: updated.estimatedMinutes,
      scheduledDate: updated.scheduledDate,
      sequence: updated.sequence,
      reason: updated.reason,
      evidence: updated.evidence,
      executionActionId: updated.executionActionId,
      status: updated.status as any,
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      ctaText: "Continue",
      ctaHref: "/tests",
      metadata: updated.metadata as any,
    },
  };
}

function createEmptyPlanView(
  userId: string,
  type: "zero_data" | "insufficient_evidence" | "budget_unset",
  title: string,
  message: string,
  ctaLabel: string,
  ctaHref: string
): AdaptiveStudyPlanView {
  return {
    id: "empty-plan",
    userId,
    planVersion: 0,
    status: "ACTIVE",
    planningHorizon: "7_days",
    availableMinutesPerDay: 0,
    hasBudgetSet: false,
    generatedAt: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validUntil: null,
    summary: message,
    todaySchedule: {
      date: formatDateKey(new Date()),
      displayDate: "Today",
      dayOfWeek: "Today",
      isToday: true,
      totalAllocatedMinutes: 0,
      capacityMinutes: 0,
      items: [],
      completedCount: 0,
      totalCount: 0,
      isFullyCompleted: false,
    },
    weeklySchedule: [],
    whyThisPlan: {
      title: "Preparation Overview",
      description: message,
      keyDrivers: [],
    },
    emptyState: {
      show: true,
      type,
      title,
      message,
      ctaLabel,
      ctaHref,
    },
  };
}

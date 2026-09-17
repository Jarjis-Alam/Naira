"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PreviewDraft, PreviewQuestion } from "@/components/admin/admin-test-preview";

export interface RepositoryQuestion {
  id: string;
  question: string;
  questionType: "single_choice" | "multiple_choice";
  options: string[] | unknown;
  difficulty: string;
  marks: number;
  expectedTime: number | null;
  subjectName: string;
  subjectCode: string;
  topicName: string;
}

export interface BuilderQuestionItem {
  id: string;
  question: RepositoryQuestion;
  marks: number;
}

export interface BuilderPool {
  id: string;
  title: string;
  description: string;
  selectionCount: number;
  poolOrder: number;
  questions: BuilderQuestionItem[];
}

export interface BuilderSection {
  id: string;
  title: string;
  description: string;
  sectionOrder: number;
  questions: BuilderQuestionItem[];
  pools: BuilderPool[];
}

const BUILDER_STEPS = [
  { id: "basics", label: "01 Basics", icon: "badge" },
  { id: "rules", label: "02 Rules", icon: "tune" },
  { id: "instructions", label: "03 Instructions", icon: "description" },
  { id: "sections", label: "04 Sections", icon: "layers" },
  { id: "questions", label: "05 Questions", icon: "format_list_numbered" },
  { id: "pools", label: "06 Pools", icon: "widgets" },
  { id: "schedule", label: "07 Schedule", icon: "schedule" },
  { id: "review", label: "08 Review", icon: "checklist" },
] as const;

type StepId = (typeof BUILDER_STEPS)[number]["id"];

export function TestBuilder({
  repositoryQuestions,
}: {
  repositoryQuestions: RepositoryQuestion[];
}) {
  const router = useRouter();

  // Active Wizard Step (non-blocking: can jump to any step anytime)
  const [currentStep, setCurrentStep] = useState<StepId>("basics");

  // Step 1: Basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [testType, setTestType] = useState<
    "aptitude" | "cs_fundamentals" | "mixed" | "baseline"
  >("mixed");

  // Step 2: Rules
  const [duration, setDuration] = useState(60);
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState(false);
  const [negativeMarkRate, setNegativeMarkRate] = useState(0.25);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [attemptLimit, setAttemptLimit] = useState<string>(""); // empty = unlimited

  // Step 3: Instructions
  const [instructions, setInstructions] = useState<string>(""); // max 5000 chars

  // Step 4: Sections
  const [sections, setSections] = useState<BuilderSection[]>([
    {
      id: "sec-init-1",
      title: "Core Questions",
      description: "",
      sectionOrder: 1,
      questions: [],
      pools: [],
    },
  ]);
  const [activeSectionId, setActiveSectionId] = useState<string>("sec-init-1");
  const [activePoolId, setActivePoolId] = useState<string | null>(null);

  // Step 5: Questions Search / Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedType, setSelectedType] = useState("");

  // Step 7: Schedule
  const [lifecycleStatus, setLifecycleStatus] = useState<"draft" | "published">("published");
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledStartAt, setScheduledStartAt] = useState<string>("");
  const [scheduledEndAt, setScheduledEndAt] = useState<string>("");
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
      : "Asia/Kolkata"
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  // Computed: set of all selected question IDs across all sections and pools
  const allSelectedQuestionIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of sections) {
      for (const q of s.questions) set.add(q.id);
      for (const p of s.pools || []) {
        for (const pq of p.questions) set.add(pq.id);
      }
    }
    return set;
  }, [sections]);

  // Computed totals
  const totalQuestions = useMemo(() => {
    return sections.reduce(
      (sum, s) =>
        sum +
        s.questions.length +
        (s.pools || []).reduce((pSum, p) => pSum + p.selectionCount, 0),
      0
    );
  }, [sections]);

  const totalMarks = useMemo(() => {
    return sections.reduce((sum, s) => {
      const fixedMarks = s.questions.reduce((qSum, q) => qSum + q.marks, 0);
      const poolMarks = (s.pools || []).reduce((pSum, p) => {
        const qMark = p.questions[0]?.marks || 0;
        return pSum + p.selectionCount * qMark;
      }, 0);
      return sum + fixedMarks + poolMarks;
    }, 0);
  }, [sections]);

  // Available subjects from repository questions
  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of repositoryQuestions) {
      map.set(q.subjectName, q.subjectCode);
    }
    return Array.from(map.entries()).map(([name, code]) => ({ name, code }));
  }, [repositoryQuestions]);

  // Filtered repository questions
  const filteredRepository = useMemo(() => {
    return repositoryQuestions.filter((q) => {
      const matchesSearch =
        !searchQuery ||
        q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.topicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject = !selectedSubject || q.subjectName === selectedSubject;
      const matchesDifficulty = !selectedDifficulty || q.difficulty === selectedDifficulty;
      const matchesType = !selectedType || q.questionType === selectedType;

      return matchesSearch && matchesSubject && matchesDifficulty && matchesType;
    });
  }, [repositoryQuestions, searchQuery, selectedSubject, selectedDifficulty, selectedType]);

  // Section Handlers
  const addSection = () => {
    const nextOrder = sections.length + 1;
    const newSec: BuilderSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `Section ${nextOrder}`,
      description: "",
      sectionOrder: nextOrder,
      questions: [],
      pools: [],
    };
    setSections([...sections, newSec]);
    setActiveSectionId(newSec.id);
    setActivePoolId(null);
  };

  const removeSection = (secId: string) => {
    if (sections.length <= 1) {
      setErrorMsg("Assessment must contain at least one section.");
      return;
    }
    const updated = sections
      .filter((s) => s.id !== secId)
      .map((s, idx) => ({ ...s, sectionOrder: idx + 1 }));
    setSections(updated);
    if (activeSectionId === secId) {
      setActiveSectionId(updated[0]?.id || "");
      setActivePoolId(null);
    }
  };

  const updateSectionTitle = (secId: string, newTitle: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, title: newTitle } : s))
    );
  };

  const updateSectionDescription = (secId: string, newDesc: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, description: newDesc } : s))
    );
  };

  const moveSectionUp = (secIdx: number) => {
    if (secIdx <= 0) return;
    const next = [...sections];
    const temp = next[secIdx];
    next[secIdx] = next[secIdx - 1];
    next[secIdx - 1] = temp;
    setSections(next.map((s, idx) => ({ ...s, sectionOrder: idx + 1 })));
  };

  const moveSectionDown = (secIdx: number) => {
    if (secIdx >= sections.length - 1) return;
    const next = [...sections];
    const temp = next[secIdx];
    next[secIdx] = next[secIdx + 1];
    next[secIdx + 1] = temp;
    setSections(next.map((s, idx) => ({ ...s, sectionOrder: idx + 1 })));
  };

  // Pool Handlers
  const addPoolToSection = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const nextPoolOrder = (sec.pools || []).length + 1;
    const newPool: BuilderPool = {
      id: `pool-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `Question Pool ${nextPoolOrder}`,
      description: "",
      selectionCount: 1,
      poolOrder: nextPoolOrder,
      questions: [],
    };

    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, pools: [...(s.pools || []), newPool] } : s
      )
    );
    setActivePoolId(newPool.id);
  };

  const updatePoolTitle = (sectionId: string, poolId: string, newTitle: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              pools: (s.pools || []).map((p) =>
                p.id === poolId ? { ...p, title: newTitle } : p
              ),
            }
          : s
      )
    );
  };

  const updatePoolSelectionCount = (
    sectionId: string,
    poolId: string,
    count: number
  ) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              pools: (s.pools || []).map((p) =>
                p.id === poolId ? { ...p, selectionCount: Math.max(1, count) } : p
              ),
            }
          : s
      )
    );
  };

  const removePoolFromSection = (sectionId: string, poolId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              pools: (s.pools || [])
                .filter((p) => p.id !== poolId)
                .map((p, idx) => ({ ...p, poolOrder: idx + 1 })),
            }
          : s
      )
    );
    if (activePoolId === poolId) {
      setActivePoolId(null);
    }
  };

  const removeQuestionFromPool = (
    sectionId: string,
    poolId: string,
    questionId: string
  ) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              pools: (s.pools || []).map((p) =>
                p.id === poolId
                  ? {
                      ...p,
                      questions: p.questions.filter((q) => q.id !== questionId),
                    }
                  : p
              ),
            }
          : s
      )
    );
  };

  // Question Assignment
  const addQuestionToTarget = (q: RepositoryQuestion) => {
    if (allSelectedQuestionIds.has(q.id)) return;
    const secId = activeSectionId || sections[0]?.id;
    if (!secId) return;

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;

        if (activePoolId) {
          const targetPool = (sec.pools || []).find((p) => p.id === activePoolId);
          if (targetPool) {
            const uniformMarks =
              targetPool.questions.length > 0
                ? targetPool.questions[0].marks
                : q.marks;
            return {
              ...sec,
              pools: (sec.pools || []).map((p) =>
                p.id === activePoolId
                  ? {
                      ...p,
                      questions: [
                        ...p.questions,
                        { id: q.id, question: q, marks: uniformMarks },
                      ],
                    }
                  : p
              ),
            };
          }
        }

        return {
          ...sec,
          questions: [
            ...sec.questions,
            { id: q.id, question: q, marks: q.marks },
          ],
        };
      })
    );
    setErrorMsg(null);
  };

  const removeQuestionFromSection = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            questions: sec.questions.filter((q) => q.id !== questionId),
          };
        }
        return sec;
      })
    );
  };

  const moveQuestionUpInSection = (sectionId: string, qIdx: number) => {
    if (qIdx <= 0) return;
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const nextQ = [...sec.questions];
        const temp = nextQ[qIdx];
        nextQ[qIdx] = nextQ[qIdx - 1];
        nextQ[qIdx - 1] = temp;
        return { ...sec, questions: nextQ };
      })
    );
  };

  const moveQuestionDownInSection = (sectionId: string, qIdx: number) => {
    if (qIdx >= sections.find((s) => s.id === sectionId)!.questions.length - 1) return;
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const nextQ = [...sec.questions];
        const temp = nextQ[qIdx];
        nextQ[qIdx] = nextQ[qIdx + 1];
        nextQ[qIdx + 1] = temp;
        return { ...sec, questions: nextQ };
      })
    );
  };

  const moveQuestionToSection = (
    fromSectionId: string,
    toSectionId: string,
    questionId: string
  ) => {
    if (fromSectionId === toSectionId) return;
    setSections((prev) => {
      const fromSection = prev.find((s) => s.id === fromSectionId);
      const questionItem = fromSection?.questions.find((q) => q.id === questionId);
      if (!questionItem) return prev;

      return prev.map((sec) => {
        if (sec.id === fromSectionId) {
          return {
            ...sec,
            questions: sec.questions.filter((q) => q.id !== questionId),
          };
        }
        if (sec.id === toSectionId) {
          return {
            ...sec,
            questions: [...sec.questions, questionItem],
          };
        }
        return sec;
      });
    });
  };

  const updateQuestionMarks = (
    sectionId: string,
    questionId: string,
    newMarks: number
  ) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          questions: sec.questions.map((q) =>
            q.id === questionId ? { ...q, marks: Math.max(1, newMarks) } : q
          ),
        };
      })
    );
  };

  // Preview Handler
  const handlePreview = () => {
    const flatQuestions: PreviewQuestion[] = sections.flatMap((sec, secIdx) => {
      const fixed: PreviewQuestion[] = sec.questions.map(({ question, marks }) => ({
        ...question,
        marks,
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        sectionId: sec.id,
        sectionTitle: sec.title.trim() || `Section ${secIdx + 1}`,
        sectionOrder: secIdx + 1,
      }));

      const pooled: PreviewQuestion[] = (sec.pools || []).flatMap((pool) => {
        const shuffled = [...pool.questions].sort(() => Math.random() - 0.5);
        const sampled = shuffled.slice(0, pool.selectionCount);
        return sampled.map(({ question, marks }) => ({
          ...question,
          marks,
          options: Array.isArray(question.options) ? question.options.map(String) : [],
          sectionId: sec.id,
          sectionTitle: sec.title.trim() || `Section ${secIdx + 1}`,
          sectionOrder: secIdx + 1,
        }));
      });

      return [...fixed, ...pooled];
    });

    const previewDraft: PreviewDraft = {
      title: title.trim() || "Untitled Placement Assessment",
      description,
      duration: Number(duration),
      testType,
      negativeMarkingEnabled,
      negativeMarkRate: negativeMarkingEnabled ? negativeMarkRate : 0,
      randomizeQuestions,
      randomizeOptions,
      instructions: instructions.trim() === "" ? null : instructions.trim(),
      sections: sections.map((s, idx) => ({
        id: s.id,
        title: s.title.trim() || `Section ${idx + 1}`,
        description: s.description || undefined,
        sectionOrder: idx + 1,
      })),
      questions: flatQuestions,
    };
    sessionStorage.setItem("nexora-admin-test-preview", JSON.stringify(previewDraft));
    router.push("/admin/tests/preview");
  };

  // Validation before publish
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!title.trim()) {
      warnings.push("Test title is required.");
    }
    if (totalQuestions === 0) {
      warnings.push("At least one question or question pool must be added.");
    }
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const s = sections[sIdx];
      if (!s.title.trim()) {
        warnings.push(`Section ${sIdx + 1} requires a valid name.`);
      }
      for (const p of s.pools || []) {
        if (!p.title.trim()) {
          warnings.push(`A pool in section "${s.title}" has an empty title.`);
        }
        if (p.selectionCount > p.questions.length) {
          warnings.push(
            `Pool "${p.title}" requires ${p.selectionCount} questions but only ${p.questions.length} are added.`
          );
        }
      }
    }
    if (isScheduled && scheduledStartAt && scheduledEndAt) {
      if (new Date(scheduledEndAt).getTime() <= new Date(scheduledStartAt).getTime()) {
        warnings.push("Scheduled end time must be after start time.");
      }
    }
    return warnings;
  }, [title, totalQuestions, sections, isScheduled, scheduledStartAt, scheduledEndAt]);

  const canPublish = validationWarnings.length === 0;

  // Submit test to backend
  const handleCreateTest = async () => {
    setErrorMsg(null);

    if (validationWarnings.length > 0) {
      setErrorMsg(validationWarnings[0]);
      setCurrentStep("review");
      return;
    }

    setLoading(true);

    const parsedAttemptLimit =
      attemptLimit.trim() === "" ? null : parseInt(attemptLimit.trim(), 10);
    const parsedInstructions =
      instructions.trim() === "" ? null : instructions.trim().slice(0, 5000);

    try {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          duration: Number(duration),
          type: testType,
          totalMarks,
          negativeMarkingEnabled,
          negativeMarkRate: negativeMarkingEnabled ? negativeMarkRate : 0,
          randomizeQuestions,
          randomizeOptions,
          attemptLimit: parsedAttemptLimit,
          instructions: parsedInstructions,
          status: lifecycleStatus,
          scheduledStartAt:
            isScheduled && scheduledStartAt
              ? new Date(scheduledStartAt).toISOString()
              : null,
          scheduledEndAt:
            isScheduled && scheduledEndAt
              ? new Date(scheduledEndAt).toISOString()
              : null,
          scheduleTimezone: isScheduled ? scheduleTimezone : null,
          isPublished: lifecycleStatus === "published",
          sections: sections.map((s, sIdx) => ({
            title: s.title.trim(),
            description: s.description?.trim() || undefined,
            sectionOrder: sIdx + 1,
            questions: s.questions.map((q, qIdx) => ({
              questionId: q.id,
              questionOrder: qIdx + 1,
            })),
            pools: (s.pools || []).map((p, pIdx) => ({
              title: p.title.trim(),
              description: p.description?.trim() || undefined,
              selectionCount: p.selectionCount,
              poolOrder: pIdx + 1,
              questions: p.questions.map((pq, pqIdx) => ({
                questionId: pq.id,
                questionOrder: pqIdx + 1,
              })),
            })),
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to create test.");
      }

      router.push("/admin/tests");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to create test.");
      setShowPublishConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const activeSection =
    sections.find((s) => s.id === activeSectionId) || sections[0];

  // Navigation helpers
  const currentStepIndex = BUILDER_STEPS.findIndex((s) => s.id === currentStep);
  const goToNextStep = () => {
    if (currentStepIndex < BUILDER_STEPS.length - 1) {
      setCurrentStep(BUILDER_STEPS[currentStepIndex + 1].id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(BUILDER_STEPS[currentStepIndex - 1].id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* 1. PERSISTENT TEST CONFIGURATION SUMMARY BAR */}
      <div className="sticky top-0 z-20 rounded-xl border border-border bg-surface/95 backdrop-blur-md p-4 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase text-text-muted font-bold tracking-wider block">
                Test Summary
              </span>
              <h2 className="text-body-sm font-bold text-text-primary truncate">
                {title.trim() || "Untitled Placement Assessment"}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-x-4 gap-y-2 text-label-xs font-mono">
            <div>
              <span className="text-text-muted block text-[10px] uppercase">Questions</span>
              <span className="font-bold text-text-primary">{totalQuestions} questions</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase">Sections</span>
              <span className="font-bold text-text-primary">{sections.length} sections</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase">Duration</span>
              <span className="font-bold text-text-primary">{duration} mins</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase">Marks</span>
              <span className="font-bold text-primary-text">{totalMarks} total</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-text-muted block text-[10px] uppercase">Rules</span>
              <span className="text-text-secondary">
                {negativeMarkingEnabled ? `-${(negativeMarkRate * 100).toFixed(0)}% Neg` : "No Neg"} ·{" "}
                {randomizeQuestions || randomizeOptions ? "Shuffled" : "Sequential"}
              </span>
            </div>
            <div className="hidden lg:block">
              <span className="text-text-muted block text-[10px] uppercase">Status</span>
              <span
                className={`font-bold uppercase ${
                  lifecycleStatus === "published" ? "text-secondary" : "text-tertiary"
                }`}
              >
                {lifecycleStatus}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-builder-preview-draft"
              onClick={handlePreview}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-high px-3 text-label-xs font-mono text-text-primary hover:border-primary hover:text-primary-text transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>Preview</span>
            </button>

            <button
              type="button"
              id="btn-builder-finish-review"
              onClick={() => {
                setCurrentStep("review");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-label-xs font-mono font-bold text-text-inverse hover:bg-primary-text transition-colors shadow-sm"
            >
              <span>Review & Deploy</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BUILDER PROGRESS INDICATOR */}
      <div className="rounded-xl border border-border bg-surface p-2 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {BUILDER_STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isCompleted = idx < currentStepIndex;

            return (
              <button
                key={step.id}
                type="button"
                id={`btn-step-${step.id}`}
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-label-xs font-mono whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-text-inverse font-bold shadow-sm"
                    : isCompleted
                    ? "bg-surface-high text-text-primary hover:bg-surface-highest"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-high/60"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {step.icon}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-error/40 bg-error/10 text-error flex items-center justify-between gap-3 text-body-sm font-medium">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-text-muted hover:text-text-primary">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* 3. STEP CONTENT */}

      {/* STEP 1: BASICS */}
      {currentStep === "basics" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="border-b border-border/70 pb-4">
            <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
              Step 01
            </span>
            <h3 className="text-headline-sm font-bold text-text-primary mt-1">
              Basic Assessment Information
            </h3>
            <p className="text-body-sm text-text-secondary mt-1">
              Specify the title, curriculum classification, and candidate-facing context.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="test-title-input"
                className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
              >
                Test Title *
              </label>
              <input
                id="test-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SDE Technical Screen — Core Algorithms & Systems"
                className="w-full rounded-lg border border-border bg-base px-4 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label
                htmlFor="test-type-select"
                className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
              >
                Curriculum Track *
              </label>
              <select
                id="test-type-select"
                value={testType}
                onChange={(e) => setTestType(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-base px-4 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="mixed">Mixed Placement Track</option>
                <option value="cs_fundamentals">CS Fundamentals</option>
                <option value="aptitude">Aptitude Track</option>
                <option value="baseline">Baseline Assessment</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="test-description-textarea"
                className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
              >
                Description / Context
              </label>
              <textarea
                id="test-description-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe target roles, expected knowledge, and evaluation criteria..."
                className="w-full rounded-lg border border-border bg-base p-4 text-body-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: RULES */}
      {currentStep === "rules" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="border-b border-border/70 pb-4">
            <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
              Step 02
            </span>
            <h3 className="text-headline-sm font-bold text-text-primary mt-1">
              Configuration & Evaluation Rules
            </h3>
            <p className="text-body-sm text-text-secondary mt-1">
              Configure exam duration, attempt limits, negative marking penalty, and randomization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duration */}
            <div>
              <label
                htmlFor="test-duration-input"
                className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
              >
                Duration (Minutes) *
              </label>
              <input
                id="test-duration-input"
                type="number"
                min={5}
                max={300}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-base px-4 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono"
              />
              <p className="text-[11px] font-mono text-text-muted mt-1.5">
                The continuous countdown timer visible during the exam.
              </p>
            </div>

            {/* Attempt Limit */}
            <div>
              <label
                htmlFor="test-attempt-limit-input"
                className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
              >
                Attempt Limit (Blank = Unlimited)
              </label>
              <input
                id="test-attempt-limit-input"
                type="number"
                min={1}
                max={100}
                value={attemptLimit}
                onChange={(e) => setAttemptLimit(e.target.value)}
                placeholder="Unlimited attempts"
                className="w-full rounded-lg border border-border bg-base px-4 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono"
              />
              <p className="text-[11px] font-mono text-text-muted mt-1.5">
                {attemptLimit ? `Capped at ${attemptLimit} completed attempts per student.` : "Students may take this test unlimited times."}
              </p>
            </div>

            {/* Negative Marking Box */}
            <div className="md:col-span-2 rounded-xl border border-border/70 bg-surface-high p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-label-xs font-mono font-bold uppercase tracking-wider text-text-primary">
                      Negative Marking
                    </span>
                    {negativeMarkingEnabled ? (
                      <span className="rounded bg-error/15 px-2 py-0.5 text-[11px] font-mono font-bold uppercase text-error border border-error/30">
                        Active: -{(negativeMarkRate * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="rounded bg-surface-highest px-2 py-0.5 text-[11px] font-mono uppercase text-text-muted border border-border">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-body-xs text-text-muted mt-0.5">
                    Deduct proportional marks for incorrect responses. Unanswered questions receive 0 marks.
                  </p>
                </div>

                <button
                  type="button"
                  id="toggle-negative-marking-btn"
                  onClick={() => setNegativeMarkingEnabled(!negativeMarkingEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    negativeMarkingEnabled ? "bg-primary" : "bg-surface-highest"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      negativeMarkingEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {negativeMarkingEnabled && (
                <div className="pt-3 border-t border-border/60 flex flex-wrap items-center gap-3">
                  <span className="text-label-xs font-mono text-text-muted uppercase">Presets:</span>
                  {[
                    { label: "1/4 Penalty (25%)", rate: 0.25 },
                    { label: "1/3 Penalty (~33%)", rate: 0.33 },
                    { label: "1/2 Penalty (50%)", rate: 0.5 },
                  ].map((preset) => (
                    <button
                      key={preset.rate}
                      type="button"
                      onClick={() => setNegativeMarkRate(preset.rate)}
                      className={`px-2.5 py-1 text-label-xs font-mono rounded border transition-colors ${
                        Math.abs(negativeMarkRate - preset.rate) < 0.005
                          ? "border-primary bg-primary/10 text-primary-text font-bold"
                          : "border-border bg-base text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Randomize Questions */}
            <div className="rounded-xl border border-border/70 bg-surface-high p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-label-xs font-mono font-bold uppercase tracking-wider text-text-primary">
                    Randomize Questions
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                      randomizeQuestions
                        ? "bg-primary/15 text-primary-text border-primary/30"
                        : "bg-surface-highest text-text-muted border-border"
                    }`}
                  >
                    {randomizeQuestions ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="text-body-xs text-text-muted mt-1">
                  Questions will be shuffled when an attempt starts.
                </p>
              </div>

              <button
                type="button"
                id="toggle-randomize-questions-btn"
                onClick={() => setRandomizeQuestions(!randomizeQuestions)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  randomizeQuestions ? "bg-primary" : "bg-surface-highest"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    randomizeQuestions ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Randomize Options */}
            <div className="rounded-xl border border-border/70 bg-surface-high p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-label-xs font-mono font-bold uppercase tracking-wider text-text-primary">
                    Randomize Options
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                      randomizeOptions
                        ? "bg-primary/15 text-primary-text border-primary/30"
                        : "bg-surface-highest text-text-muted border-border"
                    }`}
                  >
                    {randomizeOptions ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="text-body-xs text-text-muted mt-1">
                  Answer options will be shuffled for each attempt.
                </p>
              </div>

              <button
                type="button"
                id="toggle-randomize-options-btn"
                onClick={() => setRandomizeOptions(!randomizeOptions)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  randomizeOptions ? "bg-primary" : "bg-surface-highest"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    randomizeOptions ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: INSTRUCTIONS */}
      {currentStep === "instructions" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="border-b border-border/70 pb-4">
            <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
              Step 03
            </span>
            <h3 className="text-headline-sm font-bold text-text-primary mt-1">
              Test Pre-Start Instructions
            </h3>
            <p className="text-body-sm text-text-secondary mt-1">
              Author candidate guidelines shown on the test detail page before beginning the attempt.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label
                htmlFor="test-instructions-textarea"
                className="text-label-xs text-text-muted uppercase font-mono font-semibold"
              >
                Pre-Start Instructions
              </label>
              <span className="text-label-xs font-mono text-text-muted">
                {instructions.length} / 5000 characters
              </span>
            </div>

            <textarea
              id="test-instructions-textarea"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="e.g. This assessment evaluates core computer science concepts. Maintain strict focus and do not use external aids..."
              className="w-full rounded-lg border border-border bg-base p-4 text-body-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 leading-relaxed font-sans"
            />

            {/* Live Preview Box */}
            <div className="rounded-xl border border-border/70 bg-surface-high p-4 space-y-2">
              <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                Candidate Preview
              </span>
              {instructions.trim() ? (
                <p className="text-body-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  {instructions}
                </p>
              ) : (
                <p className="text-body-sm text-text-muted italic">
                  No additional instructions configured. Students will see the default rules.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SECTIONS */}
      {currentStep === "sections" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
                Step 04
              </span>
              <h3 className="text-headline-sm font-bold text-text-primary mt-1">
                Section Management
              </h3>
              <p className="text-body-sm text-text-secondary mt-1">
                Organize the assessment into distinct sections (e.g. Core CS, Aptitude, Systems).
              </p>
            </div>

            <button
              type="button"
              id="btn-add-section"
              onClick={addSection}
              className="inline-flex items-center gap-1.5 bg-primary text-text-inverse px-4 py-2 rounded-lg text-body-sm font-semibold hover:bg-primary-text transition-colors shadow-sm self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add Section</span>
            </button>
          </div>

          <div className="space-y-4">
            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="rounded-xl border border-border bg-surface-high p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-mono text-label-xs font-bold text-primary-text shrink-0">
                      0{sec.sectionOrder}
                    </span>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => updateSectionTitle(sec.id, e.target.value)}
                      placeholder="Section Title..."
                      className="bg-transparent font-bold text-body-md text-text-primary outline-none border-b border-border/80 focus:border-primary pb-0.5 flex-1 min-w-0"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSectionUp(idx)}
                      title="Move section up"
                      className="w-8 h-8 rounded border border-border bg-surface flex items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => moveSectionDown(idx)}
                      title="Move section down"
                      className="w-8 h-8 rounded border border-border bg-surface flex items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                    </button>
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(sec.id)}
                        title="Delete section"
                        className="w-8 h-8 rounded border border-error/30 bg-error/10 flex items-center justify-center text-error hover:bg-error/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={sec.description}
                    onChange={(e) => updateSectionDescription(sec.id, e.target.value)}
                    placeholder="Optional section description or instructions..."
                    className="w-full bg-base rounded-md border border-border/80 px-3 py-1.5 text-body-xs text-text-secondary outline-none focus:border-primary font-sans"
                  />
                </div>

                <div className="flex items-center gap-4 text-label-xs font-mono text-text-muted pt-1">
                  <span>{sec.questions.length} fixed questions</span>
                  <span>·</span>
                  <span>{(sec.pools || []).length} question pools</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 5: QUESTIONS (FIXED QUESTIONS MANAGEMENT) */}
      {currentStep === "questions" && (
        <div className="space-y-6">
          {/* Active Section Selector */}
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-label-xs font-mono uppercase text-text-muted font-bold">
                Assigning Questions to:
              </span>
              <select
                id="select-target-section"
                value={activeSectionId}
                onChange={(e) => {
                  setActiveSectionId(e.target.value);
                  setActivePoolId(null);
                }}
                className="rounded-lg border border-border bg-base px-3 py-1.5 text-label-xs font-mono font-bold text-primary-text outline-none focus:border-primary"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.sectionOrder}: {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-label-xs font-mono text-text-muted">
              Section Total: {activeSection?.questions.length || 0} questions ·{" "}
              {activeSection?.questions.reduce((sum, q) => sum + q.marks, 0) || 0} marks
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Repository Browser (Left 7 cols) */}
            <div className="lg:col-span-7 space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm">
              <div className="border-b border-border/70 pb-3">
                <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
                  Curriculum Repository
                </span>
                <h3 className="text-title-sm font-bold text-text-primary mt-0.5">
                  Browse & Add Questions
                </h3>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repository..."
                  className="rounded-lg border border-border bg-base px-3 py-1.5 text-body-xs text-text-primary outline-none focus:border-primary"
                />

                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="rounded-lg border border-border bg-base px-2 py-1.5 text-label-xs font-mono text-text-primary outline-none focus:border-primary"
                >
                  <option value="">All Subjects</option>
                  {availableSubjects.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="rounded-lg border border-border bg-base px-2 py-1.5 text-label-xs font-mono text-text-primary outline-none focus:border-primary"
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {/* Question items list */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredRepository.length > 0 ? (
                  filteredRepository.map((q) => {
                    const isSelected = allSelectedQuestionIds.has(q.id);
                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-2.5 ${
                          isSelected
                            ? "border-secondary/30 bg-secondary/5 opacity-70"
                            : "border-border bg-base hover:border-primary/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-text-muted mb-1">
                            <span className="text-primary-text font-semibold">
                              {q.subjectCode} · {q.topicName}
                            </span>
                            <span className="uppercase">{q.difficulty}</span>
                          </div>
                          <p className="text-body-xs text-text-primary font-medium line-clamp-2">
                            {q.question}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px] font-mono">
                          <span className="text-text-muted">
                            {q.marks} marks · {q.expectedTime ? `${q.expectedTime}s` : "No time"}
                          </span>

                          <button
                            type="button"
                            disabled={isSelected}
                            onClick={() => addQuestionToTarget(q)}
                            className={`px-3 py-1 rounded text-label-xs font-mono font-bold transition-colors ${
                              isSelected
                                ? "bg-secondary/15 text-secondary cursor-not-allowed"
                                : "bg-primary text-text-inverse hover:bg-primary-text"
                            }`}
                          >
                            {isSelected ? "Added" : "+ Add"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-8 text-label-xs font-mono text-text-muted">
                    No questions match the filter criteria.
                  </p>
                )}
              </div>
            </div>

            {/* Active Section Questions (Right 5 cols) */}
            <div className="lg:col-span-5 space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm">
              <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
                    Section Payload
                  </span>
                  <h3 className="text-title-sm font-bold text-text-primary mt-0.5">
                    {activeSection?.title}
                  </h3>
                </div>
                <span className="text-label-xs font-mono text-text-muted">
                  {activeSection?.questions.length || 0} questions
                </span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {activeSection?.questions && activeSection.questions.length > 0 ? (
                  activeSection.questions.map((item, qIdx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border bg-surface-high space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="w-5 h-5 rounded bg-surface border border-border flex items-center justify-center text-[10px] font-mono font-bold text-text-primary shrink-0 mt-0.5">
                          {qIdx + 1}
                        </span>
                        <p className="text-body-xs text-text-primary line-clamp-2 flex-1">
                          {item.question.question}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeQuestionFromSection(activeSection.id, item.id)}
                          className="text-text-muted hover:text-error shrink-0"
                          title="Remove from section"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-text-muted pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <span>Marks:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={item.marks}
                            onChange={(e) =>
                              updateQuestionMarks(activeSection.id, item.id, Number(e.target.value))
                            }
                            className="w-12 bg-base border border-border rounded px-1.5 py-0.5 text-center text-text-primary text-[11px]"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={qIdx === 0}
                            onClick={() => moveQuestionUpInSection(activeSection.id, qIdx)}
                            className="p-1 rounded hover:bg-surface disabled:opacity-30"
                            title="Move up"
                          >
                            <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            disabled={qIdx === activeSection.questions.length - 1}
                            onClick={() => moveQuestionDownInSection(activeSection.id, qIdx)}
                            className="p-1 rounded hover:bg-surface disabled:opacity-30"
                            title="Move down"
                          >
                            <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-label-xs font-mono text-text-muted">
                    No questions in this section yet. Add from the repository on the left.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: QUESTION POOLS */}
      {currentStep === "pools" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
                Step 06
              </span>
              <h3 className="text-headline-sm font-bold text-text-primary mt-1">
                Question Pools Management
              </h3>
              <p className="text-body-sm text-text-secondary mt-1">
                Sample randomized question subsets dynamically for each attempt (e.g. 5 selected from 12 available).
              </p>
            </div>

            <button
              type="button"
              id="btn-add-pool"
              onClick={() => addPoolToSection(activeSectionId)}
              className="inline-flex items-center gap-1.5 bg-primary text-text-inverse px-4 py-2 rounded-lg text-body-sm font-semibold hover:bg-primary-text transition-colors shadow-sm self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Pool in {activeSection?.title}</span>
            </button>
          </div>

          <div className="space-y-5">
            {sections.map((sec) => (
              <div key={sec.id} className="space-y-3">
                <h4 className="text-title-sm font-bold text-primary-text font-mono">
                  Section: {sec.title}
                </h4>

                {(sec.pools || []).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sec.pools.map((p) => {
                      const isCapacityValid = p.questions.length >= p.selectionCount;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border p-4 sm:p-5 space-y-3 bg-surface-high ${
                            !isCapacityValid
                              ? "border-error/50 ring-1 ring-error/20"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={p.title}
                              onChange={(e) => updatePoolTitle(sec.id, p.id, e.target.value)}
                              placeholder="Pool Title..."
                              className="font-bold text-body-sm text-text-primary bg-transparent border-b border-border focus:border-primary outline-none flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removePoolFromSection(sec.id, p.id)}
                              className="text-text-muted hover:text-error"
                              title="Delete Pool"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-label-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span>Selection Count:</span>
                              <input
                                type="number"
                                min={1}
                                max={p.questions.length || 1}
                                value={p.selectionCount}
                                onChange={(e) =>
                                  updatePoolSelectionCount(sec.id, p.id, Number(e.target.value))
                                }
                                className="w-14 bg-base border border-border rounded px-2 py-1 text-center font-bold text-text-primary"
                              />
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                isCapacityValid
                                  ? "bg-secondary/15 text-secondary border border-secondary/30"
                                  : "bg-error/15 text-error border border-error/30 animate-pulse"
                              }`}
                            >
                              {p.selectionCount} of {p.questions.length} available
                            </span>
                          </div>

                          {!isCapacityValid && (
                            <p className="text-[11px] font-mono text-error">
                              ⚠ Insufficient capacity: pool selection count exceeds added questions!
                            </p>
                          )}

                          {/* Pool Questions List */}
                          <div className="space-y-1.5 pt-2 border-t border-border/60">
                            <span className="text-[10px] font-mono uppercase text-text-muted block">
                              Pool Items ({p.questions.length}):
                            </span>
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {p.questions.map((pq) => (
                                <div
                                  key={pq.id}
                                  className="flex items-center justify-between gap-2 p-1.5 rounded bg-base border border-border/70 text-body-xs"
                                >
                                  <span className="truncate flex-1">{pq.question.question}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeQuestionFromPool(sec.id, p.id, pq.id)}
                                    className="text-text-muted hover:text-error"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                  </button>
                                </div>
                              ))}
                              {p.questions.length === 0 && (
                                <p className="text-[11px] font-mono text-text-muted italic py-2">
                                  Select this pool in Step 05 to add questions from the repository.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-label-xs font-mono text-text-muted italic">
                    No question pools in {sec.title}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 7: SCHEDULE */}
      {currentStep === "schedule" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="border-b border-border/70 pb-4">
            <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
              Step 07
            </span>
            <h3 className="text-headline-sm font-bold text-text-primary mt-1">
              Lifecycle Status & Availability Schedule
            </h3>
            <p className="text-body-sm text-text-secondary mt-1">
              Configure deployment status and optional time-based availability windows.
            </p>
          </div>

          <div className="space-y-5 max-w-xl">
            {/* Status Selection */}
            <div>
              <label
                htmlFor="test-lifecycle-status"
                className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
              >
                Initial Deployment Status *
              </label>
              <select
                id="test-lifecycle-status"
                value={lifecycleStatus}
                onChange={(e) => setLifecycleStatus(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-base px-4 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="published">Published (Available for testing)</option>
                <option value="draft">Draft (Admin editing only)</option>
              </select>
            </div>

            {/* Scheduled Window Toggle */}
            <div className="rounded-xl border border-border/70 bg-surface-high p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-label-xs font-mono font-bold uppercase tracking-wider text-text-primary block">
                    Schedule Availability Window
                  </span>
                  <p className="text-body-xs text-text-muted mt-0.5">
                    Scheduled tests become available during their configured window.
                  </p>
                </div>

                <button
                  type="button"
                  id="toggle-schedule-window-btn"
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isScheduled ? "bg-primary" : "bg-surface-highest"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isScheduled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {isScheduled && (
                <div className="space-y-4 pt-3 border-t border-border/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="schedule-start-input"
                        className="text-label-xs text-text-muted uppercase font-mono block mb-1 font-semibold"
                      >
                        Start Date / Time
                      </label>
                      <input
                        id="schedule-start-input"
                        type="datetime-local"
                        value={scheduledStartAt}
                        onChange={(e) => setScheduledStartAt(e.target.value)}
                        className="w-full rounded-lg border border-border bg-base px-3 py-2 text-body-sm font-mono text-text-primary outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="schedule-end-input"
                        className="text-label-xs text-text-muted uppercase font-mono block mb-1 font-semibold"
                      >
                        End Date / Time
                      </label>
                      <input
                        id="schedule-end-input"
                        type="datetime-local"
                        value={scheduledEndAt}
                        onChange={(e) => setScheduledEndAt(e.target.value)}
                        className="w-full rounded-lg border border-border bg-base px-3 py-2 text-body-sm font-mono text-text-primary outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="schedule-tz-input"
                      className="text-label-xs text-text-muted uppercase font-mono block mb-1 font-semibold"
                    >
                      Timezone
                    </label>
                    <input
                      id="schedule-tz-input"
                      type="text"
                      value={scheduleTimezone}
                      onChange={(e) => setScheduleTimezone(e.target.value)}
                      className="w-full rounded-lg border border-border bg-base px-3 py-2 text-body-sm font-mono text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 8: REVIEW & PUBLISH CONFIRMATION */}
      {currentStep === "review" && (
        <div className="space-y-6 rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
          <div className="border-b border-border/70 pb-4">
            <span className="text-label-xs font-mono uppercase tracking-wider text-primary-text font-bold">
              Step 08
            </span>
            <h3 className="text-headline-sm font-bold text-text-primary mt-1">
              Final Review & Deployment Verification
            </h3>
            <p className="text-body-sm text-text-secondary mt-1">
              Review all assessment parameters, verify structural validation, and deploy.
            </p>
          </div>

          {/* Validation Status Notice */}
          {validationWarnings.length > 0 ? (
            <div className="p-4 rounded-xl border border-error/50 bg-error/10 space-y-2">
              <div className="flex items-center gap-2 text-error font-bold font-mono text-body-sm">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span>Structural Validation Incomplete ({validationWarnings.length} issues)</span>
              </div>
              <ul className="list-disc list-inside text-body-xs text-error/90 space-y-1 pl-1">
                {validationWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-secondary/40 bg-secondary/10 flex items-center gap-2.5 text-secondary text-body-sm font-medium">
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>All parameters verified. Assessment is structurally sound and ready for deployment.</span>
            </div>
          )}

          {/* Configuration Review Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-surface-high space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">Title</span>
              <span className="text-body-sm font-bold text-text-primary block truncate">
                {title || "Untitled"}
              </span>
              <span className="text-[11px] font-mono text-primary-text block uppercase">
                {testType}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-high space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">Questions & Marks</span>
              <span className="text-body-sm font-bold text-text-primary block">
                {totalQuestions} questions · {totalMarks} marks
              </span>
              <span className="text-[11px] font-mono text-text-muted block">
                {sections.length} {sections.length === 1 ? "section" : "sections"}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-high space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">Timing & Rules</span>
              <span className="text-body-sm font-bold text-text-primary block">
                {duration} mins · {attemptLimit ? `${attemptLimit} attempts` : "Unlimited"}
              </span>
              <span className="text-[11px] font-mono text-text-muted block">
                {negativeMarkingEnabled ? `-${(negativeMarkRate * 100).toFixed(0)}% Penalty` : "No penalty"}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-high space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">Deployment Status</span>
              <span
                className={`text-body-sm font-bold uppercase block ${
                  lifecycleStatus === "published" ? "text-secondary" : "text-tertiary"
                }`}
              >
                {lifecycleStatus}
              </span>
              <span className="text-[11px] font-mono text-text-muted block truncate">
                {isScheduled ? "Window active" : "Always available"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handlePreview}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-surface-high text-body-sm font-semibold text-text-primary hover:border-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              <span>Test Preview Mode</span>
            </button>

            <button
              type="button"
              id="btn-deploy-assessment"
              disabled={!canPublish || loading}
              onClick={() => setShowPublishConfirm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-text-inverse px-6 py-2.5 rounded-lg text-body-sm font-bold hover:bg-primary-text transition-colors shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">publish</span>
              <span>Deploy Assessment</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Step Navigation Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border/80">
        <button
          type="button"
          disabled={currentStepIndex === 0}
          onClick={goToPrevStep}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-body-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Previous Step</span>
        </button>

        <span className="text-label-xs font-mono text-text-muted hidden sm:inline">
          Step {currentStepIndex + 1} of {BUILDER_STEPS.length}
        </span>

        {currentStepIndex < BUILDER_STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goToNextStep}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-high border border-border text-body-sm font-semibold text-text-primary hover:border-primary transition-colors"
          >
            <span>Next Step</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!canPublish || loading}
            onClick={() => setShowPublishConfirm(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-text-inverse text-body-sm font-bold hover:bg-primary-text transition-colors disabled:opacity-50"
          >
            <span>Deploy</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        )}
      </div>

      {/* 4. PUBLISHING SAFETY CONFIRMATION MODAL */}
      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">publish</span>
                </div>
                <div>
                  <h3 className="text-title-sm font-bold text-text-primary">
                    Confirm Deployment
                  </h3>
                  <p className="text-label-xs font-mono text-text-muted">
                    Publishing Safety Verification
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPublishConfirm(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Verification Table */}
            <div className="rounded-xl border border-border bg-surface-high p-4 space-y-2 font-mono text-label-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Title:</span>
                <span className="font-bold text-text-primary">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Questions:</span>
                <span className="font-bold text-text-primary">{totalQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Duration:</span>
                <span className="font-bold text-text-primary">{duration} mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total Marks:</span>
                <span className="font-bold text-primary-text">{totalMarks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Status:</span>
                <span className="font-bold text-secondary uppercase">{lifecycleStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Attempt Limit:</span>
                <span className="text-text-primary">{attemptLimit ? `${attemptLimit} attempts` : "Unlimited"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Negative Marking:</span>
                <span className="text-text-primary">
                  {negativeMarkingEnabled ? `-${(negativeMarkRate * 100).toFixed(0)}%` : "Disabled"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishConfirm(false)}
                className="px-4 py-2 rounded-lg border border-border bg-surface text-body-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Back to Edit
              </button>

              <button
                type="button"
                id="btn-confirm-publish-assessment"
                disabled={loading}
                onClick={handleCreateTest}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-text-inverse text-body-sm font-bold hover:bg-primary-text transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      autorenew
                    </span>
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Confirm & Deploy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface QuestionFormData {
  id?: string;
  question: string;
  questionType: "single_choice" | "multiple_choice";
  subjectId: string;
  topicId: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  expectedTime: number;
  options: string[];
  correctAnswer: string | string[];
  explanation: string;
  usage?: {
    testCount: number;
    poolCount: number;
  };
}

export function QuestionForm({
  subjects,
  topics,
  initialData,
  mode = "create",
}: {
  subjects: { id: string; name: string; code: string }[];
  topics: { id: string; name: string; subjectId: string }[];
  initialData?: QuestionFormData;
  mode?: "create" | "edit";
}) {
  const router = useRouter();

  const [question, setQuestion] = useState(initialData?.question || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialData?.subjectId || subjects[0]?.id || ""
  );
  const [selectedTopicId, setSelectedTopicId] = useState(
    initialData?.topicId || ""
  );
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    initialData?.difficulty || "medium"
  );
  const [questionType, setQuestionType] = useState<"single_choice" | "multiple_choice">(
    initialData?.questionType || "single_choice"
  );
  const [marks, setMarks] = useState<number>(initialData?.marks ?? 2);
  const [expectedTime, setExpectedTime] = useState<number>(
    initialData?.expectedTime ?? 60
  );

  const [options, setOptions] = useState<string[]>(
    initialData?.options && initialData.options.length >= 2
      ? initialData.options
      : ["", "", "", ""]
  );

  // Normalize initial correct answer
  const [singleCorrectAnswer, setSingleCorrectAnswer] = useState<string>(
    typeof initialData?.correctAnswer === "string"
      ? initialData.correctAnswer
      : Array.isArray(initialData?.correctAnswer) && initialData.correctAnswer[0]
      ? initialData.correctAnswer[0]
      : ""
  );

  const [multipleCorrectAnswers, setMultipleCorrectAnswers] = useState<string[]>(
    Array.isArray(initialData?.correctAnswer)
      ? initialData.correctAnswer
      : typeof initialData?.correctAnswer === "string" && initialData.correctAnswer
      ? [initialData.correctAnswer]
      : []
  );

  const [explanation, setExplanation] = useState(initialData?.explanation || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Topics filtered by subject
  const availableTopics = useMemo(() => {
    return topics.filter((t) => t.subjectId === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  // Ensure topic selection is valid
  const effectiveTopicId = useMemo(() => {
    if (selectedTopicId && availableTopics.some((t) => t.id === selectedTopicId)) {
      return selectedTopicId;
    }
    return availableTopics[0]?.id || "";
  }, [selectedTopicId, availableTopics]);

  const handleOptionChange = (idx: number, val: string) => {
    const prevVal = options[idx];
    const next = [...options];
    next[idx] = val;
    setOptions(next);

    // If option text changed, update correct answers accordingly
    if (singleCorrectAnswer === prevVal) {
      setSingleCorrectAnswer(val);
    }
    if (multipleCorrectAnswers.includes(prevVal)) {
      setMultipleCorrectAnswers((prev) =>
        prev.map((a) => (a === prevVal ? val : a))
      );
    }
  };

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) {
      setErrorMsg("Questions require a minimum of two options.");
      return;
    }
    const removedVal = options[idx];
    const next = options.filter((_, i) => i !== idx);
    setOptions(next);

    if (singleCorrectAnswer === removedVal) {
      setSingleCorrectAnswer("");
    }
    setMultipleCorrectAnswers((prev) => prev.filter((a) => a !== removedVal));
  };

  const handleToggleMultipleAnswer = (opt: string) => {
    if (!opt.trim()) return;
    setMultipleCorrectAnswers((prev) =>
      prev.includes(opt) ? prev.filter((a) => a !== opt) : [...prev, opt]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Client-side quick checks
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 5) {
      setErrorMsg("Question prompt must be at least 5 characters.");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleanOptions.length < 2) {
      setErrorMsg("At least two non-empty options are required.");
      return;
    }

    const uniqueOptions = new Set(cleanOptions);
    if (uniqueOptions.size !== cleanOptions.length) {
      setErrorMsg("All options must be distinct from one another.");
      return;
    }

    let finalCorrectAnswer: string | string[];
    if (questionType === "single_choice") {
      if (!singleCorrectAnswer.trim()) {
        setErrorMsg("Please select the correct answer option.");
        return;
      }
      if (!cleanOptions.includes(singleCorrectAnswer.trim())) {
        setErrorMsg("The selected correct answer does not match any valid option.");
        return;
      }
      finalCorrectAnswer = singleCorrectAnswer.trim();
    } else {
      const validAnswers = multipleCorrectAnswers
        .map((a) => a.trim())
        .filter((a) => cleanOptions.includes(a));
      if (validAnswers.length === 0) {
        setErrorMsg("Please select at least one correct option for multiple choice.");
        return;
      }
      finalCorrectAnswer = validAnswers;
    }

    if (!effectiveTopicId) {
      setErrorMsg("Please select a valid curriculum topic.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "edit" && initialData?.id
          ? `/api/admin/questions/${initialData.id}`
          : "/api/admin/questions";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          questionType,
          subjectId: selectedSubjectId,
          topicId: effectiveTopicId,
          difficulty,
          marks: Number(marks),
          expectedTime: Number(expectedTime),
          options: cleanOptions,
          correctAnswer: finalCorrectAnswer,
          explanation: explanation.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to save question.");
      }

      setSuccessMsg(
        mode === "edit"
          ? "Question updated successfully. Historical attempt snapshots remain preserved."
          : "New question authored and added to curriculum repository."
      );

      setTimeout(() => {
        router.push("/admin/questions");
        router.refresh();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to save question.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error & Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-error/40 bg-error/10 text-error flex items-center gap-3 text-body-sm font-medium">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl border border-secondary/40 bg-secondary/10 text-secondary flex items-center gap-3 text-body-sm font-medium">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Usage Warning Banner in Edit Mode */}
      {mode === "edit" && initialData?.usage && (
        <div className="p-4 rounded-xl border border-primary/30 bg-surface-high flex items-start gap-3 text-body-sm">
          <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
            info
          </span>
          <div className="space-y-1">
            <p className="font-semibold text-text-primary">
              Question Inventory Usage Notice
            </p>
            <p className="text-text-muted text-[13px] leading-relaxed">
              This question is currently utilized in{" "}
              <strong className="text-primary-text">
                {initialData.usage.testCount} {initialData.usage.testCount === 1 ? "test" : "tests"}
              </strong>{" "}
              and{" "}
              <strong className="text-primary-text">
                {initialData.usage.poolCount} {initialData.usage.poolCount === 1 ? "pool" : "pools"}
              </strong>
              . Updates apply to future test sessions while historical student attempt records and verified scoring snapshots remain strictly immutable.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: QUESTION */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-title-sm font-bold uppercase tracking-wider text-text-primary font-mono">
              01 · Question Prompt
            </h2>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            {question.length} / 3000 chars
          </span>
        </div>

        <div>
          <label
            htmlFor="question-prompt-input"
            className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
          >
            Technical Question Prompt *
          </label>
          <textarea
            id="question-prompt-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            rows={4}
            maxLength={3000}
            placeholder="State the technical question prompt clearly and unambiguously..."
            className="w-full bg-base border border-border rounded-lg p-4 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none leading-relaxed font-sans"
          />
        </div>
      </div>

      {/* SECTION 2: METADATA */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-title-sm font-bold uppercase tracking-wider text-text-primary font-mono">
              02 · Metadata & Classification
            </h2>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            Curriculum Assignment
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Subject */}
          <div>
            <label
              htmlFor="question-subject-select"
              className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
            >
              Curriculum Subject *
            </label>
            <select
              id="question-subject-select"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedTopicId("");
              }}
              className="w-full rounded-lg border border-border bg-base px-3.5 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-sans"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label
              htmlFor="question-topic-select"
              className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
            >
              Subject Topic *
            </label>
            <select
              id="question-topic-select"
              value={effectiveTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full rounded-lg border border-border bg-base px-3.5 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-sans"
            >
              {availableTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label
              htmlFor="question-difficulty-select"
              className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
            >
              Difficulty Tier *
            </label>
            <select
              id="question-difficulty-select"
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as "easy" | "medium" | "hard")
              }
              className="w-full rounded-lg border border-border bg-base px-3.5 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-sans"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Question Type */}
          <div>
            <label
              htmlFor="question-type-select"
              className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
            >
              Response Format *
            </label>
            <select
              id="question-type-select"
              value={questionType}
              onChange={(e) => {
                const nextType = e.target.value as "single_choice" | "multiple_choice";
                setQuestionType(nextType);
                if (nextType === "single_choice" && multipleCorrectAnswers.length > 0) {
                  setSingleCorrectAnswer(multipleCorrectAnswers[0]);
                }
              }}
              className="w-full rounded-lg border border-border bg-base px-3.5 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-sans"
            >
              <option value="single_choice">Single Choice (1 Correct Option)</option>
              <option value="multiple_choice">Multiple Choice (Multiple Options)</option>
            </select>
          </div>

          {/* Marks */}
          <div>
            <label
              htmlFor="question-marks-input"
              className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
            >
              Awarded Marks (1–20) *
            </label>
            <input
              id="question-marks-input"
              type="number"
              min={1}
              max={20}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-base px-3.5 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          {/* Expected Time */}
          <div>
            <label
              htmlFor="question-time-input"
              className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
            >
              Expected Duration (Seconds) *
            </label>
            <input
              id="question-time-input"
              type="number"
              min={10}
              max={600}
              step={5}
              value={expectedTime}
              onChange={(e) => setExpectedTime(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-base px-3.5 py-2.5 text-body-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3 & 4: OPTIONS & CORRECT ANSWER */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-title-sm font-bold uppercase tracking-wider text-text-primary font-mono">
              03 · Options & Answer Key
            </h2>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            {questionType === "single_choice"
              ? "Select 1 radio button as correct"
              : "Check all matching options as correct"}
          </span>
        </div>

        <div className="space-y-3">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSingleSelected = singleCorrectAnswer === opt && opt.trim() !== "";
            const isMultiSelected =
              multipleCorrectAnswers.includes(opt) && opt.trim() !== "";

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  isSingleSelected || isMultiSelected
                    ? "border-secondary/50 bg-secondary/5"
                    : "border-border bg-base"
                }`}
              >
                {/* Option Letter */}
                <span className="w-7 h-7 rounded bg-surface-high border border-border flex items-center justify-center text-label-xs font-mono font-bold text-text-primary flex-shrink-0">
                  {letter}
                </span>

                {/* Option Text Input */}
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${letter} text...`}
                  className="flex-1 bg-transparent text-body-sm text-text-primary outline-none placeholder:text-text-muted font-sans"
                />

                {/* Correct Answer Indicator Selection */}
                {questionType === "single_choice" ? (
                  <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded bg-surface-high border border-border/80 text-label-xs font-mono hover:border-primary transition-colors flex-shrink-0">
                    <input
                      type="radio"
                      name="correct-answer-radio"
                      checked={isSingleSelected}
                      disabled={!opt.trim()}
                      onChange={() => setSingleCorrectAnswer(opt)}
                      className="accent-primary"
                    />
                    <span
                      className={
                        isSingleSelected
                          ? "text-secondary font-bold"
                          : "text-text-muted"
                      }
                    >
                      {isSingleSelected ? "Correct Answer" : "Mark Correct"}
                    </span>
                  </label>
                ) : (
                  <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded bg-surface-high border border-border/80 text-label-xs font-mono hover:border-primary transition-colors flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isMultiSelected}
                      disabled={!opt.trim()}
                      onChange={() => handleToggleMultipleAnswer(opt)}
                      className="accent-primary"
                    />
                    <span
                      className={
                        isMultiSelected
                          ? "text-secondary font-bold"
                          : "text-text-muted"
                      }
                    >
                      {isMultiSelected ? "Correct" : "Mark Correct"}
                    </span>
                  </label>
                )}

                {/* Remove Option Button */}
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    title="Remove option"
                    className="w-8 h-8 rounded text-text-muted hover:text-error hover:bg-error/10 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {options.length < 8 && (
          <button
            type="button"
            onClick={handleAddOption}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-dashed border-border text-label-xs font-mono text-text-secondary hover:text-primary-text hover:border-primary transition-colors mt-2"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Another Option
          </button>
        )}
      </div>

      {/* SECTION 5: EXPLANATION */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-title-sm font-bold uppercase tracking-wider text-text-primary font-mono">
              04 · Solution Explanation
            </h2>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            Displayed only on results page
          </span>
        </div>

        <div>
          <label
            htmlFor="question-explanation-input"
            className="text-label-xs text-text-muted uppercase font-mono block mb-2 font-semibold"
          >
            Detailed Solution & Conceptual Rationale (Optional)
          </label>
          <textarea
            id="question-explanation-input"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Explain why the selected option is mathematically or algorithmically correct for the student review phase..."
            className="w-full bg-base border border-border rounded-lg p-4 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none leading-relaxed font-sans"
          />
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Link
          href="/admin/questions"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-border bg-surface text-body-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-high transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Cancel
        </Link>

        <button
          type="submit"
          id="btn-submit-question"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-primary text-text-inverse font-semibold text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">
                autorenew
              </span>
              Saving Question...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">save</span>
              {mode === "edit" ? "Save Question Changes" : "Author & Publish Item"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

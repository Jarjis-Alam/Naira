"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface QuestionInventoryItem {
  id: string;
  question: string;
  questionType: "single_choice" | "multiple_choice";
  difficulty: string;
  marks: number;
  expectedTime: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  topicId: string;
  topicName: string;
  testCount: number;
  poolCount: number;
}

export interface SubjectItem {
  id: string;
  name: string;
  code: string;
}

export interface TopicItem {
  id: string;
  name: string;
  subjectId: string;
}

export function QuestionBankTable({
  questions,
  subjects,
  topics,
}: {
  questions: QuestionInventoryItem[];
  subjects: SubjectItem[];
  topics: TopicItem[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const filteredTopics = useMemo(() => {
    if (!selectedSubjectId) return topics;
    return topics.filter((t) => t.subjectId === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  const hasFilters = Boolean(
    searchQuery ||
      selectedSubjectId ||
      selectedTopicId ||
      selectedDifficulty ||
      selectedType
  );

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch =
        !searchQuery ||
        q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.topicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject =
        !selectedSubjectId || q.subjectId === selectedSubjectId;

      const matchesTopic =
        !selectedTopicId || q.topicId === selectedTopicId;

      const matchesDifficulty =
        !selectedDifficulty || q.difficulty === selectedDifficulty;

      const matchesType =
        !selectedType || q.questionType === selectedType;

      return (
        matchesSearch &&
        matchesSubject &&
        matchesTopic &&
        matchesDifficulty &&
        matchesType
      );
    });
  }, [
    questions,
    searchQuery,
    selectedSubjectId,
    selectedTopicId,
    selectedDifficulty,
    selectedType,
  ]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedSubjectId("");
    setSelectedTopicId("");
    setSelectedDifficulty("");
    setSelectedType("");
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Text Search */}
          <div className="relative min-w-0 flex-1">
            <label htmlFor="question-search-input" className="sr-only">
              Search questions
            </label>
            <input
              id="question-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keyword, topic, or question ID..."
              className="h-10 w-full rounded-lg border border-border bg-base px-10 pr-4 text-body-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 font-sans"
            />
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-[18px] text-text-muted">
              search
            </span>
          </div>

          {/* Subject Filter */}
          <select
            id="filter-subject-select"
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setSelectedTopicId("");
            }}
            aria-label="Filter by subject"
            className="h-10 rounded-lg border border-border bg-base px-3 text-label-xs font-mono text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          {/* Topic Filter */}
          <select
            id="filter-topic-select"
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            aria-label="Filter by topic"
            className="h-10 rounded-lg border border-border bg-base px-3 text-label-xs font-mono text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Topics</option>
            {filteredTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Difficulty Filter */}
          <select
            id="filter-difficulty-select"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            aria-label="Filter by difficulty"
            className="h-10 rounded-lg border border-border bg-base px-3 text-label-xs font-mono text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Question Type Filter */}
          <select
            id="filter-type-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter by question type"
            className="h-10 rounded-lg border border-border bg-base px-3 text-label-xs font-mono text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Types</option>
            <option value="single_choice">Single Choice (MCQ)</option>
            <option value="multiple_choice">Multiple Choice</option>
          </select>

          {/* Clear Filters CTA */}
          {hasFilters && (
            <button
              id="btn-clear-question-filters"
              onClick={handleClearFilters}
              type="button"
              className="h-10 rounded-lg border border-border bg-surface-high px-3.5 text-label-xs font-mono text-text-secondary hover:text-text-primary transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Question Table & Inventory */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-high px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">
              inventory_2
            </span>
            <span className="text-label-xs font-mono uppercase font-bold text-text-primary">
              Question Inventory
            </span>
          </div>
          <span className="text-label-xs font-mono text-text-muted">
            Showing {filtered.length} of {questions.length} items
          </span>
        </div>

        {/* Desktop Table Header */}
        <div className="hidden min-w-[1020px] grid-cols-12 gap-3 border-b border-border bg-surface-high/60 px-5 py-2.5 text-label-xs font-mono uppercase text-text-muted lg:grid">
          <div className="col-span-1">ID</div>
          <div className="col-span-4">Question Prompt</div>
          <div className="col-span-2">Subject / Topic</div>
          <div className="col-span-1">Type / Diff</div>
          <div className="col-span-1">Marks / Time</div>
          <div className="col-span-2">Usage</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {/* List Body */}
        <div className="divide-y divide-border">
          {filtered.length > 0 ? (
            filtered.map((q) => {
              const hasUsage = q.testCount > 0 || q.poolCount > 0;
              return (
                <div
                  key={q.id}
                  className="p-4 transition-colors hover:bg-surface-high/30 lg:grid lg:min-w-[1020px] lg:grid-cols-12 lg:items-center lg:gap-3 lg:px-5 lg:py-3.5"
                >
                  {/* ID */}
                  <div className="mb-2 flex items-center justify-between gap-2 lg:col-span-1 lg:mb-0 lg:block">
                    <span
                      className="font-mono text-label-xs text-text-muted"
                      title={q.id}
                    >
                      {q.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span
                      className={`lg:hidden text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                        q.difficulty === "easy"
                          ? "bg-secondary/10 text-secondary border border-secondary/30"
                          : q.difficulty === "medium"
                          ? "bg-primary/10 text-primary-text border border-primary/30"
                          : "bg-error/10 text-error border border-error/30"
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </div>

                  {/* Prompt */}
                  <div className="mb-2.5 lg:col-span-4 lg:mb-0">
                    <p
                      className="text-body-sm font-medium text-text-primary line-clamp-2"
                      title={q.question}
                    >
                      {q.question}
                    </p>
                  </div>

                  {/* Subject & Topic */}
                  <div className="mb-2.5 text-label-xs font-mono lg:col-span-2 lg:mb-0">
                    <span className="text-primary-text font-semibold block truncate">
                      {q.subjectCode} · {q.subjectName}
                    </span>
                    <span className="text-text-muted block truncate mt-0.5">
                      {q.topicName}
                    </span>
                  </div>

                  {/* Type & Difficulty */}
                  <div className="mb-2.5 text-label-xs font-mono lg:col-span-1 lg:mb-0 space-y-1">
                    <span className="text-[11px] text-text-secondary block">
                      {q.questionType === "multiple_choice" ? "Multiple Choice" : "Single Choice"}
                    </span>
                    <span
                      className={`hidden lg:inline-flex text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                        q.difficulty === "easy"
                          ? "bg-secondary/10 text-secondary border border-secondary/30"
                          : q.difficulty === "medium"
                          ? "bg-primary/10 text-primary-text border border-primary/30"
                          : "bg-error/10 text-error border border-error/30"
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </div>

                  {/* Marks / Expected Time */}
                  <div className="mb-2.5 text-label-xs font-mono lg:col-span-1 lg:mb-0">
                    <span className="font-semibold text-text-primary block">
                      {q.marks} {q.marks === 1 ? "mark" : "marks"}
                    </span>
                    <span className="text-text-muted block text-[11px]">
                      {q.expectedTime ? `${q.expectedTime}s` : "Unset"}
                    </span>
                  </div>

                  {/* Usage */}
                  <div className="mb-3 lg:col-span-2 lg:mb-0">
                    {hasUsage ? (
                      <div className="inline-flex flex-col gap-0.5 text-label-xs font-mono">
                        <span className="text-secondary font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          {q.testCount > 0 && `${q.testCount} ${q.testCount === 1 ? "test" : "tests"}`}
                          {q.testCount > 0 && q.poolCount > 0 && " · "}
                          {q.poolCount > 0 && `${q.poolCount} ${q.poolCount === 1 ? "pool" : "pools"}`}
                        </span>
                        <span className="text-[10px] text-text-muted">Active curriculum item</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted bg-surface-high px-2 py-0.5 rounded border border-border">
                        Unused
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end lg:col-span-1">
                    <Link
                      href={`/admin/questions/${q.id}`}
                      id={`btn-edit-question-${q.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-text-primary hover:border-primary hover:text-primary-text transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Edit</span>
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-text-muted">
                search_off
              </span>
              <p className="text-title-sm font-semibold text-text-primary">
                No questions match your filter criteria
              </p>
              <p className="text-body-sm text-text-muted max-w-md">
                Try adjusting your search terms, subject, topic, or difficulty filters to find questions.
              </p>
              {hasFilters && (
                <button
                  onClick={handleClearFilters}
                  className="mt-2 text-label-xs font-mono text-primary hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-label-xs font-mono text-text-muted bg-surface-high/30">
          <span>
            Total repository size: {questions.length} items
          </span>
          <span>
            Filtered results: {filtered.length}
          </span>
        </div>
      </div>
    </div>
  );
}

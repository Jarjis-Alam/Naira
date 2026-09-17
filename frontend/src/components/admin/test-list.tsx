"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TestStatus, EffectiveStatus } from "@/lib/lifecycle";

export interface AdminTestItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  duration: number;
  difficulty: string | null;
  totalMarks: number;
  status: TestStatus;
  effectiveStatus: EffectiveStatus;
  attemptLimit: number | null;
  negativeMarkingEnabled: boolean;
  negativeMarkRate: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  scheduledStartAt: Date | string | null;
  scheduledEndAt: Date | string | null;
  scheduleTimezone: string | null;
  isPublished: boolean;
  questionCount: number;
  sectionCount: number;
  attemptCount: number;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export function AdminTestList({ initialTests }: { initialTests: AdminTestItem[] }) {
  const router = useRouter();
  const [tests, setTests] = useState<AdminTestItem[]>(initialTests);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [highlightedTestId, setHighlightedTestId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasFilters = Boolean(search || filterStatus !== "all" || filterType !== "all");

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
        t.id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        t.status === filterStatus ||
        t.effectiveStatus === filterStatus;

      const matchesType = filterType === "all" || t.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [tests, search, filterStatus, filterType]);

  const handleClearFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterType("all");
  };

  const handleUpdateStatus = async (testId: string, newStatus: TestStatus) => {
    setTogglingId(testId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/admin/tests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: testId,
          status: newStatus,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to transition test to ${newStatus}`);
      }

      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: newStatus,
                effectiveStatus:
                  newStatus === "published"
                    ? t.scheduledStartAt && new Date().getTime() < new Date(t.scheduledStartAt).getTime()
                      ? "scheduled"
                      : "active"
                    : newStatus,
                isPublished: newStatus === "published",
              }
            : t
        )
      );
      setSuccessMessage(`Assessment status updated to ${newStatus.toUpperCase()}`);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to update test lifecycle status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDuplicate = async (testId: string) => {
    if (duplicatingId) return;
    setDuplicatingId(testId);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", id: testId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to duplicate assessment.");
      }

      if (data?.test) {
        const newTest: AdminTestItem = {
          ...data.test,
          effectiveStatus: "draft",
          questionCount: data.test.questionCount ?? 0,
          sectionCount: data.test.sectionCount ?? 1,
          attemptCount: 0,
          negativeMarkRate: Number(data.test.negativeMarkRate || 0),
        };
        setTests((prev) => [newTest, ...prev]);
        setHighlightedTestId(newTest.id);
        setSuccessMessage(`Assessment duplicated successfully: "${newTest.title}" (Draft)`);
      } else {
        setSuccessMessage("Assessment duplicated successfully as Draft.");
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to duplicate test.");
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {successMessage && (
        <div className="p-4 rounded-xl border border-secondary/40 bg-secondary/10 text-secondary flex items-center justify-between gap-3 text-body-sm font-medium">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-text-muted hover:text-text-primary"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl border border-error/40 bg-error/10 text-error flex items-center justify-between gap-3 text-body-sm font-medium">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-text-muted hover:text-text-primary"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Action Header & Search Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2 text-label-xs font-mono text-text-muted">
            <span className="material-symbols-outlined text-[18px] text-primary">
              quiz
            </span>
            <span>
              Total Assessments: <strong className="text-text-primary">{tests.length}</strong>
            </span>
            <span>·</span>
            <span>
              Published:{" "}
              <strong className="text-secondary">
                {tests.filter((t) => t.status === "published").length}
              </strong>
            </span>
            <span>·</span>
            <span>
              Drafts:{" "}
              <strong className="text-tertiary">
                {tests.filter((t) => t.status === "draft").length}
              </strong>
            </span>
          </div>

          <Link
            href="/admin/tests/new"
            id="btn-admin-create-test"
            className="inline-flex items-center justify-center gap-2 bg-primary text-text-inverse font-semibold text-body-sm px-4 py-2 rounded-lg hover:bg-primary-text transition-colors shadow-sm self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Build New Test</span>
          </Link>
        </div>

        {/* Discovery Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <label htmlFor="test-search-input" className="sr-only">
              Search assessments
            </label>
            <input
              id="test-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assessments by title, description, or ID..."
              className="h-10 w-full rounded-lg border border-border bg-base px-10 pr-4 text-body-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 font-sans"
            />
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-[18px] text-text-muted">
              search
            </span>
          </div>

          {/* Status Filter */}
          <select
            id="filter-test-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by lifecycle status"
            className="h-10 rounded-lg border border-border bg-base px-3 text-label-xs font-mono text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published / Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>

          {/* Type Filter */}
          <select
            id="filter-test-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by category"
            className="h-10 rounded-lg border border-border bg-base px-3 text-label-xs font-mono text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Tracks</option>
            <option value="mixed">Mixed Placement</option>
            <option value="aptitude">Aptitude Track</option>
            <option value="cs_fundamentals">CS Fundamentals</option>
            <option value="baseline">Baseline Assessment</option>
          </select>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              id="btn-clear-test-filters"
              onClick={handleClearFilters}
              type="button"
              className="h-10 rounded-lg border border-border bg-surface-high px-3.5 text-label-xs font-mono text-text-secondary hover:text-text-primary transition-colors hover:border-primary whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Tests Inventory List */}
      <div className="space-y-3.5">
        {filteredTests.length > 0 ? (
          filteredTests.map((t) => {
            const isHighlighted = highlightedTestId === t.id;
            const isDuplicating = duplicatingId === t.id;
            const isToggling = togglingId === t.id;

            // Status styling
            const statusColor =
              t.effectiveStatus === "active" || t.status === "published"
                ? "bg-secondary/15 text-secondary border-secondary/30"
                : t.effectiveStatus === "scheduled"
                ? "bg-tertiary/15 text-tertiary border-tertiary/30"
                : t.status === "draft"
                ? "bg-surface-high text-text-muted border-border"
                : t.status === "closed"
                ? "bg-error/15 text-error border-error/30"
                : "bg-surface-highest text-text-muted border-border";

            const categoryLabel =
              t.type === "cs_fundamentals"
                ? "CS Fundamentals"
                : t.type === "aptitude"
                ? "Aptitude"
                : t.type === "baseline"
                ? "Baseline Benchmark"
                : "Mixed Placement";

            return (
              <div
                key={t.id}
                className={`rounded-xl border bg-surface p-5 transition-all shadow-sm ${
                  isHighlighted
                    ? "border-primary ring-1 ring-primary/40 bg-surface-high/40"
                    : "border-border hover:border-border-variant"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Test Info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${statusColor}`}
                      >
                        {t.effectiveStatus === "active"
                          ? "PUBLISHED · ACTIVE"
                          : t.effectiveStatus.toUpperCase()}
                      </span>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-high text-primary-text border border-border uppercase font-semibold">
                        {categoryLabel}
                      </span>

                      {t.negativeMarkingEnabled && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-error/10 text-error border border-error/20 font-bold">
                          -{(t.negativeMarkRate * 100).toFixed(0)}% NEGATIVE
                        </span>
                      )}

                      {(t.randomizeQuestions || t.randomizeOptions) && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-high text-text-muted border border-border">
                          {t.randomizeQuestions && t.randomizeOptions
                            ? "SHUFFLED (Q & OPTS)"
                            : t.randomizeQuestions
                            ? "SHUFFLED QUESTIONS"
                            : "SHUFFLED OPTIONS"}
                        </span>
                      )}
                    </div>

                    <h2 className="text-title-md font-bold text-text-primary tracking-tight">
                      {t.title}
                    </h2>

                    {t.description && (
                      <p className="text-body-sm text-text-secondary line-clamp-2 max-w-3xl leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    {/* Meta Specifications */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label-xs font-mono text-text-muted pt-1">
                      <span className="flex items-center gap-1 text-text-primary font-semibold">
                        <span className="material-symbols-outlined text-[15px] text-primary">timer</span>
                        {t.duration} mins
                      </span>

                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">format_list_numbered</span>
                        {t.questionCount} {t.questionCount === 1 ? "question" : "questions"}
                      </span>

                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">grade</span>
                        {t.totalMarks} marks
                      </span>

                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">layers</span>
                        {t.sectionCount} {t.sectionCount === 1 ? "section" : "sections"}
                      </span>

                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">replay</span>
                        {t.attemptLimit === null ? "Unlimited attempts" : `${t.attemptLimit} max attempts`}
                      </span>

                      {t.attemptCount > 0 && (
                        <span className="text-secondary font-semibold">
                          {t.attemptCount} {t.attemptCount === 1 ? "student attempt" : "student attempts"}
                        </span>
                      )}
                    </div>

                    {/* Schedule availability window if scheduled */}
                    {t.scheduledStartAt && (
                      <div className="text-[11px] font-mono text-tertiary flex items-center gap-1.5 pt-0.5">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        <span>
                          Window: {new Date(t.scheduledStartAt).toLocaleString()}
                          {t.scheduledEndAt && ` → ${new Date(t.scheduledEndAt).toLocaleString()}`}
                          {t.scheduleTimezone && ` (${t.scheduleTimezone})`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex flex-wrap lg:flex-col items-end gap-2 shrink-0 pt-2 lg:pt-0">
                    <div className="flex items-center gap-1.5">
                      {/* Preview Button */}
                      <Link
                        href={`/admin/tests/preview?testId=${t.id}`}
                        id={`btn-preview-test-${t.id}`}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-text-primary hover:border-primary hover:text-primary-text transition-colors"
                        title="Confidence preview without creating attempts"
                      >
                        <span className="material-symbols-outlined text-[15px]">visibility</span>
                        <span>Preview</span>
                      </Link>

                      {/* Duplicate Button */}
                      <button
                        type="button"
                        id={`btn-duplicate-test-${t.id}`}
                        disabled={isDuplicating}
                        onClick={() => handleDuplicate(t.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-text-primary hover:border-primary hover:text-primary-text transition-colors disabled:opacity-50"
                        title="Create Draft Copy of this test"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {isDuplicating ? "sync" : "content_copy"}
                        </span>
                        <span>{isDuplicating ? "Copying..." : "Duplicate"}</span>
                      </button>

                      {/* Analytics Button (if attempts exist) */}
                      {t.attemptCount > 0 && (
                        <Link
                          href={`/admin/analytics/tests/${t.id}`}
                          id={`btn-analytics-test-${t.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-secondary hover:border-secondary transition-colors"
                          title="View student performance and item analysis"
                        >
                          <span className="material-symbols-outlined text-[15px]">monitoring</span>
                          <span>Analytics</span>
                        </Link>
                      )}
                    </div>

                    {/* Lifecycle Transitions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {t.status === "draft" && (
                        <button
                          type="button"
                          id={`btn-publish-test-${t.id}`}
                          disabled={isToggling}
                          onClick={() => handleUpdateStatus(t.id, "published")}
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-label-xs font-mono font-semibold text-text-inverse hover:bg-primary-text transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">publish</span>
                          <span>Publish</span>
                        </button>
                      )}

                      {t.status === "published" && (
                        <>
                          <button
                            type="button"
                            id={`btn-close-test-${t.id}`}
                            disabled={isToggling}
                            onClick={() => handleUpdateStatus(t.id, "closed")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-error/40 bg-error/10 px-2.5 text-label-xs font-mono text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">lock</span>
                            <span>Close</span>
                          </button>

                          <button
                            type="button"
                            id={`btn-archive-test-${t.id}`}
                            disabled={isToggling}
                            onClick={() => handleUpdateStatus(t.id, "archived")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">archive</span>
                            <span>Archive</span>
                          </button>
                        </>
                      )}

                      {t.status === "closed" && (
                        <>
                          <button
                            type="button"
                            id={`btn-reopen-test-${t.id}`}
                            disabled={isToggling}
                            onClick={() => handleUpdateStatus(t.id, "published")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-secondary/40 bg-secondary/10 px-2.5 text-label-xs font-mono text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">lock_open</span>
                            <span>Reopen</span>
                          </button>

                          <button
                            type="button"
                            id={`btn-archive-test-${t.id}`}
                            disabled={isToggling}
                            onClick={() => handleUpdateStatus(t.id, "archived")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">archive</span>
                            <span>Archive</span>
                          </button>
                        </>
                      )}

                      {t.status === "archived" && (
                        <button
                          type="button"
                          id={`btn-revert-draft-test-${t.id}`}
                          disabled={isToggling}
                          onClick={() => handleUpdateStatus(t.id, "draft")}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-high px-2.5 text-label-xs font-mono text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">unarchive</span>
                          <span>Revert to Draft</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 rounded-xl border border-border bg-surface text-center flex flex-col items-center justify-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-text-muted">
              quiz
            </span>
            <p className="text-title-sm font-semibold text-text-primary">
              No assessments match your filter criteria
            </p>
            <p className="text-body-sm text-text-muted max-w-md">
              Try adjusting your search terms, lifecycle status, or track filter to locate assessments.
            </p>
            {hasFilters ? (
              <button
                onClick={handleClearFilters}
                className="mt-2 text-label-xs font-mono text-primary hover:underline"
              >
                Reset all filters
              </button>
            ) : (
              <Link
                href="/admin/tests/new"
                className="mt-3 inline-flex items-center gap-2 bg-primary text-text-inverse px-4 py-2 rounded-lg text-body-sm font-semibold hover:bg-primary-text transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Build First Assessment
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

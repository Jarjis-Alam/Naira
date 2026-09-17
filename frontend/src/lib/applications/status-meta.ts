import type { ApplicationStatus } from "@/lib/applications/domain";

/**
 * Phase 19 — presentation metadata for application statuses.
 *
 * Purely visual: dot color, chip classes, and a one-line description used in
 * tooltips and pipeline legends. Domain truth lives in `domain.ts`.
 */
export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; dot: string; chip: string; description: string }
> = {
  INTERESTED: {
    label: "Interested",
    dot: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    description: "You are interested in applying.",
  },
  ELIGIBLE: {
    label: "Eligible",
    dot: "bg-teal-500",
    chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    description: "You meet the stated eligibility criteria.",
  },
  APPLIED: {
    label: "Applied",
    dot: "bg-indigo-500",
    chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    description: "Application submitted.",
  },
  ASSESSMENT: {
    label: "Assessment",
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    description: "Online assessment / test stage.",
  },
  SHORTLISTED: {
    label: "Shortlisted",
    dot: "bg-violet-500",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    description: "Shortlisted for interviews.",
  },
  INTERVIEW: {
    label: "Interview",
    dot: "bg-purple-500",
    chip: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    description: "Interview rounds in progress.",
  },
  OFFER: {
    label: "Offer",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    description: "Offer received.",
  },
  REJECTED: {
    label: "Rejected",
    dot: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    description: "Application was rejected.",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    dot: "bg-zinc-500",
    chip: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
    description: "You withdrew the application.",
  },
  CLOSED: {
    label: "Closed",
    dot: "bg-zinc-400",
    chip: "bg-zinc-400/15 text-zinc-600 dark:text-zinc-400",
    description: "Position closed or process ended without an outcome.",
  },
};

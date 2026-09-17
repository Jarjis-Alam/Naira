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
    dot: "bg-zinc-400",
    chip: "bg-white/5 text-zinc-300 border border-white/10",
    description: "You are interested in applying.",
  },
  ELIGIBLE: {
    label: "Eligible",
    dot: "bg-zinc-300",
    chip: "bg-white/10 text-zinc-200 border border-white/15",
    description: "You meet the stated eligibility criteria.",
  },
  APPLIED: {
    label: "Applied",
    dot: "bg-white",
    chip: "bg-white/10 text-white border border-white/20",
    description: "Application submitted.",
  },
  ASSESSMENT: {
    label: "Assessment",
    dot: "bg-zinc-200",
    chip: "bg-white/15 text-white border border-white/25",
    description: "Online assessment / test stage.",
  },
  SHORTLISTED: {
    label: "Shortlisted",
    dot: "bg-white",
    chip: "bg-white/15 text-white border border-white/30",
    description: "Shortlisted for interviews.",
  },
  INTERVIEW: {
    label: "Interview",
    dot: "bg-white",
    chip: "bg-white/20 text-white border border-white/35 font-semibold",
    description: "Interview rounds in progress.",
  },
  OFFER: {
    label: "Offer",
    dot: "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]",
    chip: "bg-white text-black font-bold border border-white",
    description: "Offer received.",
  },
  REJECTED: {
    label: "Rejected",
    dot: "bg-zinc-600",
    chip: "bg-zinc-800 text-zinc-400 border border-zinc-700",
    description: "Application was rejected.",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    dot: "bg-zinc-600",
    chip: "bg-zinc-800/60 text-zinc-500 border border-zinc-700/60",
    description: "You withdrew the application.",
  },
  CLOSED: {
    label: "Closed",
    dot: "bg-zinc-700",
    chip: "bg-zinc-900 text-zinc-500 border border-zinc-800",
    description: "Position closed or process ended without an outcome.",
  },
};

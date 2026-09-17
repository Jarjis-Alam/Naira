"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface UploadResult {
  ok: boolean;
  fileId: string | null;
  fileName: string;
  fileFormat: string | null;
  byteSize: number;
  pageCount: number | null;
  parseStatus: string;
  wordCount: number;
  warnings: string[];
  /** Server re-parsed a previously failed/pending record with the current parser. */
  retried?: boolean;
  reusedExisting?: boolean;
}

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  parsed: { label: "Parsed cleanly", tone: "text-secondary" },
  partial: { label: "Parsed with notes", tone: "text-tertiary" },
  failed: { label: "Could not be parsed", tone: "text-error" },
  pending: { label: "Retrying analysis…", tone: "text-tertiary" },
};;

export function ResumeUploadPanel({
  supportedFormats,
  maxUploadBytes,
  targetLabel,
  compact = false,
}: {
  supportedFormats: { format: string; supported: boolean; note: string }[];
  maxUploadBytes: number;
  targetLabel: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retriedBeforeRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [creating, setCreating] = useState(false);

  const maxMb = Math.round(maxUploadBytes / (1024 * 1024));

  function pickFile(selected: File | null) {
    setError(null);
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > maxUploadBytes) {
      setFile(null);
      setError(`This file is ${(selected.size / (1024 * 1024)).toFixed(1)} MB. The maximum supported size is ${maxMb} MB.`);
      return;
    }
    setFile(selected);
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose a resume file first.");
      return;
    }
    setBusy(true);
    setError(null);
    // A previous attempt may have failed for a server-side reason that no
    // longer applies; the backend re-parses such records, so the UI frames the
    // wait as a retry rather than promising a fresh parse.
    setRetrying(retriedBeforeRef.current);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/student/resume/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Remember the failure so the next attempt of this file is framed as a
        // retry — the backend will re-parse the stored failed record.
        if (data?.upload?.parseStatus === "failed") retriedBeforeRef.current = true;
        setError(data?.error || "This resume could not be read.");
        return;
      }
      setResult(data as UploadResult);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      setRetrying(false);
      retriedBeforeRef.current = false;
    }
  }

  async function handleCreateVariant() {
    if (!result?.fileId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/student/resume/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFileId: result.fileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not start the resume analysis.");
        return;
      }
      setFile(null);
      setResult(null);
      if (inputRef.current) inputRef.current.value = "";
      router.push(`/resume?variantId=${data.id}`);
      router.refresh();
    } catch {
      setError("Could not start the resume analysis.");
    } finally {
      setCreating(false);
    }
  }

  const status = result ? STATUS_COPY[result.parseStatus] ?? STATUS_COPY.parsed : null;

  return (
    <section id="resume-upload" className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 text-label-xs text-text-muted font-mono uppercase">
        <span className="material-symbols-outlined text-[18px]">upload_file</span>
        {compact ? "Add another resume" : "Upload resume"}
      </div>

      {!result && (
        <>
          <label
            htmlFor="resume-file-input"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-variant bg-surface-high/60 px-6 py-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[28px] text-text-muted">description</span>
            <span className="text-body-sm font-semibold text-text-primary">
              {file ? file.name : "Drop a text-based PDF, DOCX, or TXT"}
            </span>
            <span className="text-[11px] font-mono text-text-muted">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB selected`
                : `Maximum ${maxMb} MB. Scanned/image PDFs cannot be read as text.`}
            </span>
            <input
              ref={inputRef}
              id="resume-file-input"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={busy || !file}
              className="bg-primary text-text-inverse font-semibold text-body-sm px-5 py-2.5 rounded-lg hover:bg-primary-text transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              <span>{busy ? (retrying ? "Retrying analysis…" : "Reading document…") : "Analyse Resume"}</span>
              <span className="material-symbols-outlined text-[18px]">analytics</span>
            </button>
            {targetLabel && (
              <span className="text-[11px] font-mono text-text-muted">
                Target: <span className="text-text-secondary">{targetLabel}</span>
              </span>
            )}
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-body-sm font-semibold text-text-primary">{result.fileName}</span>
            <span className={`text-[11px] font-mono uppercase font-bold ${status?.tone ?? "text-text-muted"}`}>
              {status?.label}
            </span>
            {result.retried && result.ok && (
              <span className="text-[11px] font-mono text-text-muted">(re-parsed with the current engine)</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-text-muted">
            {result.fileFormat && <span>FORMAT {result.fileFormat.toUpperCase()}</span>}
            {result.pageCount !== null && <span>PAGES {result.pageCount}</span>}
            <span>WORDS {result.wordCount}</span>
          </div>

          {result.warnings.length > 0 && (
            <ul className="space-y-1">
              {result.warnings.map((warning, index) => (
                <li key={index} className="text-[12px] font-mono text-tertiary flex gap-2">
                  <span aria-hidden>⚠</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[12px] font-mono text-text-secondary">
            The document was stored privately. Next, Placement OS builds a structured model from it and runs the ATS
            analysis. Nothing in your document is rewritten without your approval.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreateVariant}
              disabled={creating}
              className="bg-primary text-text-inverse font-semibold text-body-sm px-5 py-2.5 rounded-lg hover:bg-primary-text transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              <span>{creating ? "Analysing…" : "Build structured resume"}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-[12px] font-mono text-text-muted hover:text-text-primary underline"
            >
              Choose a different file
            </button>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-border/60">
        <span className="text-[10px] font-mono uppercase text-text-muted font-bold block mb-2">
          Supported formats
        </span>
        <ul className="space-y-1">
          {supportedFormats.map((entry) => (
            <li key={entry.format} className="text-[12px] font-mono flex gap-2">
              <span className={entry.supported ? "text-secondary" : "text-error"}>{entry.supported ? "✓" : "✗"}</span>
              <span className="text-text-secondary">
                {entry.format}
                <span className="text-text-muted"> — {entry.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

"use client";

import React, { useEffect, useRef } from "react";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmationDialog Primitive
 *
 * Accessible confirmation modal replacing disruptive browser window.confirm().
 * Complies with WAI-ARIA alertdialog pattern:
 * - role="alertdialog"
 * - aria-modal="true"
 * - Keyboard Escape dismissal
 * - Focus trapped within modal bounds
 * - Restores focus on exit
 */
export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      // Focus cancel button by default for safety on destructive actions
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isLoading) {
          e.preventDefault();
          onCancel();
        }

        // Focus trap
        if (e.key === "Tab" && dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              last.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === last) {
              first.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0d0d10] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
              isDestructive
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-white/10 border-white/20 text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDestructive ? "warning" : "help"}
            </span>
          </div>
          <div className="space-y-1">
            <h3
              id="confirmation-dialog-title"
              className="text-base font-semibold text-white font-heading"
            >
              {title}
            </h3>
            <p
              id="confirmation-dialog-description"
              className="text-xs text-zinc-400 leading-relaxed"
            >
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-mono font-medium text-zinc-400 hover:text-white bg-transparent border border-zinc-800 rounded-full hover:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-mono font-semibold rounded-full transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
              isDestructive
                ? "bg-red-600 hover:bg-red-500 text-white shadow-sm"
                : "bg-white hover:bg-zinc-200 text-black shadow-sm"
            }`}
          >
            {isLoading && (
              <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

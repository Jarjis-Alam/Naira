"use client";

import React, { useState } from "react";

export interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  showText?: boolean;
}

/**
 * CopyButton Component
 *
 * Copies text to the user's clipboard via navigator.clipboard, with visual
 * checkmark feedback and polite screen reader status announcement.
 */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  className = "",
  showText = true,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback for restricted clipboard contexts
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently handle if clipboard permission is completely denied
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied to clipboard" : `${label} to clipboard`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full border transition-all cursor-pointer select-none ${
        copied
          ? "border-emerald-600/60 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-800 bg-[#121316] text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-[#18191d]"
      } ${className}`}
    >
      <span className="material-symbols-outlined text-[14px]">
        {copied ? "check" : "content_copy"}
      </span>
      {showText && <span>{copied ? copiedLabel : label}</span>}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}

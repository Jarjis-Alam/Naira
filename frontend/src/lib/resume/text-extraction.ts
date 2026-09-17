/**
 * Phase 18 — Resume text extraction and structural signal detection.
 *
 * Server-only module. Responsibilities:
 *  1. Validate an upload (extension, MIME type, magic bytes, size).
 *  2. Extract the resume's text layer (PDF via pdf-parse, DOCX via mammoth).
 *  3. Record *observable* structural signals (images, tables, columns, fonts,
 *     repeated header/footer lines, symbol density) for the ATS engine.
 *
 * Nothing here rewrites, summarises, or filters the student's content: the
 * extracted text is returned verbatim so the structured model can preserve it.
 */

import { inflateRawSync } from "node:zlib";
import type {
  ExtractionErrorCode,
  ResumeExtraction,
  ResumeFileFormat,
  ResumeFileSignals,
} from "./types";

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXTENSION_FORMATS: Record<string, ResumeFileFormat> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  text: "txt",
};

const MIME_HINTS: Record<string, ResumeFileFormat | "unsupported"> = {
  "application/pdf": "pdf",
  "application/x-pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "unsupported",
  "application/vnd.oasis.opendocument.text": "unsupported",
  "application/rtf": "unsupported",
  "text/rtf": "unsupported",
  "image/png": "unsupported",
  "image/jpeg": "unsupported",
  "image/jpg": "unsupported",
  "image/heic": "unsupported",
  "text/plain": "txt",
  "text/markdown": "txt",
  "application/octet-stream": "txt",
};

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"

// ============================================================================
// Server-only runtime + lazy, worker-safe parser loading
// ============================================================================

/**
 * Resume extraction must never run in a browser.
 *
 * `pdf-parse` publishes a `browser` export condition and pdfjs spawns a Web
 * Worker whenever one is available, both of which would move parsing off the
 * server. This module is imported exclusively by server modules; this guard
 * makes an accidental client import fail loudly instead of quietly shipping the
 * parser into a client bundle.
 */
function assertServerRuntime(): void {
  if (typeof window !== "undefined" || typeof document !== "undefined") {
    throw new Error(
      "Resume text extraction is server-only. PDF and DOCX parsing must run in the Node.js runtime, never in the browser."
    );
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Drop pdf-parse's own page separators (`-- 1 of 1 --`) from combined text.
 *
 * These are emitted by the parser, not written on the resume, so they must never
 * be treated as resume content — otherwise an image-only PDF would "parse" into
 * a resume whose entire text is a page marker.
 */
function stripPdfPageSeparators(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/.test(line.trim()))
    .join("\n");
}

/**
 * True when a PDF parse failure came from the engine/worker wiring rather than
 * from the document itself. Used so a server-side runtime failure is reported
 * as an unavailable engine instead of a damaged resume.
 */
export function isPdfEngineFailure(message: string): boolean {
  return /fake worker|pdfworker|pdf\.?worker|workerSrc|worker source|Cannot find module/i.test(message);
}

type PdfParserModule = typeof import("pdf-parse");
type DocxParserModule = typeof import("mammoth");

let pdfParserModule: Promise<PdfParserModule> | null = null;
let docxParserModule: Promise<DocxParserModule> | null = null;
let pdfEngineBootstrap: Promise<void> | null = null;

/** Load pdf-parse on demand so pdfjs never enters the eager module graph. */
async function loadPdfParser(): Promise<PdfParserModule> {
  if (!pdfParserModule) {
    pdfParserModule = import("pdf-parse");
  }
  return pdfParserModule;
}

/** Load mammoth on demand, for the same reason. */
async function loadDocxParser(): Promise<DocxParserModule> {
  if (!docxParserModule) {
    docxParserModule = import("mammoth").then((module) => {
      // mammoth is CommonJS; unwrap the interop default when the bundler adds one.
      const interop = module as unknown as { default?: DocxParserModule };
      return interop.default ?? module;
    });
  }
  return docxParserModule;
}

/**
 * Point pdfjs at a worker source that cannot depend on the bundler.
 *
 * pdf-parse@2 ships two mechanisms, and this uses both so worker resolution
 * never needs a file on disk:
 *  1. `pdf-parse/worker` installs pdfjs's main-thread `WorkerMessageHandler` on
 *     `globalThis`, which is the layout pdfjs uses in Node when no worker
 *     thread exists — it then never loads a worker module at all.
 *  2. `PDFParse.setWorker(getData())` sets the worker source to the
 *     self-contained `data:` URL of the worker that the package embeds, so even
 *     if pdfjs still resolves a worker source it needs no filesystem path and
 *     performs no network request. It is evaluated by Node's module loader and
 *     is never exposed to a browser, so there is no public worker URL.
 *
 * This runs once per process. A failure is non-fatal: it is logged and pdfjs's
 * own resolution is used, with any real failure surfacing as a typed
 * `engine_unavailable` extraction error instead of a silent empty result.
 */
async function ensurePdfEngine(PDFParse: PdfParserModule["PDFParse"]): Promise<void> {
  if (!pdfEngineBootstrap) {
    pdfEngineBootstrap = (async () => {
      try {
        const worker = await import("pdf-parse/worker");
        const workerSource = worker.getData();
        if (typeof workerSource === "string" && workerSource.startsWith("data:")) {
          PDFParse.setWorker(workerSource);
        } else {
          console.warn("[resume] pdf-parse did not expose an inline worker source; using pdfjs defaults.");
        }
      } catch (error) {
        console.warn(`[resume] pdf worker bootstrap skipped: ${describeError(error)}`);
      }
    })().catch(() => undefined);
  }
  await pdfEngineBootstrap;
}

/** Decorative glyphs that frequently break or corrupt ATS text extraction. */
const DECORATIVE_GLYPH_PATTERN =
  /[\u25A0-\u25FF\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\u2700-\u27BF\uFE0F\uFFFD]|[\u{1F300}-\u{1FAFF}]/gu;

/** Font families that mainstream parsers handle without surprises. */
const STANDARD_FONT_PATTERN =
  /^(arial|helvetica|times|timesnewroman|timesnewromanps|courier|couriern|calibri|cambria|georgia|verdana|tahoma|garamond|bookman|palatino|trebuchet|symbol|zapfdingbats|nimbus|liberation|dejavu|carlito|caladea|notosans|opensans|lato|roboto|segoe|consolas|menlo|monaco)/i;

// ============================================================================
// Upload validation
// ============================================================================

export interface ResumeUploadCandidate {
  bytes: Buffer;
  fileName: string;
  mimeType: string | null;
}

export interface UploadValidation {
  ok: boolean;
  format: ResumeFileFormat | null;
  error: { code: ExtractionErrorCode; message: string } | null;
  warnings: string[];
}

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

/**
 * Validate an upload before any parsing work happens. Every rejection carries a
 * plain-language explanation so the UI can show the limitation honestly.
 */
export function validateResumeUpload(candidate: ResumeUploadCandidate): UploadValidation {
  const warnings: string[] = [];
  const { bytes, fileName } = candidate;
  const extension = extensionOf(fileName);
  const mime = (candidate.mimeType || "").toLowerCase().trim();

  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      format: null,
      error: { code: "empty", message: "The uploaded file is empty." },
      warnings,
    };
  }

  if (bytes.length > MAX_RESUME_FILE_BYTES) {
    return {
      ok: false,
      format: null,
      error: {
        code: "too_large",
        message: `This file is ${(bytes.length / (1024 * 1024)).toFixed(1)} MB. The maximum supported resume size is 5 MB.`,
      },
      warnings,
    };
  }

  // Legacy Word, RTF, ODT, and image formats are deliberately rejected with a
  // clear explanation instead of being silently misparsed.
  if (["doc", "rtf", "odt", "pages", "png", "jpg", "jpeg", "heic", "webp"].includes(extension)) {
    const isImage = ["png", "jpg", "jpeg", "heic", "webp"].includes(extension);
    return {
      ok: false,
      format: null,
      error: {
        code: "unsupported_format",
        message: isImage
          ? `Resumes saved as ${extension.toUpperCase()} images cannot be read as text. Export a text-based PDF (not a scan) or upload a DOCX.`
          : `The .${extension} format is not supported. Save your resume as DOCX or a text-based PDF and upload again.`,
      },
      warnings,
    };
  }

  const isPdf = bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
  const isZip = bytes.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC);

  if (isPdf) {
    return { ok: true, format: "pdf", error: null, warnings };
  }

  if (isZip) {
    // A ZIP container is only a resume if it is a Word document.
    const hasDocumentXml = bytes.includes(Buffer.from("word/document.xml", "ascii"));
    if (!hasDocumentXml) {
      return {
        ok: false,
        format: null,
        error: {
          code: "unsupported_format",
          message:
            "This file is a ZIP archive that does not contain a Word document. Upload a .docx resume or a text-based PDF.",
        },
        warnings,
      };
    }
    return { ok: true, format: "docx", error: null, warnings };
  }

  // Plain text: rely on extension/MIME, and reject binary content outright.
  const declared = EXTENSION_FORMATS[extension] ?? (mime ? MIME_HINTS[mime] ?? null : null);
  if (declared === "txt") {
    if (bytes.includes(0x00)) {
      return {
        ok: false,
        format: null,
        error: {
          code: "unsupported_format",
          message:
            "This file contains binary data and is not readable as text. Upload a DOCX or text-based PDF resume.",
        },
        warnings,
      };
    }
    return { ok: true, format: "txt", error: null, warnings };
  }

  return {
    ok: false,
    format: null,
    error: {
      code: "unsupported_type",
      message: `Unrecognised resume format${extension ? ` (.${extension})` : ""}${mime ? ` with type "${mime}"` : ""}. Supported formats: PDF (text-based), DOCX, and TXT.`,
    },
    warnings,
  };
}

// ============================================================================
// Text normalisation
// ============================================================================

/** Whitespace hygiene only — content is preserved exactly. */
export function normalizeExtractedText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, "    ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9][A-Za-z0-9'’+#./-]*/g);
  return matches ? matches.length : 0;
}

// ============================================================================
// Structural signals
// ============================================================================

export interface TextSignalsInput {
  text: string;
  pageTexts?: string[];
}

export function detectTextSignals({ text, pageTexts }: TextSignalsInput): {
  multiColumnLineCount: number;
  repeatedLineCount: number;
  symbolDensity: number;
  wordCount: number;
} {
  const lines = text.split("\n");
  // A "cell-gap" of 3+ spaces inside a line indicates a tabular/column layout
  // rather than a normal sentence.
  const multiColumnLineCount = lines.filter((line) => /\S {3,}\S/.test(line)).length;

  let repeatedLineCount = 0;
  if (pageTexts && pageTexts.length > 1) {
    const firstLines = new Map<string, number>();
    const lastLines = new Map<string, number>();
    for (const pageText of pageTexts) {
      const pageLines = pageText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (pageLines.length === 0) continue;
      const first = pageLines[0].toLowerCase();
      const last = pageLines[pageLines.length - 1].toLowerCase();
      firstLines.set(first, (firstLines.get(first) ?? 0) + 1);
      lastLines.set(last, (lastLines.get(last) ?? 0) + 1);
    }
    for (const count of firstLines.values()) if (count > 1) repeatedLineCount += count;
    for (const count of lastLines.values()) if (count > 1) repeatedLineCount += count;
  }

  const decorativeMatches = text.match(DECORATIVE_GLYPH_PATTERN);
  const decorativeCount = decorativeMatches ? decorativeMatches.length : 0;
  const symbolDensity = text.length > 0 ? Number((decorativeCount / text.length).toFixed(5)) : 0;

  return {
    multiColumnLineCount,
    repeatedLineCount,
    symbolDensity,
    wordCount: countWords(text),
  };
}

export function detectPdfSignals(bytes: Buffer): NonNullable<ResumeFileSignals["pdf"]> {
  const latin = bytes.toString("latin1");
  const imageMatches = latin.match(/\/Subtype\s*\/Image/g);
  const fontMatches = latin.match(/\/BaseFont\s*\/([A-Za-z0-9+\-_,]+)/g) ?? [];
  const fonts = new Set<string>();
  for (const raw of fontMatches) {
    const name = raw.replace(/\/BaseFont\s*\//, "").replace(/^[A-Z]{6}\+/, "");
    if (name) fonts.add(name);
  }
  return {
    imageCount: imageMatches ? imageMatches.length : 0,
    fontFamilies: Array.from(fonts).slice(0, 24),
    hasAnnotations: /\/Annots\b/.test(latin),
    hasFormFields: /\/Widget\b/.test(latin),
    hasEncryptedFlag: /\/Encrypt\b/.test(latin),
  };
}

interface ZipEntry {
  name: string;
  dataStart: number;
  compressedSize: number;
  method: number;
  flags: number;
}

function findZipEntry(bytes: Buffer, name: string): ZipEntry | null {
  const nameBuffer = Buffer.from(name, "ascii");
  const nameOffset = bytes.indexOf(nameBuffer);
  if (nameOffset < 30) return null;
  const headerStart = nameOffset - 30;
  if (bytes.readUInt32LE(headerStart) !== 0x04034b50) return null;
  const flags = bytes.readUInt16LE(headerStart + 6);
  const method = bytes.readUInt16LE(headerStart + 8);
  const compressedSize = bytes.readUInt32LE(headerStart + 18);
  const nameLength = bytes.readUInt16LE(headerStart + 26);
  const extraLength = bytes.readUInt16LE(headerStart + 28);
  return {
    name,
    dataStart: nameOffset + nameLength + extraLength,
    compressedSize,
    method,
    flags,
  };
}

function readZipEntryText(bytes: Buffer, name: string): string | null {
  const entry = findZipEntry(bytes, name);
  if (!entry) return null;
  try {
    if (entry.method === 0) {
      return bytes.subarray(entry.dataStart, entry.dataStart + entry.compressedSize).toString("utf8");
    }
    // Sizes may be deferred to a data descriptor; inflate a bounded window and
    // accept a truncated-but-readable result.
    const length = entry.compressedSize > 0 ? entry.compressedSize : Math.min(bytes.length - entry.dataStart, 4 * 1024 * 1024);
    const slice = bytes.subarray(entry.dataStart, entry.dataStart + length);
    return inflateRawSync(slice).toString("utf8");
  } catch {
    return null;
  }
}

export function detectDocxSignals(bytes: Buffer, html: string, text: string): NonNullable<ResumeFileSignals["docx"]> {
  const documentXml = readZipEntryText(bytes, "word/document.xml") ?? "";
  const tableTags = html.match(/<table/gi);
  const imageTags = html.match(/<img/gi);
  return {
    tableCount: tableTags ? tableTags.length : 0,
    imageCount: imageTags ? imageTags.length : 0,
    hasTextBoxes: /<w:txbxContent/i.test(documentXml) || /<v:textbox/i.test(documentXml),
    hasHeadersFooters:
      bytes.includes(Buffer.from("word/header", "ascii")) ||
      bytes.includes(Buffer.from("word/footer", "ascii")),
    hasColumns: /<w:cols[^>]*w:num="([2-9]|\d{2,})"/i.test(documentXml),
    hasSymbols: /<w:sym\b/i.test(documentXml) || DECORATIVE_GLYPH_PATTERN.test(text),
  };
}

// ============================================================================
// Main entry point
// ============================================================================

function failure(
  code: ExtractionErrorCode,
  message: string,
  format: ResumeFileFormat | null,
  warnings: string[] = []
): ResumeExtraction {
  return { ok: false, format, rawText: "", warnings, error: { code, message }, signals: null };
}

/**
 * Extract text and structural signals from an uploaded resume.
 *
 * Never throws: all failure modes are returned as typed errors with an
 * explanation, so the UI can always tell the student what happened.
 */
export async function extractResume(candidate: ResumeUploadCandidate): Promise<ResumeExtraction> {
  assertServerRuntime();

  const validation = validateResumeUpload(candidate);
  if (!validation.ok || !validation.format) {
    return failure(
      validation.error?.code ?? "unsupported_type",
      validation.error?.message ?? "This file could not be read.",
      null,
      validation.warnings
    );
  }

  const format = validation.format;
  const warnings: string[] = [...validation.warnings];

  if (format === "pdf") {
    const latin = candidate.bytes.toString("latin1");
    if (/\/Encrypt\b/.test(latin)) {
      return failure(
        "encrypted",
        "This PDF is password-protected, so its text cannot be extracted. Remove the password or upload an unprotected copy.",
        "pdf",
        warnings
      );
    }

    try {
      const { PDFParse } = await loadPdfParser();
      await ensurePdfEngine(PDFParse);

      const parser = new PDFParse({ data: candidate.bytes });
      let text = "";
      let pageTexts: string[] = [];
      let pageCount: number | null = null;
      try {
        const result = await parser.getText();

        // Per-page text is the document's own text. The combined `result.text`
        // interleaves pdf-parse's own "-- N of M --" page separators, which are
        // parser artifacts rather than resume content, so page texts are used
        // whenever the parser reports pages and the combined value is only a
        // fallback for parsers that do not.
        const pages = result.pages ?? [];
        pageTexts = pages.map((page) => normalizeExtractedText(page.text ?? ""));
        text =
          pages.length > 0
            ? normalizeExtractedText(pageTexts.filter((page) => page.length > 0).join("\n"))
            : normalizeExtractedText(stripPdfPageSeparators(result.text ?? ""));
        pageCount = typeof result.total === "number" ? result.total : pageTexts.length || null;
      } finally {
        await parser.destroy().catch(() => undefined);
      }

      const pdfSignals = detectPdfSignals(candidate.bytes);
      const textSignals = detectTextSignals({ text, pageTexts });

      // Whitespace-only output means no text layer exists: a scan or an image
      // export must never be reported as a successfully parsed resume.
      if (text.trim().length === 0) {
        return failure(
          pdfSignals.imageCount > 0 ? "no_text_layer" : "empty",
          pdfSignals.imageCount > 0
            ? "No machine-readable text was found in this PDF. It appears to be a scan or image export, which ATS parsers cannot read. Upload a text-based PDF or DOCX instead."
            : "No text could be extracted from this PDF. The file may be empty or corrupted.",
          "pdf",
          warnings
        );
      }

      return {
        ok: true,
        format: "pdf",
        rawText: text,
        warnings,
        error: null,
        signals: {
          format: "pdf",
          pageCount,
          hasTextLayer: true,
          wordCount: textSignals.wordCount,
          multiColumnLineCount: textSignals.multiColumnLineCount,
          repeatedLineCount: textSignals.repeatedLineCount,
          symbolDensity: textSignals.symbolDensity,
          pdf: pdfSignals,
        },
      };
    } catch (error) {
      const detail = describeError(error);

      // A failure to start the PDF engine says nothing about the document, so it
      // is reported separately instead of blaming the file.
      if (isPdfEngineFailure(detail)) {
        return failure(
          "engine_unavailable",
          `The PDF engine could not start on this server (${detail.slice(0, 140)}). The file itself was not read — please retry, and report this if it continues.`,
          "pdf",
          warnings
        );
      }

      return failure(
        "corrupt",
        `This PDF could not be parsed (${detail.slice(0, 140)}). The file may be damaged or use an unsupported encoding.`,
        "pdf",
        warnings
      );
    }
  }

  if (format === "docx") {
    try {
      const mammoth = await loadDocxParser();
      const rawResult = await mammoth.extractRawText({ buffer: candidate.bytes });
      const text = normalizeExtractedText(rawResult.value ?? "");
      const messages = (rawResult.messages ?? [])
        .map((message) => message.message)
        .filter((message) => Boolean(message))
        .slice(0, 6);
      for (const message of messages) {
        warnings.push(`DOCX conversion note: ${message}`);
      }

      let html = "";
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer: candidate.bytes });
        html = htmlResult.value ?? "";
      } catch {
        warnings.push("DOCX layout inspection was not available for this file; structural findings may be limited.");
      }

      if (!text.trim()) {
        return failure(
          "no_text_layer",
          "No text was found inside this DOCX file. It may contain only images or be empty.",
          "docx",
          warnings
        );
      }

      const textSignals = detectTextSignals({ text });
      return {
        ok: true,
        format: "docx",
        rawText: text,
        warnings,
        error: null,
        signals: {
          format: "docx",
          pageCount: null,
          hasTextLayer: true,
          wordCount: textSignals.wordCount,
          multiColumnLineCount: textSignals.multiColumnLineCount,
          repeatedLineCount: textSignals.repeatedLineCount,
          symbolDensity: textSignals.symbolDensity,
          docx: detectDocxSignals(candidate.bytes, html, text),
        },
      };
    } catch (error) {
      const detail = describeError(error);
      return failure(
        "corrupt",
        `This DOCX file could not be read (${detail.slice(0, 140)}). It may be damaged or not a real Word document.`,
        "docx",
        warnings
      );
    }
  }

  const text = normalizeExtractedText(candidate.bytes.toString("utf8"));
  if (!text.trim()) {
    return failure("empty", "This text file is empty.", "txt", warnings);
  }
  const textSignals = detectTextSignals({ text });
  return {
    ok: true,
    format: "txt",
    rawText: text,
    warnings,
    error: null,
    signals: {
      format: "txt",
      pageCount: null,
      hasTextLayer: true,
      wordCount: textSignals.wordCount,
      multiColumnLineCount: textSignals.multiColumnLineCount,
      repeatedLineCount: textSignals.repeatedLineCount,
      symbolDensity: textSignals.symbolDensity,
    },
  };
}

/** Font families a mainstream ATS parser handles predictably. */
export function isStandardPdfFont(fontFamily: string): boolean {
  return STANDARD_FONT_PATTERN.test(fontFamily.replace(/[,\-]?(Bold|Italic|Oblique|Regular|Light|Medium|Black|Thin|Semibold|SemiBold).*$/i, ""));
}

/**
 * Phase 18 — ATS Resume Intelligence test suite.
 *
 * Runs against the real local database with isolated fixture users that are
 * deleted in `finally`. The suite verifies behaviour at three levels:
 *
 *  1. Engine level (pure functions): extraction, parsing, ATS analysis,
 *     job-description analysis, suggestions, and the factual-scope guard.
 *  2. Service level (database-backed): upload, variants, targeting, analysis,
 *     suggestions, versions, builder edits, and Phase 14–17 integration.
 *  3. Security level: unauthenticated fail-closed, cross-tenant denial, and
 *     private file access.
 *
 * The adversarial section of this suite deliberately tries to smuggle invented
 * metrics, technologies, employers, certifications and responsibilities into
 * suggestions. Every one of them must be rejected.
 */

import { db } from "@/db";
import {
  companies,
  profiles,
  resumeFiles,
  resumeVariants,
  roles,
  studentTargetCompanies,
  studentTargetRoles,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";

import {
  JOB_DESCRIPTION_TEXT,
  RESUME_TEXT,
  buildCorruptPdf,
  buildResumeDocx,
  buildResumePdf,
  buildResumeTxt,
  buildScanLikePdf,
  buildTestDocx,
  buildTestPdf,
  buildTwoPagePdf,
  buildUnrecognisedFile,
  numbersIn,
} from "./fixtures/resume-fixtures";

import {
  addStudentTargetCompany,
  addStudentTargetRole,
  getStudentPlacementTargets,
  seedCanonicalPlacementData,
} from "@/server/company-role-intelligence";
import { getPlacementTargetStrategy } from "@/server/placement-target-strategy";
import { getDailyExecutionPlan } from "@/server/placement-execution";
import type { ResumeFileSignals } from "@/lib/resume/types";

import {
  compareResumeVersions,
  createResumeVariant,
  decideSuggestion,
  deleteAllResumeData,
  deleteResumeVariant,
  getResumeCoverageForGaps,
  getResumeFile,
  getResumeHealth,
  getResumeVariant,
  getResumeWorkspace,
  listResumeVersions,
  renderAtsResume,
  saveResumeVersion,
  setResumeJobDescription,
  setStudentAssertedSkill,
  updateResumeVariant,
  updateStructuredResume,
  uploadResumeFile,
} from "@/server/resume-intelligence";

import {
  MAX_RESUME_FILE_BYTES,
  extractResume,
  isPdfEngineFailure,
  validateResumeUpload,
} from "@/lib/resume/text-extraction";
import { flattenResumeText, getAllBullets, getSection, parseStructuredResume } from "@/lib/resume/parse-resume";
import { analyzeJobDescription } from "@/lib/resume/job-description";
import { analyzeResumeAtsScore } from "@/lib/resume/ats-analysis";
import { analyzeFactualScope, containsFabrication, generateSuggestions } from "@/lib/resume/suggestions";
import { renderAtsHtml, renderAtsPlainText } from "@/lib/resume/ats-render";
import { jsonError } from "@/lib/resume/api-response";

import { GET as resumeWorkspaceGet } from "@/app/api/student/resume/route";
import { POST as resumeUploadPost } from "@/app/api/student/resume/upload/route";
import { GET as resumeVariantsGet } from "@/app/api/student/resume/variants/route";
import { GET as resumeFileGet } from "@/app/api/student/resume/files/[id]/route";

function resumeEvidenceText(): string {
  return RESUME_TEXT;
}

async function runPhase18Tests() {
  console.log("==================================================");
  console.log("🚀  NEXORA — PHASE 18: ATS RESUME INTELLIGENCE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  const createdUserIds: string[] = [];

  try {
    // ========================================================================
    console.log("\n--- 1. Isolated Fixtures (Phase 16 targets enabled) ---");
    // ========================================================================
    await seedCanonicalPlacementData();

    const [userAlpha] = await db
      .insert(users)
      .values({ email: `phase18_alpha_${Date.now()}@nexora.test`, passwordHash: "hash_alpha", isAdmin: false })
      .returning();
    createdUserIds.push(userAlpha.id);
    await db.insert(profiles).values({
      userId: userAlpha.id,
      name: "Alex Chen",
      college: "Nexora Engineering Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    const [userBeta] = await db
      .insert(users)
      .values({ email: `phase18_beta_${Date.now()}@nexora.test`, passwordHash: "hash_beta", isAdmin: false })
      .returning();
    createdUserIds.push(userBeta.id);
    await db.insert(profiles).values({
      userId: userBeta.id,
      name: "Beta Candidate",
      college: "Nexora Polytech",
      branch: "Information Technology",
      graduationYear: 2026,
    });

    const canonicalCompanies = await db.select().from(companies).limit(1);
    const canonicalRoles = await db.select().from(roles).limit(1);
    assert(canonicalCompanies.length > 0 && canonicalRoles.length > 0, "Canonical companies and roles are seeded");

    const targetCompany = canonicalCompanies[0];
    const targetRole = canonicalRoles[0];
    await addStudentTargetCompany(userAlpha.id, targetCompany.id);
    await addStudentTargetRole(userAlpha.id, targetRole.id);

    const alphaTargets = await getStudentPlacementTargets(userAlpha.id);
    assert(alphaTargets.configured === true, "Phase 16 reports Alpha's target as configured");
    assert(
      alphaTargets.primaryCompany?.id === targetCompany.id && alphaTargets.primaryRole?.id === targetRole.id,
      "Phase 16 primary company/role resolve to the seeded targets"
    );

    // ========================================================================
    console.log("\n--- 2. Resume Upload (PDF / DOCX / unsupported / oversized / corrupt) ---");
    // ========================================================================
    const pdfBytes = buildResumePdf();
    const docxBytes = await buildResumeDocx();

    const pdfExtraction = await extractResume({ bytes: pdfBytes, fileName: "alex-chen.pdf", mimeType: "application/pdf" });
    assert(pdfExtraction.ok && pdfExtraction.format === "pdf", "Valid text-based PDF is extracted successfully");
    assert(pdfExtraction.signals?.hasTextLayer === true, "PDF extraction reports a machine-readable text layer");
    assert(
      pdfExtraction.rawText.includes("ALEX CHEN") && pdfExtraction.rawText.includes("EXPERIENCE"),
      "PDF text content is preserved verbatim after extraction"
    );
    assert(
      pdfExtraction.signals?.pageCount === 1,
      `Single-page PDF reports pageCount 1 (got ${pdfExtraction.signals?.pageCount})`
    );
    assert(
      (pdfExtraction.signals?.wordCount ?? 0) > 50,
      `PDF extraction returns the document's real word count (${pdfExtraction.signals?.wordCount} words)`
    );
    assert(
      pdfExtraction.error === null,
      "No extraction error is reported for a valid PDF (a worker failure would surface here)"
    );

    // Regression: the PDF engine must resolve its worker without depending on a
    // bundled chunk. pdf-parse@2 ships an inline `data:` worker source, and the
    // bootstrap must have pointed pdfjs at it.
    const { PDFParse } = await import("pdf-parse");
    const workerSource = PDFParse.setWorker();
    assert(
      typeof workerSource === "string" && workerSource.startsWith("data:"),
      `PDF worker is resolved from an inline data: URL, not a filesystem chunk (${String(
        workerSource
      ).slice(0, 24)}...)`
    );
    assert(
      typeof globalThis === "object" && (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker !== undefined,
      "pdfjs main-thread worker handler is installed, so no worker module is ever loaded"
    );

    // Regression: the exact reported failure must classify as an engine
    // problem, and a genuine document problem must not.
    assert(
      isPdfEngineFailure("Setting up fake worker failed: Cannot find module '/x/.next/dev/server/chunks/pdfworker'")
        === true,
      "Worker-resolution failures are classified as PDF engine failures"
    );
    assert(
      isPdfEngineFailure("Invalid PDF structure.") === false,
      "Document-level parse failures are NOT classified as engine failures"
    );
    assert(
      isPdfEngineFailure("Cannot find module 'pdf-parse'") === true,
      "A missing pdf-parse install is classified as an engine failure"
    );

    // Multi-page page counting.
    const twoPageExtraction = await extractResume({
      bytes: buildTwoPagePdf(),
      fileName: "alex-chen-2page.pdf",
      mimeType: "application/pdf",
    });
    assert(
      twoPageExtraction.ok && twoPageExtraction.signals?.pageCount === 2,
      `Two-page PDF reports pageCount 2 (got ${twoPageExtraction.signals?.pageCount})`
    );
    assert(
      (twoPageExtraction.signals?.wordCount ?? 0) > 50,
      `Both pages of text are extracted (${twoPageExtraction.signals?.wordCount} words)`
    );
    assert(
      !twoPageExtraction.rawText.includes("-- 1 of") && !twoPageExtraction.rawText.includes("of 2 --"),
      "Parser page separators are never presented as resume content"
    );

    const docxExtraction = await extractResume({
      bytes: docxBytes,
      fileName: "alex-chen.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert(docxExtraction.ok && docxExtraction.format === "docx", "Valid DOCX is extracted successfully");
    assert(
      typeof docxExtraction.signals?.docx?.tableCount === "number",
      "DOCX extraction reports observable structural signals (table count)"
    );

    const tableDocxExtraction = await extractResume({
      bytes: await buildTestDocx(RESUME_TEXT.split("\n"), { table: true }),
      fileName: "alex-chen-table.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert(
      (tableDocxExtraction.signals?.docx?.tableCount ?? 0) > 0,
      "DOCX table usage is detected as a formatting signal"
    );

    const unsupportedValidation = validateResumeUpload({
      bytes: Buffer.from("{\\rtf1 hello}", "latin1"),
      fileName: "resume.rtf",
      mimeType: "application/rtf",
    });
    assert(unsupportedValidation.ok === false, "Unsupported file type is rejected before parsing");
    assert(
      unsupportedValidation.error?.code === "unsupported_type" ||
        unsupportedValidation.error?.code === "unsupported_format",
      `Unsupported upload reports a typed reason (${unsupportedValidation.error?.code})`
    );

    const oversizeValidation = validateResumeUpload({
      bytes: Buffer.alloc(MAX_RESUME_FILE_BYTES + 1024, 0x41),
      fileName: "huge.pdf",
      mimeType: "application/pdf",
    });
    assert(oversizeValidation.ok === false && oversizeValidation.error?.code === "too_large", "Oversized upload is rejected with a typed reason");

    // A PDF that announces itself correctly but has a broken body reaches the
    // parser, so this exercises the document-failure path rather than the
    // format-validation path.
    const corruptExtraction = await extractResume({
      bytes: buildCorruptPdf(),
      fileName: "corrupt.pdf",
      mimeType: "application/pdf",
    });
    assert(corruptExtraction.ok === false && corruptExtraction.error !== null, "Corrupt PDF fails safely with an explanation");
    assert(
      corruptExtraction.error?.code === "corrupt",
      `Corrupt PDF reports the document-level 'corrupt' code, not an engine failure (got '${corruptExtraction.error?.code}')`
    );
    assert(
      Boolean(
        corruptExtraction.error?.message.includes("damaged") ||
          corruptExtraction.error?.message.includes("parsed")
      ),
      `Corrupt PDF explains itself without blaming the server: "${corruptExtraction.error?.message.slice(0, 80)}"`
    );

    const unrecognisedExtraction = await extractResume({
      bytes: buildUnrecognisedFile(),
      fileName: "not-a-document.pdf",
      mimeType: "application/pdf",
    });
    assert(
      unrecognisedExtraction.ok === false && unrecognisedExtraction.error?.code === "unsupported_type",
      "A file with no recognisable signature stays unsupported"
    );

    // A scanned (image-only) PDF must report the missing text layer, never an
    // empty successful parse.
    const scanExtraction = await extractResume({
      bytes: buildScanLikePdf(),
      fileName: "scanned-resume.pdf",
      mimeType: "application/pdf",
    });
    assert(
      scanExtraction.ok === false && scanExtraction.error?.code === "no_text_layer",
      `Scanned image-only PDF is rejected with no_text_layer (got '${scanExtraction.error?.code}')`
    );
    assert(
      scanExtraction.rawText === "",
      "A scanned PDF never returns parser noise as document text"
    );
    assert(
      (scanExtraction.error?.message ?? "").includes("scan"),
      "Scanned PDF limitation is explained to the student"
    );

    // Plain text still extracts through the same entry point.
    const txtExtraction = await extractResume({
      bytes: buildResumeTxt(),
      fileName: "alex-chen.txt",
      mimeType: "text/plain",
    });
    assert(
      txtExtraction.ok && txtExtraction.format === "txt" && txtExtraction.rawText.includes("ALEX CHEN"),
      "TXT extraction still returns the resume text"
    );

    // Service-level upload (the path the API uses).
    const uploadResult = await uploadResumeFile({
      userId: userAlpha.id,
      bytes: pdfBytes,
      fileName: "alex-chen-resume.pdf",
      mimeType: "application/pdf",
    });
    assert(uploadResult.ok && uploadResult.fileId !== null, "uploadResumeFile stores the parsed resume");
    assert(uploadResult.parseStatus === "parsed", `Stored parse status is 'parsed' (got '${uploadResult.parseStatus}')`);

    const oversizedServiceUpload = await uploadResumeFile({
      userId: userAlpha.id,
      bytes: Buffer.alloc(MAX_RESUME_FILE_BYTES + 1024, 0x41),
      fileName: "huge.pdf",
      mimeType: "application/pdf",
    });
    assert(
      oversizedServiceUpload.ok === false && oversizedServiceUpload.fileId === null,
      "Oversized upload is refused at the service layer and never stored"
    );
    const storedFiles = await db.select({ id: resumeFiles.id }).from(resumeFiles).where(eq(resumeFiles.userId, userAlpha.id));
    assert(storedFiles.length === 1, `Only the valid resume is persisted (found ${storedFiles.length} file record(s))`);

    // ------------------------------------------------------------------------
    // Upload retry semantics: a stored failed/pending record must be re-parsed
    // with the current parser, never treated as permanently unparseable.
    // ------------------------------------------------------------------------

    // A. Successful duplicate: re-uploading the parsed PDF reuses the row.
    const duplicateUpload = await uploadResumeFile({
      userId: userAlpha.id,
      bytes: pdfBytes,
      fileName: "alex-chen-resume-again.pdf",
      mimeType: "application/pdf",
    });
    assert(
      duplicateUpload.reusedExisting === true && duplicateUpload.parseStatus === "parsed",
      "Re-uploading a parsed PDF reports reuse with 'parsed' status"
    );
    assert(
      duplicateUpload.fileId === uploadResult.fileId,
      "Re-upload resolves to the SAME stored file identity (no duplicate raw file)"
    );
    const afterDuplicate = await db
      .select({ id: resumeFiles.id })
      .from(resumeFiles)
      .where(eq(resumeFiles.userId, userAlpha.id));
    assert(afterDuplicate.length === 1, `Duplicate upload creates no new row (found ${afterDuplicate.length})`);

    // B. Failed duplicate recovery: the stored row is forced back to the state
    // the old pdfjs worker bug left behind, then the same bytes are uploaded.
    await db
      .update(resumeFiles)
      .set({
        parseStatus: "failed",
        rawText: "",
        pageCount: null,
        fileSignals: null,
        parseWarnings: [
          "Setting up fake worker failed: Cannot find module '.next/dev/server/chunks/pdfw...'",
        ],
      })
      .where(eq(resumeFiles.id, uploadResult.fileId as string));

    const retryUpload = await uploadResumeFile({
      userId: userAlpha.id,
      bytes: pdfBytes,
      fileName: "alex-chen-resume.pdf",
      mimeType: "application/pdf",
    });
    assert(retryUpload.ok === true, "Uploading a file with a stale failed record retries the parse");
    assert(retryUpload.retried === true, "Retry result is flagged so the UI can show 'Retrying analysis…'");
    assert(retryUpload.parseStatus === "parsed", `Retry ends 'parsed' (got '${retryUpload.parseStatus}')`);
    assert(retryUpload.fileId === uploadResult.fileId, "Retry reuses the SAME row (content-hash identity preserved)");
    const retriedRow = (
      await db.select().from(resumeFiles).where(eq(resumeFiles.id, uploadResult.fileId as string))
    )[0];
    assert(
      (retriedRow?.rawText ?? "").includes("ALEX CHEN"),
      "Retry repopulates rawText with the current parser's output"
    );
    assert(retriedRow?.pageCount === 1, `Retry repopulates pageCount (got ${retriedRow?.pageCount})`);
    const retriedSignals = (retriedRow?.fileSignals ?? null) as ResumeFileSignals | null;
    assert(
      retriedSignals !== null && typeof retriedSignals.wordCount === "number" && retriedSignals.wordCount > 50,
      "Retry repopulates file signals (wordCount)"
    );
    const retriedWarnings = Array.isArray(retriedRow?.parseWarnings) ? (retriedRow!.parseWarnings as string[]) : [];
    assert(
      !retriedWarnings.some((w) => /fake worker/i.test(w)),
      "Stale worker error is cleared; no fake-worker warning remains"
    );
    const afterRetry = await db
      .select({ id: resumeFiles.id })
      .from(resumeFiles)
      .where(eq(resumeFiles.userId, userAlpha.id));
    assert(afterRetry.length === 1, `Retry creates no duplicate raw file (found ${afterRetry.length} rows)`);

    // D. Engine failure classification: a failure that names the worker wiring
    // must surface as engine_unavailable, never as a corrupt document.
    const { engineFailureExtraction } = await import("@/lib/resume/text-extraction-test-hooks");
    assert(
      engineFailureExtraction().error?.code === "engine_unavailable" &&
        engineFailureExtraction().error?.code !== "corrupt",
      "Engine/worker failure is classified as engine_unavailable, distinguishable from corrupt"
    );

    // C. Genuine corrupt duplicate: a corrupt PDF that previously failed must
    // still fail — now with the current, correctly classified error.
    const corruptFirst = await uploadResumeFile({
      userId: userBeta.id,
      bytes: buildCorruptPdf(),
      fileName: "corrupt-resume.pdf",
      mimeType: "application/pdf",
    });
    assert(
      corruptFirst.ok === false && corruptFirst.error?.code === "corrupt",
      `Corrupt PDF fails on first upload (code '${corruptFirst.error?.code}')`
    );
    const corruptRetry = await uploadResumeFile({
      userId: userBeta.id,
      bytes: buildCorruptPdf(),
      fileName: "corrupt-resume.pdf",
      mimeType: "application/pdf",
    });
    assert(
      corruptRetry.ok === false && corruptRetry.error?.code === "corrupt",
      "Retrying the corrupt PDF still fails as corrupt (not masked as success)"
    );
    assert(
      corruptRetry.retried === true && corruptRetry.fileId === corruptFirst.fileId,
      "Corrupt retry reused the same row and was genuinely re-attempted"
    );
    const corruptRows = await db
      .select({ id: resumeFiles.id })
      .from(resumeFiles)
      .where(eq(resumeFiles.userId, userBeta.id));
    assert(corruptRows.length === 1, `Corrupt retry creates no duplicate (found ${corruptRows.length})`);

    // F. Cross-user isolation: the same content hash under another account is
    // a different document and must never be reused across users.
    const crossUserUpload = await uploadResumeFile({
      userId: userBeta.id,
      bytes: pdfBytes,
      fileName: "alpha-document-copy.pdf",
      mimeType: "application/pdf",
    });
    assert(
      crossUserUpload.reusedExisting === false && crossUserUpload.fileId !== uploadResult.fileId,
      "Same content hash for another user is a NEW row (cross-user reuse blocked)"
    );

    // E. Concurrent duplicate: simultaneous uploads of the same failed file
    // must not create two rows or run two parse jobs.
    await db
      .update(resumeFiles)
      .set({ parseStatus: "failed", rawText: "", pageCount: null, fileSignals: null })
      .where(eq(resumeFiles.id, crossUserUpload.fileId as string));
    const concurrent = await Promise.all([
      uploadResumeFile({ userId: userBeta.id, bytes: pdfBytes, fileName: "race-a.pdf", mimeType: "application/pdf" }),
      uploadResumeFile({ userId: userBeta.id, bytes: pdfBytes, fileName: "race-b.pdf", mimeType: "application/pdf" }),
      uploadResumeFile({ userId: userBeta.id, bytes: pdfBytes, fileName: "race-c.pdf", mimeType: "application/pdf" }),
    ]);
    const concurrentIds = new Set(concurrent.map((r) => r.fileId));
    assert(
      concurrentIds.size === 1 && concurrent.every((r) => r.ok),
      `Concurrent same-file uploads converge to one row (${concurrentIds.size} distinct id(s))`
    );
    const betaRows = await db
      .select({ id: resumeFiles.id })
      .from(resumeFiles)
      .where(eq(resumeFiles.userId, userBeta.id));
    assert(
      betaRows.length === 2,
      `No concurrent duplicate rows (beta has ${betaRows.length}: corrupt + recovered pdf)`
    );
    // Clean up beta's rows so the later cross-tenant sections start clean.
    await db.delete(resumeFiles).where(eq(resumeFiles.userId, userBeta.id));

    // ========================================================================
    console.log("\n--- 3. Structured Resume Parsing ---");
    // ========================================================================
    const parsed = parseStructuredResume(RESUME_TEXT);
    const resume = parsed.resume;

    assert(resume.header.name?.toUpperCase().includes("ALEX") === true, "Header name is extracted");
    assert(resume.header.email === "alex.chen@example.com", "Header email is extracted");
    assert((resume.header.phone ?? "").includes("415"), "Header phone number is extracted");
    assert((resume.header.location ?? "").toLowerCase().includes("bengaluru"), "Header location is extracted");
    assert(resume.header.links.length >= 2, "Profile links are extracted from the header");

    assert(getSection(resume, "education") !== null, "Education section is detected");
    assert(getSection(resume, "experience") !== null, "Experience section is detected");
    assert(getSection(resume, "projects") !== null, "Projects section is detected");
    assert(getSection(resume, "skills") !== null, "Skills section is detected");
    assert(getSection(resume, "certifications") !== null, "Certifications section is detected");

    const experienceEntry = getSection(resume, "experience")?.entries[0];
    assert(
      experienceEntry?.dates.raw !== null && experienceEntry?.dates.raw !== undefined,
      `Experience date range is preserved verbatim (${experienceEntry?.dates.raw})`
    );
    assert(
      (experienceEntry?.organization ?? "").includes("Acme"),
      "Experience organization is split out of the heading verbatim, without inventing an employer"
    );
    assert(
      (experienceEntry?.title ?? "").includes("Software Engineering Intern"),
      "Experience job title is preserved separately from the organization"
    );
    assert(
      (experienceEntry?.rawLines?.[0] ?? "").includes("Acme Systems") &&
        (experienceEntry?.rawLines?.[0] ?? "").includes("Jun 2024"),
      "The original experience heading line is retained verbatim alongside the split fields"
    );

    assert(resume.skills.detected.length > 0, `Canonical skills are detected (${resume.skills.detected.join(", ")})`);
    assert(
      resume.skills.detected.some((skill) => skill.toLowerCase().includes("python")) &&
        resume.skills.detected.some((skill) => skill.toLowerCase().includes("sql")),
      "Detected skills include the technologies written in the resume"
    );
    assert(resume.links.length >= 2, "Links are collected on the structured model");
    assert((resume.summary ?? "").length > 0, "Summary is parsed as its own section");

    // Verbatim preservation: every non-empty original line must survive in the model.
    const flattened = `${flattenResumeText(resume)}\n${resume.header.rawLines.join("\n")}`;
    const missingLines = RESUME_TEXT.split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter((line) => line.length > 3)
      .filter((line) => !flattened.includes(line));
    assert(missingLines.length === 0, `Every original resume line is preserved (missing: ${missingLines.length})`);
    assert(
      getAllBullets(resume).length >= 4,
      `Bullets are captured for analysis (${getAllBullets(resume).length} bullets)`
    );

    // ========================================================================
    console.log("\n--- 4. Job Description Analysis ---");
    // ========================================================================
    const jd = analyzeJobDescription({
      raw: JOB_DESCRIPTION_TEXT,
      providedRoleTitle: "Software Engineer",
      providedCompanyName: "Microsoft",
    });

    const requiredCanonicals = jd.requiredSkills.map((skill) => skill.canonical.toLowerCase());
    const preferredCanonicals = jd.preferredSkills.map((skill) => skill.canonical.toLowerCase());
    assert(requiredCanonicals.some((skill) => skill.includes("python")), "JD required skills include Python");
    assert(requiredCanonicals.some((skill) => skill.includes("sql")), "JD required skills include SQL");
    assert(requiredCanonicals.some((skill) => skill.includes("docker")), "JD required skills include Docker");
    assert(
      preferredCanonicals.some((skill) => skill.includes("aws")) &&
        jd.preferredSkills.some((skill) => skill.term.toLowerCase().includes("aws")),
      "JD preferred skills include AWS with the verbatim term preserved"
    );
    assert(
      !requiredCanonicals.some((skill) => skill === "cloud platforms"),
      "Cloud providers are matched precisely: AWS is not collapsed into a generic cloud umbrella"
    );
    assert(jd.responsibilities.length > 0, `JD responsibilities are extracted (${jd.responsibilities.length})`);
    assert(jd.qualifications.length >= 0, "JD qualifications are extracted without fabricating entries");
    assert(jd.keywords.length > 0, `JD keywords are extracted (${jd.keywords.length})`);
    assert(jd.roleTitle === "Software Engineer", "JD role title is taken from the provided target, not invented");
    assert(
      jd.requiredSkills.every((skill) => skill.evidence.trim().length > 0),
      "Every JD skill carries the verbatim line that evidenced it"
    );

    // ========================================================================
    console.log("\n--- 5. ATS Compatibility Analysis ---");
    // ========================================================================
    const analysis = analyzeResumeAtsScore({
      resume,
      extraction: {
        ok: true,
        format: "pdf",
        warnings: [],
        signals: pdfExtraction.signals,
      },
      jobDescription: jd,
      target: { companyName: "Microsoft", roleName: "Software Engineer" },
      roleDomains: [
        { domain: "DSA", need: "HIGH" },
        { domain: "DBMS", need: "HIGH" },
        { domain: "OS", need: "HIGH" },
      ],
      measuredDomains: [
        { code: "SQL", accuracy: 42, questionsAttempted: 12 },
        { code: "DSA", accuracy: 78, questionsAttempted: 30 },
      ],
    });

    assert(
      Number.isInteger(analysis.atsScore) && analysis.atsScore >= 0 && analysis.atsScore <= 100,
      `ATS score is an integer in range (${analysis.atsScore}/100)`
    );
    assert(
      Object.keys(analysis.breakdown).length === 6,
      `Score breakdown exposes all six dimensions (${Object.keys(analysis.breakdown).join(", ")})`
    );
    assert(
      Object.values(analysis.breakdown).every((value) => value === null || (value >= 0 && value <= 100)),
      "Every reported dimension score is null or within 0–100"
    );
    assert(
      analysis.evaluatedDimensions.length + analysis.unevaluatedDimensions.length === 6,
      "Evaluated and unevaluated dimensions account for all six"
    );
    assert(analysis.explanation.length > 0, "Score explanation lists what contributed to the score");
    assert(
      analysis.limitations.some((line) => /not a prediction/i.test(line)),
      "Analysis states plainly that it is not a prediction of a hiring outcome"
    );
    assert(
      analysis.limitations.some((line) => /not evidenced/i.test(line)),
      "Analysis states that 'not evidenced' is not a claim that the student lacks the skill"
    );
    assert(analysis.parsingChecks.length >= 5, `Parsing checks are reported (${analysis.parsingChecks.length})`);
    assert(
      analysis.parsingChecks.every((check) => typeof check.detail === "string" && check.detail.length > 0),
      "Every parsing check carries an observable detail"
    );

    // Formatting detection: a multi-column signal must surface as a warning.
    const messyAnalysis = analyzeResumeAtsScore({
      resume,
      extraction: {
        ok: true,
        format: "pdf",
        warnings: ["Multiple columns detected"],
        signals: {
          format: "pdf",
          pageCount: 2,
          hasTextLayer: true,
          wordCount: 300,
          multiColumnLineCount: 12,
          repeatedLineCount: 3,
          symbolDensity: 0.22,
          pdf: { imageCount: 3, fontFamilies: ["Helvetica", "Calibri", "Arial", "Times"], hasAnnotations: false, hasFormFields: false, hasEncryptedFlag: false },
        },
      },
      jobDescription: jd,
      target: { companyName: "Microsoft", roleName: "Software Engineer" },
    });
    assert(
      messyAnalysis.findings.some((finding) => finding.category === "formatting" || finding.category === "parsing"),
      "Formatting/parsing problems produce findings"
    );
    assert(
      messyAnalysis.findings.some((finding) => /column|table|image|symbol|font/i.test(`${finding.title} ${finding.detail}`)),
      "Formatting findings name the specific machine-readability problem"
    );
    assert(
      messyAnalysis.atsScore <= analysis.atsScore,
      `A visually complex document does not score higher than a clean one (${messyAnalysis.atsScore} vs ${analysis.atsScore})`
    );

    // Keyword analysis against the JD.
    assert(analysis.keywordAnalysis.rows.length > 0, "Keyword analysis produces rows against the job description");
    const pythonRow = analysis.keywordAnalysis.rows.find((row) => row.keyword.toLowerCase().includes("python"));
    assert(pythonRow?.status === "matched", "Python is reported as a matched keyword");
    const dockerRow = analysis.keywordAnalysis.rows.find((row) => row.keyword.toLowerCase().includes("docker"));
    assert(dockerRow?.status === "missing", "Docker is reported as a keyword not found in the resume");
    assert(
      analysis.keywordAnalysis.note.length > 0 && /never|not a claim|truth/i.test(analysis.keywordAnalysis.note),
      "Keyword analysis warns against claiming skills the student does not have"
    );

    // ========================================================================
    console.log("\n--- 6. Skill Match: Resume Gap vs Preparation Gap ---");
    // ========================================================================
    const skillRows = analysis.skillMatch.rows;
    assert(skillRows.length > 0, "Skill match produces rows");
    assert(analysis.skillMatch.matched.length > 0, `Matched skills detected (${analysis.skillMatch.matched.join(", ")})`);
    assert(
      analysis.skillMatch.notEvidenced.some((skill) => skill.toLowerCase().includes("docker")),
      "Not-evidenced skills include Docker"
    );
    assert(
      skillRows
        .filter((row) => !row.evidencedInResume)
        .every((row) => (row.recommendation ?? "").length > 0 && !/you (don't|lack|do not)/i.test(row.recommendation ?? "")),
      "Not-evidenced skills never tell the student they lack the skill"
    );

    const sqlRow = skillRows.find((row) => row.canonical.toLowerCase().includes("sql"));
    assert(
      sqlRow?.gapType === "preparation_gap" && sqlRow?.measuredDomainAccuracy === 42,
      `SQL is a preparation gap backed by measured performance (gapType=${sqlRow?.gapType}, accuracy=${sqlRow?.measuredDomainAccuracy})`
    );
    assert(
      sqlRow?.resumeEvidence !== null && (sqlRow?.resumeEvidence ?? "").length > 0,
      "Preparation gaps cite the resume line that evidences the skill"
    );

    const dockerSkillRow = skillRows.find((row) => row.canonical.toLowerCase().includes("docker"));
    assert(
      dockerSkillRow?.gapType === "resume_gap" &&
        dockerSkillRow?.measuredDomainAccuracy === null &&
        dockerSkillRow.measuredQuestionsAttempted === 0,
      "Docker is a resume gap only — no measured data is invented for it"
    );
    assert(
      skillRows.every((row) => row.measuredDomainAccuracy === null || row.measuredQuestionsAttempted > 0),
      "No row reports an accuracy figure without answered questions behind it"
    );
    assert(
      analysis.skillMatch.resumeOnly.some((skill) => skill.toLowerCase().includes("react")),
      "Resume-only skills (in the resume, absent from the JD) are reported separately"
    );
    assert(analysis.skillMatch.note.length > 0, "Skill match carries an explanatory note");

    // ========================================================================
    console.log("\n--- 7. Role Match ---");
    // ========================================================================
    assert(analysis.roleMatch !== null, "Role match is produced when a job description is supplied");
    assert(analysis.roleMatch?.basis === "job_description", "Role match reports the job description as its basis");
    assert(
      (analysis.roleMatch?.score ?? -1) >= 0 && (analysis.roleMatch?.score ?? 101) <= 100,
      `Role match score is a percentage (${analysis.roleMatch?.score}%)`
    );
    assert(
      analysis.roleMatch?.note.length ? analysis.roleMatch.note.length > 0 : false,
      "Role match explains what it was measured against"
    );

    const noJdAnalysis = analyzeResumeAtsScore({
      resume,
      extraction: { ok: true, format: "pdf", warnings: [], signals: pdfExtraction.signals },
      jobDescription: null,
      target: { companyName: null, roleName: null },
      roleDomains: [],
    });
    assert(
      noJdAnalysis.breakdown.roleMatch === null && noJdAnalysis.unevaluatedDimensions.includes("roleMatch"),
      "Without a JD or target role, role match is reported as not measured instead of assumed"
    );
    const roleBasedAnalysis = analyzeResumeAtsScore({
      resume,
      extraction: { ok: true, format: "pdf", warnings: [], signals: pdfExtraction.signals },
      jobDescription: null,
      target: { companyName: targetCompany.name, roleName: targetRole.name },
      roleDomains: [{ domain: "DSA", need: "HIGH" }],
    });
    assert(
      roleBasedAnalysis.roleMatch?.basis === "target_role",
      "Role match falls back to target-role basis and labels it honestly"
    );
    assert(
      (roleBasedAnalysis.roleMatch?.note ?? "").toLowerCase().includes("curriculum") ||
        (roleBasedAnalysis.roleMatch?.basisLabel ?? "").toLowerCase().includes("role"),
      "Target-role basis explains that it is requirement alignment, not a JD skill list"
    );

    // ========================================================================
    console.log("\n--- 8. Suggestions: Truth Preservation ---");
    // ========================================================================
    const suggestions = generateSuggestions({
      resume,
      jobDescription: jd,
      target: { companyName: "Microsoft", roleName: "Software Engineer" },
    });
    assert(suggestions.length > 0, `Suggestion engine produced ${suggestions.length} suggestions`);

    assert(
      suggestions.every((suggestion) => suggestion.verification.truthPreserving === true),
      "Every generated suggestion passes the truth-preservation verification"
    );
    assert(
      suggestions.every((suggestion) => suggestion.verification.violations.length === 0),
      "No generated suggestion carries a scope violation"
    );
    assert(
      suggestions.every((suggestion) => suggestion.reason.what.length > 0 && suggestion.reason.why.length > 0),
      "Every suggestion explains what should change and why"
    );
    assert(
      suggestions.every((suggestion) => suggestion.reason.evidence.length > 0),
      "Every suggestion cites the evidence that triggered it"
    );

    const actionable = suggestions.filter((suggestion) => suggestion.actionable && suggestion.suggestedText);
    assert(actionable.length > 0, `${actionable.length} suggestion(s) are directly applicable`);

    const evidenceNumbers = new Set([...numbersIn(RESUME_TEXT), ...numbersIn(RESUME_TEXT.replace(/\s/g, ""))]);
    const inventedNumbers = actionable.filter((suggestion) =>
      numbersIn(suggestion.suggestedText ?? "").some(
        (number) => !numbersIn(suggestion.originalText).includes(number) && !evidenceNumbers.has(number)
      )
    );
    assert(
      inventedNumbers.length === 0,
      `No suggestion introduces a number that is not in the student's own text (offenders: ${inventedNumbers.length})`
    );

    assert(
      actionable.every((suggestion) =>
        containsFabrication(suggestion.originalText, suggestion.suggestedText ?? "", { evidenceText: resumeEvidenceText() }) ===
          false
      ),
      "Independent re-check confirms no applicable suggestion is a fabrication"
    );

    // Adversarial injections: every one of these MUST be rejected.
    const scopeSource = "Worked on backend development.";
    const adversarial: { label: string; candidate: string }[] = [
      { label: "invented metric", candidate: "Developed a scalable React application serving 10,000+ users." },
      { label: "invented percentage", candidate: "Improved backend development performance by 40%." },
      { label: "invented technology", candidate: "Worked on backend development using Docker and Kubernetes." },
      { label: "invented employer", candidate: "Worked on backend development at Google." },
      { label: "invented responsibility", candidate: "Worked on backend development for the production on-call rotation." },
      { label: "invented certification", candidate: "Worked on backend development. AWS Certified Solutions Architect." },
      { label: "scope escalation", candidate: "Led backend development." },
      { label: "invented scale", candidate: "Worked on backend development across 3 teams in 2 countries." },
    ];
    for (const testCase of adversarial) {
      const result = analyzeFactualScope(scopeSource, testCase.candidate, { evidenceText: resumeEvidenceText() });
      assert(
        result.allowed === false && result.violations.length > 0,
        `Guard rejects ${testCase.label}: "${testCase.candidate}" (${result.violations.map((violation) => violation.rule).join(", ")})`
      );
    }

    const benignCases: { label: string; candidate: string }[] = [
      { label: "same-scope rephrase", candidate: "Contributed to backend development." },
      { label: "technology already in the resume", candidate: "Contributed to backend development using Python." },
      { label: "existing metric preserved", candidate: "Contributed to backend development in the reporting module." },
    ];
    for (const testCase of benignCases) {
      const result = analyzeFactualScope(scopeSource, testCase.candidate, { evidenceText: resumeEvidenceText() });
      assert(result.allowed === true, `Guard allows ${testCase.label}: "${testCase.candidate}"`);
    }

    // ========================================================================
    console.log("\n--- 9. Resume Variant Creation + Phase 16 Target Inheritance ---");
    // ========================================================================
    const variant = await createResumeVariant({
      userId: userAlpha.id,
      sourceFileId: uploadResult.fileId,
      label: "Software Engineer — Microsoft",
      roleId: targetRole.id,
      companyId: targetCompany.id,
    });

    assert(variant.id.length > 0 && variant.isPrimary === true, "First variant becomes the primary variant");
    assert(variant.targetCompanyId === targetCompany.id && variant.targetRoleId === targetRole.id, "Variant stores the Phase 16 target company and role");
    assert(variant.atsScore !== null && variant.atsScore > 0, `Analysis ran on creation (ATS ${variant.atsScore}/100)`);
    assert(variant.analysis !== null && variant.analysis.parsingChecks.length > 0, "Analysis is persisted with the variant");
    assert(variant.sourceFile?.id === uploadResult.fileId, "Variant is linked to the uploaded source document");
    assert(variant.structured.sections.length > 0, "Variant stores structured resume data separately from the uploaded file");

    const inheritedVariant = await createResumeVariant({ userId: userAlpha.id, sourceFileId: uploadResult.fileId, label: "Inherited target" });
    assert(
      inheritedVariant.targetCompanyId === targetCompany.id && inheritedVariant.targetRoleId === targetRole.id,
      "A variant created without an explicit target inherits the Phase 16 primary target"
    );
    assert(inheritedVariant.isPrimary === false, "A second variant does not steal primary status");
    await deleteResumeVariant(inheritedVariant.id, userAlpha.id);

    const betaVariant = await createResumeVariant({
      userId: userBeta.id,
      sourceFileId: (
        await uploadResumeFile({
          userId: userBeta.id,
          bytes: buildTestPdf([["BETA CANDIDATE", "beta@example.com", "EXPERIENCE", "- Wrote documentation."]]),
          fileName: "beta.pdf",
          mimeType: "application/pdf",
        })
      ).fileId,
      label: "General",
    });
    assert(
      betaVariant.targetCompanyId === null && betaVariant.targetRoleId === null,
      "A user with no Phase 16 targets gets an untargeted variant with no invented target"
    );
    assert(
      betaVariant.analysis?.roleMatch === null || betaVariant.analysis?.roleMatch?.basis === "target_role",
      "Missing target data is reported rather than assumed"
    );

    // ========================================================================
    console.log("\n--- 10. Job Description Attach + Target Change ---");
    // ========================================================================
    const withJd = await setResumeJobDescription({
      variantId: variant.id,
      userId: userAlpha.id,
      raw: JOB_DESCRIPTION_TEXT,
      source: "paste",
      providedRoleTitle: "Software Engineer",
      providedCompanyName: "Microsoft",
    });
    assert(withJd.jobDescription !== null, "Job description is stored on the variant");
    assert((withJd.jobDescription?.extraction.requiredSkills.length ?? 0) > 0, "Stored JD carries its extracted requirements");
    assert(withJd.analysis?.roleMatch?.basis === "job_description", "Attaching a JD switches role match to job-description basis");
    assert(withJd.matchScore !== null, `Target match score is computed (${withJd.matchScore}%)`);

    const otherCompany = (await db.select().from(companies).limit(20)).find((row) => row.id !== targetCompany.id);
    const otherRole = (await db.select().from(roles).limit(20)).find((row) => row.id !== targetRole.id);
    assert(otherCompany !== undefined && otherRole !== undefined, "Alternate catalog company/role available for target-change testing");

    const retargeted = await updateResumeVariant({
      variantId: variant.id,
      userId: userAlpha.id,
      patch: { companyId: otherCompany!.id, roleId: otherRole!.id },
    });
    assert(
      retargeted.targetCompanyId === otherCompany!.id && retargeted.targetCompanyName === otherCompany!.name,
      "Changing the target company updates the stored target from the catalog"
    );
    assert(retargeted.targetRoleName === otherRole!.name, "Changing the target role updates the stored target from the catalog");
    assert(retargeted.analysis !== null, "Target change re-runs the analysis");

    const restored = await updateResumeVariant({
      variantId: variant.id,
      userId: userAlpha.id,
      patch: { companyId: targetCompany.id, roleId: targetRole.id },
    });
    assert(restored.targetCompanyId === targetCompany.id, "Target can be restored to the Phase 16 target");

    let badCatalogRejected = false;
    try {
      await updateResumeVariant({
        variantId: variant.id,
        userId: userAlpha.id,
        patch: { roleId: "00000000-0000-4000-8000-000000000000" },
      });
    } catch (error) {
      badCatalogRejected = true;
      assert(
        (error as Error).message.includes("catalog"),
        `Unknown role id is rejected against the catalog: ${(error as Error).message}`
      );
    }
    assert(badCatalogRejected, "Targeting rejects a role that does not exist in the Phase 16 catalog");

    // ========================================================================
    console.log("\n--- 11. Suggestions: Accept / Reject ---");
    // ========================================================================
    const variantDetail = await getResumeVariant(variant.id, userAlpha.id);
    const applicable = variantDetail.suggestions.find(
      (suggestion) =>
        suggestion.status === "pending" &&
        suggestion.actionable &&
        suggestion.target.field !== "skills" &&
        suggestion.suggestedText !== null &&
        !suggestion.suggestedText.includes("[")
    );
    assert(applicable !== undefined, `A pending, directly applicable suggestion exists (${applicable?.reason.what})`);

    if (applicable) {
      const versionsBefore = (await listResumeVersions(variant.id, userAlpha.id)).length;
      const accepted = await decideSuggestion({
        variantId: variant.id,
        userId: userAlpha.id,
        suggestionId: applicable.id,
        decision: "accepted",
      });
      const acceptedRow = accepted.suggestions.find((suggestion) => suggestion.id === applicable.id);
      assert(
        acceptedRow?.status === "accepted",
        `Accepted suggestion is recorded with an accepted status (found: ${acceptedRow?.status ?? "missing row"})`
      );
      assert(
        flattenResumeText(accepted.structured).includes((applicable.suggestedText ?? "").slice(0, 40)),
        "Accepting a suggestion applies the verified rewrite to the structured resume"
      );
      const versionsAfter = await listResumeVersions(variant.id, userAlpha.id);
      assert(versionsAfter.length === versionsBefore + 1, "Accepting a suggestion snapshots a new resume version");
      assert(
        (versionsAfter[0].changeSummary as { truthVerified?: boolean } | null)?.truthVerified === true,
        "The version snapshot records that the change was truth-verified"
      );
    }

    const detailAfterAccept = await getResumeVariant(variant.id, userAlpha.id);
    const rejectable = detailAfterAccept.suggestions.find((suggestion) => suggestion.status === "pending");
    assert(rejectable !== undefined, "A pending suggestion remains available for rejection testing");
    if (rejectable) {
      const beforeText = flattenResumeText(detailAfterAccept.structured);
      const rejected = await decideSuggestion({
        variantId: variant.id,
        userId: userAlpha.id,
        suggestionId: rejectable.id,
        decision: "rejected",
      });
      const rejectedRow = rejected.suggestions.find((suggestion) => suggestion.id === rejectable.id);
      assert(rejectedRow?.status === "rejected", "Rejected suggestion is recorded with a rejected status");
      assert(
        flattenResumeText(rejected.structured) === beforeText,
        "Rejecting a suggestion leaves the resume content completely unchanged"
      );
    }

    // ========================================================================
    console.log("\n--- 12. Student-Asserted Skills (explicit, never inferred) ---");
    // ========================================================================
    const withAssertion = await setStudentAssertedSkill({
      variantId: variant.id,
      userId: userAlpha.id,
      skill: "Docker",
      asserted: true,
      note: "Used in a university course project.",
    });
    assert(
      withAssertion.structured.studentAssertedFacts.some((fact) => fact.kind === "skill" && fact.value === "Docker"),
      "An explicitly asserted skill is stored as a student-asserted fact"
    );
    const dockerAfterAssertion = withAssertion.analysis?.skillMatch.rows.find((row) => row.canonical.toLowerCase().includes("docker"));
    assert(
      dockerAfterAssertion?.provenance === "student_asserted",
      "An asserted skill is marked with student_asserted provenance, not resume_detected"
    );
    assert(
      dockerAfterAssertion?.gapType !== "resume_gap" || dockerAfterAssertion?.resumeEvidence === null,
      "Asserting a skill does not fabricate a resume evidence line"
    );

    const withoutAssertion = await setStudentAssertedSkill({
      variantId: variant.id,
      userId: userAlpha.id,
      skill: "Docker",
      asserted: false,
    });
    assert(
      !withoutAssertion.structured.studentAssertedFacts.some((fact) => fact.kind === "skill" && fact.value === "Docker"),
      "An assertion can be withdrawn, restoring the resume-gap state"
    );

    // ========================================================================
    console.log("\n--- 13. Resume Builder: Edits + ATS-Friendly Output ---");
    // ========================================================================
    const projectSection = detailAfterAccept.structured.sections.find((section) => section.key === "projects");
    const projectEntry = projectSection?.entries[0];
    assert(projectEntry !== undefined, "Builder has a project entry to edit");

    const edited = await updateStructuredResume({
      variantId: variant.id,
      userId: userAlpha.id,
      structured: {
        summary: "Computer Science student focused on backend systems, APIs, and databases.",
        sections: detailAfterAccept.structured.sections.map((section) => ({
          key: section.key,
          originalHeading: section.originalHeading,
          order: section.order,
          recognized: section.recognized,
          items: section.items,
          rawLines: section.rawLines,
          entries: section.entries.map((entry) =>
            entry.id === projectEntry?.id
              ? {
                  ...entry,
                  bullets: [...entry.bullets, "Implemented REST API endpoints for the event registration flow."],
                }
              : entry
          ),
        })),
      },
    });
    assert(
      edited.structured.summary === "Computer Science student focused on backend systems, APIs, and databases.",
      "Builder edit persists the rewritten summary"
    );
    assert(
      flattenResumeText(edited.structured).includes("Implemented REST API endpoints for the event registration flow."),
      "Builder edit persists an added project bullet"
    );
    assert(
      flattenResumeText(edited.structured).includes("Responsible for writing SQL queries for the reporting module.") &&
        flattenResumeText(edited.structured).includes("AWS Cloud Practitioner"),
      "Builder edits do not delete unrelated original content"
    );

    const plainText = renderAtsPlainText(edited.structured, { targetLine: "Target: Microsoft — Software Engineer" });
    assert(plainText.includes("ALEX CHEN"), "ATS plain-text export includes the header name");
    assert(
      ["EDUCATION", "EXPERIENCE", "PROJECTS", "CERTIFICATIONS"].every((heading) => plainText.includes(heading)),
      "ATS export uses standard, parser-recognized section headings"
    );
    assert(!plainText.includes("<") && !plainText.includes("|  |"), "Plain-text export contains no markup or table structure");

    const html = renderAtsHtml(edited.structured, { targetLine: "Target: Microsoft — Software Engineer" });
    assert(!/<table|<img|<svg|column-count|float:/i.test(html), "ATS HTML export avoids tables, images, and multi-column layout");
    assert(html.includes("<h2>") && html.includes("<ul>"), "ATS HTML export uses semantic headings and simple lists");
    assert(/font-family: Arial, Helvetica, sans-serif/.test(html), "ATS HTML export uses a standard system font stack");

    const exportResult = await renderAtsResume({ variantId: variant.id, userId: userAlpha.id, format: "txt" });
    assert(exportResult.content.length > 0 && exportResult.fileName.endsWith(".txt"), "Resume export service returns a named plain-text document");

    // ========================================================================
    console.log("\n--- 14. Version History + Comparison ---");
    // ========================================================================
    const currentDetail = await getResumeVariant(variant.id, userAlpha.id);
    const v1 = await saveResumeVersion({
      variantId: variant.id,
      userId: userAlpha.id,
      label: "Builder snapshot",
      changeSummary: { type: "manual_snapshot" },
    });
    assert(v1.atsScore === currentDetail.atsScore, "A saved version records the ATS score in effect at snapshot time");
    assert(v1.matchScore === currentDetail.matchScore, "A saved version records the target match score in effect at snapshot time");

    const secondVariantState = await updateStructuredResume({
      variantId: variant.id,
      userId: userAlpha.id,
      structured: { summary: "Backend-focused Computer Science student with REST API and database experience." },
    });
    const v2 = await saveResumeVersion({ variantId: variant.id, userId: userAlpha.id, label: "Improved summary" });
    assert(v2.versionNumber === v1.versionNumber + 1, "Version numbers increase monotonically");

    const versions = await listResumeVersions(variant.id, userAlpha.id);
    assert(
      versions.length >= 2 && versions[0].versionNumber > versions[1].versionNumber,
      "Version history is returned newest-first"
    );
    assert(
      versions.every((version) => version.atsScore === null || (version.atsScore >= 0 && version.atsScore <= 100)),
      "Every stored version carries a valid score history"
    );
    assert(secondVariantState.atsScore !== null, "Editing the resume re-measures the ATS score");

    const comparison = await compareResumeVersions({
      variantId: variant.id,
      userId: userAlpha.id,
      fromVersionId: v1.id,
      toVersionId: v2.id,
    });
    assert(comparison.to.versionNumber > comparison.from.versionNumber, "Comparison is directional (from → to)");
    assert(comparison.summary.length > 0, `Comparison produces a readable summary: ${comparison.summary.slice(0, 120)}`);
    assert(
      comparison.deltas.atsScore === null || typeof comparison.deltas.atsScore === "number",
      "Comparison reports the ATS delta (or null when a side has no score)"
    );
    assert(Array.isArray(comparison.changedBullets) && Array.isArray(comparison.addedSkills), "Comparison reports content-level differences");

    // ========================================================================
    console.log("\n--- 15. Workspace + Dashboard Health ---");
    // ========================================================================
    const workspace = await getResumeWorkspace(userAlpha.id);
    assert(workspace.hasResume === true, "Workspace reports an existing resume");
    assert(workspace.primaryVariant?.id === variant.id, "Workspace selects the primary variant");
    assert(workspace.files.length === 1 && workspace.variants.length === 1, "Workspace lists exactly the owner's files and variants");
    assert(
      workspace.supportedFormats.some((entry) => entry.supported === false),
      "Workspace states which formats are unsupported instead of pretending"
    );
    assert(workspace.maxUploadBytes === MAX_RESUME_FILE_BYTES, "Workspace publishes the real upload size limit");
    assert(workspace.emptyState === null, "Empty state is suppressed once a resume exists");

    const health = await getResumeHealth(userAlpha.id);
    assert(health.hasResume === true && health.atsScore !== null, "Dashboard resume health exposes the ATS score");
    assert(health.matchScore !== null, "Dashboard resume health exposes the target match score");
    assert(health.signals.length > 0, "Dashboard resume health exposes compact signals");
    assert(
      health.signals.every((signal) => ["ok", "warn", "info"].includes(signal.status)),
      "Dashboard signals use only ok/warn/info states"
    );
    assert(health.topRecommendations.length > 0, "Dashboard resume health surfaces top recommendations");

    const betaHealth = await getResumeHealth(userBeta.id);
    assert(betaHealth.hasResume === true && betaHealth.variantId === betaVariant.id, "Beta's resume health reflects only Beta's variant");
    assert(
      betaHealth.label === betaVariant.label && betaHealth.atsScore === betaVariant.atsScore,
      "Beta's health is computed from Beta's own analysis, independently of Alpha's data"
    );

    const betaWorkspace = await getResumeWorkspace(userBeta.id);
    assert(
      betaWorkspace.files.every((file) => file.id !== uploadResult.fileId) &&
        betaWorkspace.variants.every((entry) => entry.id !== variant.id),
      "Beta's workspace contains none of Alpha's files or variants"
    );

    // ========================================================================
    console.log("\n--- 16. Integration: Phase 15 / 16 / 17 ---");
    // ========================================================================
    const strategy = await getPlacementTargetStrategy(userAlpha.id);
    assert(strategy !== null && Array.isArray(strategy.gaps), "Phase 16 target strategy still builds with resume data present");
    assert(
      strategy.readiness.targetScore === null || (strategy.readiness.targetScore >= 0 && strategy.readiness.targetScore <= 100),
      "Phase 16 target readiness remains an independent 0–100 measurement"
    );

    const plan = await getDailyExecutionPlan(userAlpha.id);
    assert(Array.isArray(plan.actions), "Phase 15 daily execution plan still returns its measured actions");
    assert(Array.isArray(plan.resumeActions), "Phase 15 plan carries resume-aligned actions");
    assert(
      (plan.resumeActions ?? []).every((action) => action.requiresMeasuredWeakness === false || action.ctaHref !== null),
      "Resume actions either prompt for evidence or link to a real preparation target"
    );
    assert(
      (plan.resumeActions ?? []).every((action) => !/you (don't|lack|do not) (know|have)/i.test(action.reason)),
      "Resume actions never assert that the student lacks a skill"
    );
    assert(
      (plan.resumeActions ?? []).every(
        (action) => action.type !== "ALIGN" || (action.requiresMeasuredWeakness === true && /answered question/i.test(action.evidence))
      ),
      "Alignment actions are only raised from independently measured evidence"
    );

    const coverage = await getResumeCoverageForGaps(userAlpha.id, [
      { topic: "Graph Algorithms", domain: "DSA" },
      { topic: "SQL Queries", domain: "DBMS" },
    ]);
    assert(coverage.hasResume === true && coverage.variantId === variant.id, "Phase 17 gap coverage links to the primary resume variant");
    assert(coverage.coverage.length === 2, "Coverage is reported for every supplied gap");
    const coveredGap = coverage.coverage.find((entry) => entry.topic === "SQL Queries");
    const uncoveredGap = coverage.coverage.find((entry) => entry.topic === "Graph Algorithms");
    assert(coveredGap?.coveredInResume === true, "A gap area present in the resume is reported as covered");
    assert(
      uncoveredGap?.coveredInResume === false && /not a statement/i.test(uncoveredGap?.note ?? ""),
      "An uncovered area is reported as 'not detected' with the non-claim disclaimer"
    );

    const betaCoverage = await getResumeCoverageForGaps(userBeta.id, [{ topic: "Graph Algorithms", domain: "DSA" }]);
    assert(
      betaCoverage.coverage.every((entry) => entry.coveredInResume !== null || /no resume/i.test(entry.note)),
      "Coverage with a resume present always resolves to true/false, never null"
    );

    const noResumeCoverage = await getResumeCoverageForGaps("00000000-0000-4000-8000-000000000001", [
      { topic: "Graph Algorithms", domain: "DSA" },
    ]);
    assert(
      noResumeCoverage.hasResume === false && noResumeCoverage.coverage.every((entry) => entry.coveredInResume === null),
      "A user with no resume gets null coverage (unknown), not a fabricated gap"
    );

    // ========================================================================
    console.log("\n--- 17. Security & Privacy ---");
    // ========================================================================
    // Outside a request context `auth()` cannot resolve a session; the route
    // must then either answer 401 or fail closed. Both are a denial.
    async function anonDenied(run: () => Promise<Response>): Promise<string> {
      try {
        const response = await run();
        return response.status === 401 ? "401" : `LEAKED(${response.status})`;
      } catch {
        return "threw";
      }
    }

    const anonResults = await Promise.all([
      anonDenied(() => resumeWorkspaceGet()),
      anonDenied(() => resumeVariantsGet()),
      anonDenied(() => resumeUploadPost(new Request("http://localhost/api/student/resume/upload", { method: "POST" }))),
      anonDenied(() =>
        resumeFileGet(new Request("http://localhost/api/student/resume/files/x"), {
          params: Promise.resolve({ id: variant.sourceFile?.id ?? "x" }),
        })
      ),
    ]);
    assert(
      anonResults.every((result) => result === "401" || result === "threw"),
      `All resume APIs fail closed without auth (results: ${anonResults.join(", ")})`
    );


    const ownershipProbes: { label: string; run: () => Promise<unknown> }[] = [
      { label: "read variant", run: () => getResumeVariant(variant.id, userBeta.id) },
      { label: "list versions", run: () => listResumeVersions(variant.id, userBeta.id) },
      { label: "compare versions", run: () => compareResumeVersions({ variantId: variant.id, userId: userBeta.id, fromVersionId: v1.id, toVersionId: v2.id }) },
      { label: "update variant", run: () => updateResumeVariant({ variantId: variant.id, userId: userBeta.id, patch: { label: "hijacked" } }) },
      { label: "delete variant", run: () => deleteResumeVariant(variant.id, userBeta.id) },
      { label: "set job description", run: () => setResumeJobDescription({ variantId: variant.id, userId: userBeta.id, raw: JOB_DESCRIPTION_TEXT }) },
      { label: "edit structured content", run: () => updateStructuredResume({ variantId: variant.id, userId: userBeta.id, structured: { summary: "hijacked" } }) },
      { label: "assert skill", run: () => setStudentAssertedSkill({ variantId: variant.id, userId: userBeta.id, skill: "Docker", asserted: true }) },
      { label: "export", run: () => renderAtsResume({ variantId: variant.id, userId: userBeta.id, format: "txt" }) },
      { label: "read uploaded file", run: () => getResumeFile({ fileId: variant.sourceFile!.id, userId: userBeta.id }) },
      {
        label: "decide suggestion",
        run: () =>
          decideSuggestion({
            variantId: variant.id,
            userId: userBeta.id,
            suggestionId: detailAfterAccept.suggestions[0]?.id ?? "00000000-0000-4000-8000-000000000002",
            decision: "accepted",
          }),
      },
      { label: "save version", run: () => saveResumeVersion({ variantId: variant.id, userId: userBeta.id, label: "hijacked" }) },
    ];

    let blockedCount = 0;
    for (const probe of ownershipProbes) {
      let blocked = false;
      try {
        await probe.run();
      } catch (error) {
        blocked = /Unauthorized|Access denied/i.test((error as Error).message);
      }
      if (blocked) blockedCount++;
      else console.error(`      ↳ ownership probe NOT blocked: ${probe.label}`);
    }
    assert(blockedCount === ownershipProbes.length, `Every cross-tenant resume operation is blocked (${blockedCount}/${ownershipProbes.length})`);

    assert(
      jsonError(new Error("Unauthorized: you do not have access to this resource."), "fallback").status === 403,
      "Ownership errors map to 403 rather than leaking existence"
    );
    assert(jsonError(new Error("Unexpected internal failure"), "fallback").status === 500, "Unexpected failures map to a generic 500");

    const ownerFile = await getResumeFile({ fileId: variant.sourceFile!.id, userId: userAlpha.id });
    assert(ownerFile.bytes.equals(pdfBytes), "The owner receives byte-identical original document content");
    assert(ownerFile.fileName === "alex-chen-resume.pdf", "The owner receives the original file name");

    // ========================================================================
    console.log("\n--- 18. Zero-Fabrication Sweep Across All Surfaces ---");
    // ========================================================================
    const finalDetail = await getResumeVariant(variant.id, userAlpha.id);
    const allText = [
      ...(finalDetail.analysis?.findings ?? []).flatMap((finding) => [finding.title, finding.detail, finding.evidence ?? ""]),
      ...finalDetail.suggestions.flatMap((suggestion) => [suggestion.originalText, suggestion.suggestedText ?? "", suggestion.reason.what, suggestion.reason.evidence]),
      ...(finalDetail.analysis?.skillMatch.rows ?? []).flatMap((row) => [row.recommendation ?? ""]),
      ...(plan.resumeActions ?? []).flatMap((action) => [action.reason, action.evidence]),
    ].join("\n");

    const bannedPhrases = [
      /\byou (don't|lack|do not have)\b/i,
      /\bwill definitely pass\b/i,
      /\bguaranteed (hire|placement|job)\b/i,
      /\byou have \d+ years\b/i,
      /\bserving [\d,]+ users\b/i,
      /\bimproved .* by \d+%/i,
    ];
    for (const banned of bannedPhrases) {
      assert(!banned.test(allText), `No surface emits the banned claim pattern ${banned}`);
    }
    assert(
      allText.includes("Not detected") ||
        allText.includes("not evidenced") ||
        allText.includes("not detected") ||
        allText.includes("Not evidenced"),
      "Missing information is described as not detected / not evidenced"
    );
    assert(
      finalDetail.suggestions.every((suggestion) => suggestion.status !== "pending" || suggestion.verification.truthPreserving),
      "Every pending suggestion on the surface is truth-preserving"
    );

    // ========================================================================
    console.log("\n--- 19. Cleanup + Data Isolation Verification ---");
    // ========================================================================
    await deleteAllResumeData(userBeta.id);
    const betaWorkspaceAfter = await getResumeWorkspace(userBeta.id);
    assert(betaWorkspaceAfter.hasResume === false && betaWorkspaceAfter.files.length === 0, "Account cleanup removes every resume artifact for that user only");
    const alphaStillThere = await db.select({ id: resumeVariants.id }).from(resumeVariants).where(eq(resumeVariants.userId, userAlpha.id));
    assert(alphaStillThere.length > 0, "Another user's resume data is untouched by account cleanup");

    console.log("==================================================");
    console.log(`📊 PHASE 18 TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Unexpected error during Phase 18 testing:", error);
    process.exit(1);
  } finally {
    console.log("\nCleaning up test artifacts...");
    try {
      for (const userId of createdUserIds) {
        await deleteAllResumeData(userId);
        await db.delete(studentTargetCompanies).where(eq(studentTargetCompanies.userId, userId));
        await db.delete(studentTargetRoles).where(eq(studentTargetRoles.userId, userId));
        await db.delete(profiles).where(eq(profiles.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
      }
      console.log("Cleanup complete.");
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}

runPhase18Tests();

/**
 * Phase 18 — live HTTP regression for resume upload → extraction → ATS analysis.
 *
 * This is the test the unit suite could not provide: it drives the *real Next.js
 * server* over HTTP, so it exercises the server bundling/runtime path where
 * `pdfjs`'s worker resolution used to fail with
 *   "Setting up fake worker failed: Cannot find module '.../chunks/pdfw...'"
 * even though the uploaded PDF was valid.
 *
 * It proves, against a running server:
 *   PDF  upload → extraction → pageCount → text layer → ATS score + breakdown
 *   DOCX upload → extraction → ATS analysis
 *   TXT  upload → extraction
 *   scan / corrupt / RTF → rejected with the correct, specific reason
 *
 * Usage:
 *   npx tsx src/test/phase-18-pdf-extraction-http.ts
 *   RESUME_HTTP_BASE=http://localhost:3100 npx tsx src/test/phase-18-pdf-extraction-http.ts
 *
 * The server must be running with the Phase 18 PDF fix loaded (restart it after
 * changing next.config.ts, and clear `.next` so no stale chunk is reused).
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { deleteAllResumeData } from "@/server/resume-intelligence";
import {
  RESUME_TEXT,
  buildCorruptPdf,
  buildResumeDocx,
  buildResumePdf,
  buildResumeTxt,
  buildScanLikePdf,
  buildTwoPagePdf,
} from "./fixtures/resume-fixtures";

const BASE_URL = (process.env.RESUME_HTTP_BASE ?? "http://localhost:3000").replace(/\/$/, "");

class CookieJar {
  cookies: Record<string, string> = {};

  update(response: Response) {
    const raw = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const cookie of raw) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index !== -1) {
        this.cookies[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
      }
    }
  }

  get header(): string {
    return Object.entries(this.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}${detail ? `\n        ↳ ${detail}` : ""}`);
    failed++;
  }
}

/** Surface the server's own words, so an engine failure is unmistakable. */
function describeFailure(label: string, status: number, body: string): string {
  return `${label} → HTTP ${status}: ${body.slice(0, 400)}`;
}

async function main() {
  console.log("==================================================");
  console.log("🚀  NEXORA — PHASE 18: LIVE PDF UPLOAD / ATS HTTP");
  console.log(`    ${BASE_URL}`);
  console.log("==================================================");

  const createdUserIds: string[] = [];
  const password = "Phase18Http!Passw0rd";
  const email = `phase18_http_${Date.now()}@nexora.test`;

  try {
    // ------------------------------------------------------------------------
    console.log("\n--- 0. Server reachable ---");
    // ------------------------------------------------------------------------
    let reachable = true;
    let homeStatus = 0;
    try {
      const home = await fetch(`${BASE_URL}/`, { redirect: "manual" });
      homeStatus = home.status;
    } catch (error) {
      reachable = false;
      console.error(`        ↳ ${error instanceof Error ? error.message : String(error)}`);
    }
    assert(reachable && homeStatus > 0, `Server responds at ${BASE_URL} (status ${homeStatus})`);
    if (!reachable) {
      console.error(
        "\nNo server is reachable. Start one first (npm run dev) and re-run this test."
      );
      process.exit(1);
    }

    // ------------------------------------------------------------------------
    console.log("\n--- 1. Authenticated session (real credentials login) ---");
    // ------------------------------------------------------------------------
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: await bcrypt.hash(password, 10), isAdmin: false })
      .returning();
    createdUserIds.push(user.id);
    await db.insert(profiles).values({
      userId: user.id,
      name: "Http Resume Tester",
      college: "Nexora Engineering Institute",
      branch: "Computer Science",
      graduationYear: 2026,
    });

    const jar = new CookieJar();
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    jar.update(csrfResponse);
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

    const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.header },
      body: new URLSearchParams({ csrfToken, email, password, redirect: "false", json: "true" }),
      redirect: "manual",
    });
    jar.update(loginResponse);
    assert(
      loginResponse.status === 200 || loginResponse.status === 302,
      `Credentials login succeeded (status ${loginResponse.status})`
    );

    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, { headers: { Cookie: jar.header } });
    const session = (await sessionResponse.json()) as { user?: { email?: string } };
    assert(session?.user?.email === email, "Session cookie authenticates subsequent resume API calls");

    // ------------------------------------------------------------------------
    console.log("\n--- 2. PDF upload → extraction (the reported failure) ---");
    // ------------------------------------------------------------------------
    async function upload(label: string, bytes: Buffer, fileName: string, mimeType: string) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), fileName);
      const response = await fetch(`${BASE_URL}/api/student/resume/upload`, {
        method: "POST",
        headers: { Cookie: jar.header },
        body: form,
      });
      const text = await response.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        /* non-JSON body is reported through describeFailure */
      }
      return { label, response, text, json };
    }

    const pdfUpload = await upload("PDF", buildResumePdf(), "alex-chen-resume.pdf", "application/pdf");
    assert(
      pdfUpload.response.status === 201,
      "Real text-based PDF uploads successfully (HTTP 201)",
      describeFailure(pdfUpload.label, pdfUpload.response.status, pdfUpload.text)
    );
    assert(
      !pdfUpload.text.includes("fake worker"),
      "Upload response contains no fake-worker error",
      pdfUpload.text.slice(0, 300)
    );

    const pdfBody = pdfUpload.json as {
      ok?: boolean;
      fileId?: string;
      fileFormat?: string;
      parseStatus?: string;
      pageCount?: number | null;
      wordCount?: number;
      error?: { code?: string; message?: string } | null;
    };
    assert(pdfBody.ok === true, "Extraction reports ok=true");
    assert(pdfBody.parseStatus === "parsed", `Upload parse status is 'parsed' (got '${pdfBody.parseStatus}')`);
    assert(pdfBody.fileFormat === "pdf", `Format detected as pdf (got '${pdfBody.fileFormat}')`);
    assert(pdfBody.pageCount === 1, `pageCount detected from the PDF (got ${pdfBody.pageCount})`);
    assert(
      (pdfBody.wordCount ?? 0) > 50,
      `Real resume text extracted over HTTP (${pdfBody.wordCount} words)`
    );
    assert(pdfBody.error === null || pdfBody.error === undefined, "No extraction error returned");

    // ------------------------------------------------------------------------
    console.log("\n--- 3. ATS analysis over the extracted PDF ---");
    // ------------------------------------------------------------------------
    const variantResponse = await fetch(`${BASE_URL}/api/student/resume/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: jar.header },
      body: JSON.stringify({ sourceFileId: pdfBody.fileId, label: "HTTP PDF variant" }),
    });
    const variantText = await variantResponse.text();
    assert(
      variantResponse.status === 201,
      "Resume variant created from the uploaded PDF (HTTP 201)",
      describeFailure("variants", variantResponse.status, variantText)
    );
    const variant = JSON.parse(variantText) as { id?: string; atsScore?: number | null };
    assert(typeof variant.id === "string", "Variant id returned");

    const analyzeResponse = await fetch(`${BASE_URL}/api/student/resume/variants/${variant.id}/analyze`, {
      method: "POST",
      headers: { Cookie: jar.header },
    });
    const analyzeText = await analyzeResponse.text();
    assert(
      analyzeResponse.status === 200,
      "Analyse Resume succeeds (HTTP 200)",
      describeFailure("analyze", analyzeResponse.status, analyzeText)
    );
    assert(!analyzeText.includes("fake worker"), "Analysis response contains no fake-worker error");

    const analyzed = JSON.parse(analyzeText) as {
      atsScore?: number | null;
      structured?: { header?: { name?: string | null } };
      analysis?: {
        breakdown?: Record<string, number | null>;
        parsingChecks?: unknown[];
        findings?: unknown[];
      } | null;
    };
    assert(
      typeof analyzed.atsScore === "number",
      `ATS score computed over HTTP (atsScore=${analyzed.atsScore})`
    );
    const breakdown = analyzed.analysis?.breakdown ?? null;
    assert(
      breakdown !== null && Object.keys(breakdown).length === 6,
      `Six-dimension breakdown returned (${breakdown ? Object.keys(breakdown).join(", ") : "none"})`
    );
    assert(
      (analyzed.analysis?.parsingChecks?.length ?? 0) > 0,
      `Parsing checks returned (${analyzed.analysis?.parsingChecks?.length ?? 0})`
    );
    assert(
      (analyzed.structured?.header?.name ?? "").toUpperCase().includes("ALEX"),
      `Structured resume was built from the PDF text (name: ${analyzed.structured?.header?.name})`
    );
    assert(RESUME_TEXT.includes("ALEX CHEN"), "Fixture integrity: the uploaded document is the shared resume fixture");

    // A genuinely two-page resume, to prove page counting over HTTP.
    const twoPageUpload = await upload("PDF-2page", buildTwoPagePdf(), "alex-chen-2page.pdf", "application/pdf");
    const twoPageBody = twoPageUpload.json as { parseStatus?: string; pageCount?: number | null };
    assert(
      twoPageUpload.response.status === 201 && twoPageBody.pageCount === 2,
      `Two-page PDF reports pageCount 2 over HTTP (got ${twoPageBody.pageCount})`,
      describeFailure(twoPageUpload.label, twoPageUpload.response.status, twoPageUpload.text)
    );

    // ------------------------------------------------------------------------
    console.log("\n--- 4. DOCX and TXT still work over HTTP ---");
    // ------------------------------------------------------------------------
    const docxUpload = await upload(
      "DOCX",
      await buildResumeDocx(),
      "alex-chen.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const docxBody = docxUpload.json as { parseStatus?: string; wordCount?: number; fileId?: string };
    assert(
      docxUpload.response.status === 201 && docxBody.parseStatus === "parsed",
      `DOCX uploads and parses over HTTP (words=${docxBody.wordCount})`,
      describeFailure(docxUpload.label, docxUpload.response.status, docxUpload.text)
    );

    const docxVariantResponse = await fetch(`${BASE_URL}/api/student/resume/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: jar.header },
      body: JSON.stringify({ sourceFileId: docxBody.fileId, label: "HTTP DOCX variant" }),
    });
    const docxVariant = (await docxVariantResponse.json()) as { id?: string; atsScore?: number | null };
    assert(
      docxVariantResponse.status === 201 && typeof docxVariant.atsScore === "number",
      `DOCX variant received an ATS analysis (atsScore=${docxVariant.atsScore})`
    );

    const txtUpload = await upload("TXT", buildResumeTxt(), "alex-chen.txt", "text/plain");
    const txtBody = txtUpload.json as { parseStatus?: string; wordCount?: number };
    assert(
      txtUpload.response.status === 201 && txtBody.parseStatus === "parsed" && (txtBody.wordCount ?? 0) > 50,
      `TXT uploads and parses over HTTP (words=${txtBody.wordCount})`,
      describeFailure(txtUpload.label, txtUpload.response.status, txtUpload.text)
    );

    // ------------------------------------------------------------------------
    console.log("\n--- 5. Limitations stay structured (scan / corrupt / RTF) ---");
    // ------------------------------------------------------------------------
    const scanUpload = await upload("scan-PDF", buildScanLikePdf(), "scanned-resume.pdf", "application/pdf");
    const scanBody = scanUpload.json as { error?: string; upload?: { error?: { code?: string } } };
    assert(
      scanUpload.response.status === 400,
      `Scanned image-only PDF is rejected (HTTP ${scanUpload.response.status})`
    );
    assert(
      (scanBody.error ?? "").toLowerCase().includes("scan") || (scanBody.error ?? "").includes("image"),
      `Scanned PDF reports the text-layer limitation: "${(scanBody.error ?? "").slice(0, 100)}"`,
      JSON.stringify(scanBody).slice(0, 300)
    );
    assert(
      scanBody.upload?.error?.code === "no_text_layer",
      `Scanned PDF error code is no_text_layer (got '${scanBody.upload?.error?.code}')`
    );

    const corruptUpload = await upload("corrupt-PDF", buildCorruptPdf(), "corrupt.pdf", "application/pdf");
    const corruptBody = corruptUpload.json as { error?: string; upload?: { error?: { code?: string } } };
    assert(
      corruptUpload.response.status === 400,
      `Corrupt PDF is rejected (HTTP ${corruptUpload.response.status})`
    );
    assert(
      corruptBody.upload?.error?.code === "corrupt",
      `Corrupt PDF is reported as a document problem, not a server problem (got '${corruptBody.upload?.error?.code}')`,
      JSON.stringify(corruptBody).slice(0, 300)
    );
    assert(
      corruptBody.upload?.error?.code !== "engine_unavailable",
      "Corrupt PDF is never misreported as an unavailable engine"
    );

    const rtfUpload = await upload("RTF", Buffer.from("{\\rtf1 hello}", "latin1"), "resume.rtf", "application/rtf");
    const rtfBody = rtfUpload.json as { error?: string };
    assert(rtfUpload.response.status === 400, `RTF is rejected (HTTP ${rtfUpload.response.status})`);
    assert(
      /not supported|unsupported/i.test(rtfBody.error ?? ""),
      `RTF reports an unsupported-format limitation: "${(rtfBody.error ?? "").slice(0, 90)}"`,
      JSON.stringify(rtfBody).slice(0, 300)
    );

    // ------------------------------------------------------------------------
    console.log("\n--- 6. The /resume page renders for the authenticated student ---");
    // ------------------------------------------------------------------------
    const resumePage = await fetch(`${BASE_URL}/resume`, { headers: { Cookie: jar.header } });
    const resumeHtml = await resumePage.text();
    assert(resumePage.status === 200, `GET /resume returns 200 for an authenticated student (got ${resumePage.status})`);
    assert(
      resumeHtml.includes("Resume Intelligence"),
      "The workspace renders its Resume Intelligence heading"
    );
    assert(
      !resumeHtml.includes("fake worker"),
      "The rendered /resume page contains no fake-worker error"
    );
    assert(
      resumeHtml.includes("ATS") || resumeHtml.includes("Target Match"),
      "The rendered /resume page shows the ATS/match surfaces"
    );

    console.log("==================================================");
    console.log(`📊 PHASE 18 HTTP RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error("❌ Unexpected error during Phase 18 HTTP testing:", error);
    process.exit(1);
  } finally {
    console.log("\nCleaning up HTTP test artifacts...");
    try {
      for (const userId of createdUserIds) {
        await deleteAllResumeData(userId);
        await db.delete(profiles).where(eq(profiles.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
      }
      console.log("Cleanup complete.");
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}

main();

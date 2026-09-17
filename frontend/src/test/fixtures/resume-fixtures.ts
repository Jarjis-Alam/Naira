/**
 * Phase 18 — shared resume fixtures.
 *
 * These build *real* documents, not stand-ins:
 *  - `buildTestPdf` emits a valid PDF with a real uncompressed text layer and a
 *    correct cross-reference table (so a real PDF parser reads it verbatim).
 *  - `buildTestDocx` emits a real DOCX package (zip with `word/document.xml`).
 *  - `buildScanLikePdf` emits a valid PDF whose only content is an inline image
 *    and no text layer, which is what a scanned resume looks like to a parser.
 *
 * They are shared by the Phase 18 suite and the live HTTP regression so both
 * exercise byte-identical inputs.
 */

import JSZip from "jszip";

export const RESUME_TEXT = `ALEX CHEN
alex.chen@example.com | +1 415 555 0132 | Bengaluru, India
github.com/alexchen | linkedin.com/in/alexchen

SUMMARY
Computer Science student focused on backend systems and databases.

EDUCATION
B.Tech, Computer Science — Nexora Engineering Institute | 2022 - 2026

EXPERIENCE
Software Engineering Intern — Acme Systems | Jun 2024 - Aug 2024
- Worked on backend development.
- Responsible for writing SQL queries for the reporting module.

PROJECTS
Campus Event Portal
- Built a web application using React and Node.js.
- Developed REST APIs consumed by the mobile client.

TECHNICAL SKILLS
Languages: Python, JavaScript, SQL
Frameworks: React, Node.js
Tools: Git

CERTIFICATIONS
- AWS Cloud Practitioner
`;

export const JOB_DESCRIPTION_TEXT = `Software Engineer — Microsoft

Requirements:
- Strong experience with Python and SQL
- Experience building REST APIs
- Knowledge of Data Structures and Algorithms
- Must have Docker and Kubernetes experience

Responsibilities:
- Design and build microservices
- Write unit tests and review code

Preferred:
- AWS experience
- System design knowledge
`;

function escapePdfString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdfTextStream(lines: string[]): string {
  return [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "72 730 Td",
    ...lines.map((line, index) => (index === 0 ? `(${escapePdfString(line)}) Tj` : `T* (${escapePdfString(line)}) Tj`)),
    "ET",
  ].join("\n");
}

/** Assemble numbered PDF objects into a file with a correct xref/trailer. */
function assemblePdf(objects: string[]): Buffer {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/**
 * A real, parser-readable PDF. Each entry in `pages` becomes one page with an
 * uncompressed text layer, so `pageCount` is genuinely decoded from the file.
 */
export function buildTestPdf(pages: string[][]): Buffer {
  const pageCount = Math.max(1, pages.length);
  // Objects: 1 = catalog, 2 = page tree, then a page + content pair per page,
  // and the shared font last. Getting this wrong makes /Contents point at the
  // font object and the PDF then legitimately contains no text at all.
  const fontObjectNumber = 3 + pageCount * 2;
  const pageObjectNumbers = pages.map((_, index) => 3 + index * 2);

  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(" ")}] /Count ${pageCount} >>`;

  pages.forEach((lines, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = pageObjectNumber + 1;
    const content = pdfTextStream(lines);

    objects[pageObjectNumber - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber - 1] = `<< /Length ${Buffer.byteLength(
      content,
      "latin1"
    )} >>\nstream\n${content}\nendstream`;
  });

  objects[fontObjectNumber - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  return assemblePdf(objects);
}

/** A valid PDF with a real text layer, one page per entry. */
export function buildResumePdf(): Buffer {
  return buildTestPdf([RESUME_TEXT.split("\n")]);
}

/** A genuine two-page resume PDF (used to assert page-count detection). */
export function buildTwoPagePdf(): Buffer {
  const lines = RESUME_TEXT.split("\n");
  const midpoint = Math.ceil(lines.length / 2);
  return buildTestPdf([lines.slice(0, midpoint), lines.slice(midpoint)]);
}

/**
 * A scan-like PDF: valid structure, an embedded image, and no text operators at
 * all. Extraction must report the missing text layer rather than returning
 * empty text as if it had succeeded.
 */
export function buildScanLikePdf(): Buffer {
  const imageBytes = Buffer.alloc(64, 0x80).toString("latin1");
  const content = `q\n100 0 0 100 72 600 cm\n/Im1 Do\nQ`;

  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${imageBytes.length} >>\nstream\n${imageBytes}\nendstream`,
  ]);
}

/**
 * A file that announces itself as a PDF (so it reaches the PDF parser rather
 * than being rejected by format validation) but has no valid structure.
 */
export function buildCorruptPdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nthis is not a real pdf body\n%%EOF\n", "latin1");
}

/** A file with no recognisable signature at all (rejected before parsing). */
export function buildUnrecognisedFile(): Buffer {
  return Buffer.from("this is definitely not a document", "latin1");
}

/** Build a minimal but valid DOCX package, optionally containing a table. */
export async function buildTestDocx(lines: string[], options: { table?: boolean } = {}): Promise<Buffer> {
  const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraph = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  const table = options.table
    ? `<w:tbl><w:tr><w:tc>${paragraph("Column A")}</w:tc><w:tc>${paragraph("Column B")}</w:tc></w:tr></w:tbl>`
    : "";

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines
      .map(paragraph)
      .join("")}${table}<w:sectPr/></w:body></w:document>`
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

/** A real DOCX resume. */
export function buildResumeDocx(): Promise<Buffer> {
  return buildTestDocx(RESUME_TEXT.split("\n"));
}

/** A plain-text resume. */
export function buildResumeTxt(): Buffer {
  return Buffer.from(RESUME_TEXT, "utf8");
}

export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,.]*/g) ?? []).map((value) => value.replace(/,/g, ""));
}

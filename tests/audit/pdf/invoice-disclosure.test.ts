// tests/audit/pdf/invoice-disclosure.test.ts
//
// Guards FINDING-161: the PDF invoice must carry an explicit legal disclosure
// that it is a proforma invoice, not a tax invoice under SA VAT Act s20.
//
// Why structural source tests (not render tests):
//   @react-pdf/renderer produces a binary PDF buffer — diffing rendered output
//   reliably requires either a PDF parser or a snapshot of the buffer, both
//   of which are fragile across renderer versions. Reading the source directly
//   is a deterministic, zero-dependency alternative that catches text changes
//   and regressions without requiring a full render pass.
//
// Tests:
//   1. Verbatim disclosure text is present in source
//   2. Document heading is exclusively "PROFORMA INVOICE" — no other variant
//   3. ProformaDisclosure component is rendered inside InvoiceDocument
//   4. Document metadata subject does not say "Tax Invoice"

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

let source: string;

try {
  source = fs.readFileSync(
    path.resolve(__dirname, "../../../src/lib/pdf/invoice.tsx"),
    "utf-8"
  );
} catch {
  source = "";
}

// Required disclosure sentences — verbatim per FINDING-161 spec.
// Each sentence is checked independently because the source may split the
// string across lines using concatenation. Any wording change must be
// reviewed for SA VAT Act s20 compliance.
const REQUIRED_SENTENCES = [
  "This is a proforma invoice for order confirmation purposes only.",
  "It is not a valid tax invoice under section 20 of the Value-Added Tax Act, 1991.",
  "A full tax invoice will be issued separately upon payment.",
] as const;

describe("PDF invoice — proforma disclosure (FINDING-161)", () => {
  it("source file exists", () => {
    expect(source, "invoice.tsx not found").not.toBe("");
  });

  it("contains each required disclosure sentence verbatim", () => {
    // Each sentence is a legal requirement — paraphrasing is not acceptable.
    // If any assertion fails after a wording change, the change must be
    // reviewed for SA VAT Act s20 compliance before merging.
    for (const sentence of REQUIRED_SENTENCES) {
      expect(source, `missing sentence: "${sentence}"`).toContain(sentence);
    }
  });

  it("ProformaDisclosure component is used inside InvoiceDocument", () => {
    // The component must appear in the rendered tree, not just be defined.
    // Check that <ProformaDisclosure is included inside InvoiceDocument.
    const docMatch = source.match(
      /function InvoiceDocument[\s\S]*?^function \w/m
    );
    const docBody = docMatch ? docMatch[0] : source;
    expect(docBody).toMatch(/<ProformaDisclosure/);
  });

  it("heading is exactly 'PROFORMA INVOICE' — no alternative rendering path", () => {
    // The rendered title text must be "PROFORMA INVOICE" — not "TAX INVOICE",
    // "INVOICE", "Proforma Invoice", or any other variant.
    // We look for the literal string inside a JSX Text node.
    expect(source).toMatch(/PROFORMA INVOICE/);

    // Verify there is no code path that renders a different title variant.
    // A bare "TAX INVOICE" string inside JSX would be the red flag.
    // (Comments and the metadata subject are excluded by checking JSX context.)
    const jsxTextPattern = />TAX INVOICE</;
    expect(source).not.toMatch(jsxTextPattern);

    const jsxInvoiceAlone = />INVOICE</;
    expect(source).not.toMatch(jsxInvoiceAlone);
  });

  it("Document metadata subject does not say 'Tax Invoice'", () => {
    // The PDF document metadata subject was found to read "Tax Invoice — ..."
    // which is inconsistent with the proforma-only approach. It should be
    // "Proforma Invoice — ..." or similar, never "Tax Invoice".
    expect(source).not.toMatch(/subject=\{`Tax Invoice/);
  });
});

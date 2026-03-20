/**
 * SupplierInvoice — internal order notification for the warehouse / accounts team.
 * Sent to tenant_config.email_from_address with the PDF invoice attached.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";

export interface SupplierInvoiceProps {
  /** Buyer's registered business name */
  buyerBusinessName: string;
  /** Buyer's account number (may be null for new accounts) */
  buyerAccountNumber: string | null;
  /** Buyer's contact email */
  buyerEmail: string | null;
  /** Order reference e.g. ORD-00042 */
  orderReference: string;
  /** Formatted total amount string e.g. "R 1 234.56" */
  totalFormatted: string;
  /** ISO date string of the order */
  orderDate: string;
  /** Payment method label */
  paymentMethod: "EFT" | "30-Day Account";
  /** Supplier / tenant business name */
  supplierName: string;
  orderNotes?: string | null;
}

const C = {
  bg: "#ffffff",
  border: "#e2e8f0",
  heading: "#0f172a",
  body: "#334155",
  muted: "#94a3b8",
  accent: "#0f172a",
  accentBg: "#f8fafc",
};

const s = {
  body: {
    backgroundColor: C.bg,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  brand: {
    fontSize: "11px",
    fontWeight: "700" as const,
    color: C.muted,
    textTransform: "uppercase" as const,
    letterSpacing: "1.2px",
    marginBottom: "32px",
  },
  heading: {
    fontSize: "22px",
    fontWeight: "700" as const,
    color: C.heading,
    margin: "0 0 8px",
    lineHeight: "1.3",
  },
  subheading: {
    fontSize: "14px",
    color: C.body,
    margin: "0 0 32px",
    lineHeight: "1.6",
  },
  infoBox: {
    backgroundColor: C.accentBg,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "20px 24px",
    marginBottom: "24px",
  },
  infoLabel: {
    fontSize: "10px",
    fontWeight: "600" as const,
    color: C.muted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
    marginBottom: "4px",
  },
  infoValue: {
    fontSize: "14px",
    fontWeight: "600" as const,
    color: C.heading,
    marginBottom: "0",
  },
  infoValueLg: {
    fontSize: "20px",
    fontWeight: "700" as const,
    color: C.accent,
    marginBottom: "0",
  },
  hr: {
    borderColor: C.border,
    margin: "24px 0",
  },
  note: {
    fontSize: "13px",
    color: C.body,
    lineHeight: "1.6",
    marginBottom: "8px",
  },
  footer: {
    fontSize: "11px",
    color: C.muted,
    marginTop: "32px",
    lineHeight: "1.6",
  },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SupplierInvoice({
  buyerBusinessName,
  buyerAccountNumber,
  buyerEmail,
  orderReference,
  totalFormatted,
  orderDate,
  paymentMethod,
  supplierName,
  orderNotes,
}: SupplierInvoiceProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        New order #{orderReference} from {buyerBusinessName} —{" "}
        {totalFormatted}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Brand */}
          <Text style={s.brand}>{supplierName}</Text>

          {/* Heading */}
          <Heading style={s.heading}>New Order Received</Heading>
          <Text style={s.subheading}>
            A new order has been placed by{" "}
            <strong>{buyerBusinessName}</strong>. The official PDF invoice
            is attached to this email.
          </Text>

          {/* Order summary box */}
          <Section style={s.infoBox}>
            <Row style={{ marginBottom: "16px" }}>
              <Column>
                <Text style={s.infoLabel}>Order Reference</Text>
                <Text style={s.infoValue}>#{orderReference}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <Text style={s.infoLabel}>Order Date</Text>
                <Text style={s.infoValue}>{fmtDate(orderDate)}</Text>
              </Column>
            </Row>
            <Row style={{ marginBottom: "16px" }}>
              <Column>
                <Text style={s.infoLabel}>Total Amount</Text>
                <Text style={s.infoValueLg}>{totalFormatted}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <Text style={s.infoLabel}>Payment Method</Text>
                <Text style={s.infoValue}>{paymentMethod}</Text>
              </Column>
            </Row>
            <Hr style={{ borderColor: C.border, margin: "12px 0" }} />
            <Row>
              <Column>
                <Text style={s.infoLabel}>Buyer</Text>
                <Text style={s.infoValue}>{buyerBusinessName}</Text>
              </Column>
              {buyerAccountNumber && (
                <Column style={{ textAlign: "right" as const }}>
                  <Text style={s.infoLabel}>Account No.</Text>
                  <Text style={s.infoValue}>{buyerAccountNumber}</Text>
                </Column>
              )}
            </Row>
            {buyerEmail && (
              <Row style={{ marginTop: "8px" }}>
                <Column>
                  <Text style={s.infoLabel}>Buyer Email</Text>
                  <Text style={s.infoValue}>{buyerEmail}</Text>
                </Column>
              </Row>
            )}
          </Section>

          {orderNotes && (
            <Section style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "16px 20px", marginBottom: "16px" }}>
              <Text style={{ fontSize: "10px", fontWeight: "600", color: "#ea580c", textTransform: "uppercase" as const, letterSpacing: "0.8px", margin: "0 0 6px" }}>
                Message / Instructions from Buyer
              </Text>
              <Text style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6", margin: "0" }}>
                {orderNotes}
              </Text>
            </Section>
          )}

          {/* Note */}
          <Text style={s.note}>
            The PDF invoice is attached. Please process this order and retain
            the attachment for your records.
          </Text>

          <Hr style={s.hr} />

          {/* Footer */}
          <Text style={s.footer}>
            This is an automated internal notification from {supplierName}.
            Do not reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

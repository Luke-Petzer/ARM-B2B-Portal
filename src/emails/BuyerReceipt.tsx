/**
 * BuyerReceipt — order acknowledgment sent to the buyer.
 * No PDF attached. Clean, reassuring confirmation.
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

export interface BuyerReceiptProps {
  /** Buyer's first contact name */
  contactName: string;
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
  /** Supplier support email (shown in footer) */
  supportEmail: string | null;
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
  green: "#16a34a",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
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
  confirmBadge: {
    backgroundColor: C.greenBg,
    border: `1px solid ${C.greenBorder}`,
    borderRadius: "6px",
    padding: "10px 16px",
    marginBottom: "24px",
    display: "inline-block" as const,
  },
  confirmBadgeText: {
    fontSize: "12px",
    fontWeight: "600" as const,
    color: C.green,
    margin: "0",
    letterSpacing: "0.2px",
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
  body14: {
    fontSize: "13px",
    color: C.body,
    lineHeight: "1.7",
    marginBottom: "12px",
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

export default function BuyerReceipt({
  contactName,
  orderReference,
  totalFormatted,
  orderDate,
  paymentMethod,
  supplierName,
  supportEmail,
  orderNotes,
}: BuyerReceiptProps) {
  const firstName = contactName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Order #{orderReference} confirmed — {totalFormatted}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Brand */}
          <Text style={s.brand}>{supplierName}</Text>

          {/* Confirmation badge */}
          <Section style={s.confirmBadge}>
            <Text style={s.confirmBadgeText}>✓ Order Confirmed</Text>
          </Section>

          {/* Heading */}
          <Heading style={s.heading}>
            Thank you, {firstName}.
          </Heading>
          <Text style={s.subheading}>
            We&apos;ve received your order and it is now being processed. Your
            order details are below for your records.
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
            <Hr style={{ borderColor: C.border, margin: "12px 0" }} />
            <Row>
              <Column>
                <Text style={s.infoLabel}>Total Amount (incl. VAT)</Text>
                <Text style={s.infoValueLg}>{totalFormatted}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <Text style={s.infoLabel}>Payment Method</Text>
                <Text style={s.infoValue}>{paymentMethod}</Text>
              </Column>
            </Row>
          </Section>

          {/* Next steps */}
          <Text style={s.body14}>
            {paymentMethod === "EFT"
              ? "Please complete your EFT transfer using the banking details provided on your confirmation page. Use your order reference as the payment reference so we can match your transfer promptly."
              : "This order has been raised against your 30-day credit account. A formal invoice will follow separately."}
          </Text>
          <Text style={s.body14}>
            If you have any questions, please don&apos;t hesitate to get in
            touch.
          </Text>

          {orderNotes && (
            <Section style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "16px 20px", marginBottom: "16px" }}>
              <Text style={{ fontSize: "10px", fontWeight: "600", color: "#3b82f6", textTransform: "uppercase" as const, letterSpacing: "0.8px", margin: "0 0 6px" }}>
                Your Delivery Instructions
              </Text>
              <Text style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6", margin: "0" }}>
                {orderNotes}
              </Text>
            </Section>
          )}

          <Hr style={s.hr} />

          {/* Footer */}
          <Text style={s.footer}>
            {supplierName}
            {supportEmail ? ` · ${supportEmail}` : ""}
            {"\n"}This is an automated confirmation. Please do not reply
            directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

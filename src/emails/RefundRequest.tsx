/**
 * RefundRequest — two email templates for the refund request flow.
 *
 * BuyerRefundConfirmationEmail  — sent to the buyer confirming submission.
 * BusinessRefundNotificationEmail — sent to the supplier with full details.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// ── Shared design tokens ───────────────────────────────────────────────────

const C = {
  bg: "#ffffff",
  border: "#e2e8f0",
  heading: "#0f172a",
  body: "#334155",
  muted: "#94a3b8",
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
  heading: {
    fontSize: "20px",
    fontWeight: "700",
    color: C.heading,
    margin: "0 0 8px",
  },
  bodyText: {
    fontSize: "14px",
    color: C.body,
    lineHeight: "1.6",
    margin: "0 0 16px",
  },
  muted: {
    fontSize: "12px",
    color: C.muted,
    margin: "0",
  },
  infoBox: {
    backgroundColor: C.accentBg,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "16px",
    margin: "16px 0",
  },
  label: {
    fontSize: "11px",
    fontWeight: "600",
    color: C.muted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 2px",
  },
  value: {
    fontSize: "14px",
    color: C.heading,
    fontWeight: "500",
    margin: "0 0 12px",
  },
};

// ── Shared types ───────────────────────────────────────────────────────────

export interface RefundRequestEmailProps {
  /** Buyer contact name */
  contactName: string;
  /** Order reference e.g. ORD-00042 */
  orderReference: string;
  /** Refund request reference e.g. RRQ-00001 */
  requestReference: string;
  /** Human-readable reason label */
  reasonLabel: string;
  /** Date buyer claims goods were received */
  dateReceived: string;
  /** Optional extra details from buyer */
  details?: string | null;
  /** Supplier / tenant business name */
  supplierName: string;
  /** Buyer email address (for business notification) */
  buyerEmail: string;
  /** Admin URL to view this request in the portal (for business notification) */
  adminUrl: string;
}

// ── Buyer confirmation email ────────────────────────────────────────────────

export function BuyerRefundConfirmationEmail({
  contactName,
  orderReference,
  requestReference,
  reasonLabel,
  supplierName,
}: RefundRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your return request {requestReference} for {orderReference} has been received.</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Heading style={s.heading}>Return Request Received</Heading>
          <Text style={s.bodyText}>Hi {contactName},</Text>
          <Text style={s.bodyText}>
            We have received your return request for order{" "}
            <strong>{orderReference}</strong>. Our team will review it and
            contact you within <strong>3 business days</strong>.
          </Text>

          <Section style={s.infoBox}>
            <Text style={s.label}>Request Reference</Text>
            <Text style={s.value}>{requestReference}</Text>

            <Text style={s.label}>Order Reference</Text>
            <Text style={s.value}>{orderReference}</Text>

            <Text style={s.label}>Reason Submitted</Text>
            <Text style={{ ...s.value, marginBottom: "0" }}>{reasonLabel}</Text>
          </Section>

          <Text style={s.bodyText}>
            Under the Consumer Protection Act 68 of 2008, you have the right to
            return defective or incorrectly described goods within 6 months of
            delivery. {supplierName} will assess your request and respond
            accordingly.
          </Text>

          <Hr style={{ borderColor: C.border, margin: "24px 0" }} />

          <Text style={s.muted}>
            Please quote your request reference <strong>{requestReference}</strong> in
            any correspondence. If you have urgent questions, please reply to this
            email or contact {supplierName} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Business notification email ─────────────────────────────────────────────

export function BusinessRefundNotificationEmail({
  contactName,
  orderReference,
  requestReference,
  reasonLabel,
  dateReceived,
  details,
  supplierName,
  buyerEmail,
  adminUrl,
}: RefundRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        New return request {requestReference} from {contactName} — {orderReference}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Heading style={s.heading}>New Return Request</Heading>
          <Text style={s.bodyText}>
            A return request has been submitted by a customer via the ordering
            portal. Details below.
          </Text>

          <Section style={s.infoBox}>
            <Text style={s.label}>Request Reference</Text>
            <Text style={s.value}>{requestReference}</Text>

            <Text style={s.label}>Order Reference</Text>
            <Text style={s.value}>{orderReference}</Text>

            <Text style={s.label}>Customer</Text>
            <Text style={s.value}>{contactName}</Text>

            <Text style={s.label}>Customer Email</Text>
            <Text style={s.value}>{buyerEmail}</Text>

            <Text style={s.label}>Reason</Text>
            <Text style={s.value}>{reasonLabel}</Text>

            <Text style={s.label}>Date Goods Received</Text>
            <Text style={s.value}>{dateReceived}</Text>

            {details && (
              <>
                <Text style={s.label}>Additional Details</Text>
                <Text style={{ ...s.value, marginBottom: "0" }}>{details}</Text>
              </>
            )}
          </Section>

          <Text style={s.bodyText}>
            Please review this request and contact the customer within 3
            business days in accordance with your returns policy.{" "}
            {adminUrl && (
              <>
                <Link href={adminUrl} style={{ color: C.heading }}>
                  View in admin portal →
                </Link>
              </>
            )}
          </Text>

          <Hr style={{ borderColor: C.border, margin: "24px 0" }} />
          <Text style={s.muted}>{supplierName} — {new Date().getFullYear()}</Text>
        </Container>
      </Body>
    </Html>
  );
}

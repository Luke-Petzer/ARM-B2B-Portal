/**
 * OrderApprovedNotification — sent to the buyer when an admin approves their
 * order and marks it as dispatched, regardless of payment method.
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
} from "@react-email/components";

export interface OrderApprovedNotificationProps {
  /** Buyer's full contact name */
  contactName: string;
  /** Order reference e.g. ORD-00042 */
  orderReference: string;
  /** ISO date string when the order was approved */
  approvedAt: string;
  /** Supplier / tenant business name */
  supplierName: string;
  /** Supplier support email (shown in footer) */
  supportEmail: string | null;
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
  approvedBadge: {
    backgroundColor: C.greenBg,
    border: `1px solid ${C.greenBorder}`,
    borderRadius: "6px",
    padding: "10px 16px",
    marginBottom: "24px",
    display: "inline-block" as const,
  },
  approvedBadgeText: {
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
    margin: "0 0 4px",
  },
  infoValue: {
    fontSize: "14px",
    fontWeight: "600" as const,
    color: C.heading,
    margin: "0",
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

export default function OrderApprovedNotification({
  contactName,
  orderReference,
  approvedAt,
  supplierName,
  supportEmail,
}: OrderApprovedNotificationProps) {
  const firstName = contactName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Order #{orderReference} approved — now with the dispatch team
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Brand */}
          <Text style={s.brand}>{supplierName}</Text>

          {/* Approved badge */}
          <Section style={s.approvedBadge}>
            <Text style={s.approvedBadgeText}>✓ Order Approved</Text>
          </Section>

          {/* Heading */}
          <Heading style={s.heading}>
            Great news, {firstName}.
          </Heading>
          <Text style={s.subheading}>
            Your order has been reviewed and officially approved. It has been
            handed off to our dispatch team and is now being prepared for
            delivery.
          </Text>

          {/* Order reference box */}
          <Section style={s.infoBox}>
            <Text style={s.infoLabel}>Order Reference</Text>
            <Text style={s.infoValue}>#{orderReference}</Text>
            <Hr style={{ borderColor: C.border, margin: "12px 0" }} />
            <Text style={s.infoLabel}>Approved On</Text>
            <Text style={s.infoValue}>{fmtDate(approvedAt)}</Text>
          </Section>

          {/* Body copy */}
          <Text style={s.body14}>
            Please keep your order reference handy — you may need it if you
            contact us about this delivery. Our dispatch team will be in touch
            if they need any further information from you.
          </Text>
          <Text style={s.body14}>
            Thank you for your order. We appreciate your business.
          </Text>

          <Hr style={s.hr} />

          {/* Footer */}
          <Text style={s.footer}>
            {supplierName}
            {supportEmail ? ` · ${supportEmail}` : ""}
            {"\n"}This is an automated notification. Please do not reply
            directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * DispatchNotification — sent to the warehouse/dispatch team when an order
 * is first approved (pending → confirmed). A dispatch sheet PDF is attached.
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

export interface DispatchNotificationProps {
  orderReference: string;
  clientBusinessName: string;
  orderDate: string; // ISO string
  itemCount: number;
  orderNotes: string | null;
  supplierName: string;
}

const C = {
  bg: "#ffffff",
  border: "#e2e8f0",
  heading: "#0f172a",
  body: "#334155",
  muted: "#94a3b8",
  accent: "#0f172a",
  accentBg: "#f8fafc",
  amber: "#b45309",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
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
  dispatchBadge: {
    backgroundColor: C.amberBg,
    border: `1px solid ${C.amberBorder}`,
    borderRadius: "6px",
    padding: "10px 16px",
    marginBottom: "24px",
    display: "inline-block" as const,
  },
  dispatchBadgeText: {
    fontSize: "12px",
    fontWeight: "600" as const,
    color: C.amber,
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

export default function DispatchNotification({
  orderReference,
  clientBusinessName,
  orderDate,
  itemCount,
  orderNotes,
  supplierName,
}: DispatchNotificationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Dispatch: {orderReference} — {clientBusinessName}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Brand */}
          <Text style={s.brand}>{supplierName}</Text>

          {/* Dispatch badge */}
          <Section style={s.dispatchBadge}>
            <Text style={s.dispatchBadgeText}>Dispatch Required</Text>
          </Section>

          {/* Heading */}
          <Heading style={s.heading}>New order approved for dispatch.</Heading>
          <Text style={s.subheading}>
            The following order has been confirmed and is ready for picking and
            dispatch. The dispatch sheet is attached as a PDF.
          </Text>

          {/* Order summary box */}
          <Section style={s.infoBox}>
            <Row style={{ marginBottom: "16px" }}>
              <Column>
                <Text style={s.infoLabel}>Order Reference</Text>
                <Text style={s.infoValueLg}>#{orderReference}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <Text style={s.infoLabel}>Order Date</Text>
                <Text style={s.infoValue}>{fmtDate(orderDate)}</Text>
              </Column>
            </Row>
            <Hr style={{ borderColor: C.border, margin: "12px 0" }} />
            <Row>
              <Column>
                <Text style={s.infoLabel}>Client</Text>
                <Text style={s.infoValue}>{clientBusinessName}</Text>
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <Text style={s.infoLabel}>Line Items</Text>
                <Text style={s.infoValue}>
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </Text>
              </Column>
            </Row>
          </Section>

          <Text style={s.body14}>
            Please refer to the attached dispatch sheet for the full SKU and
            quantity list. No pricing information is included on the sheet.
          </Text>

          {orderNotes && (
            <Section
              style={{
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "16px",
              }}
            >
              <Text
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "#3b82f6",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.8px",
                  margin: "0 0 6px",
                }}
              >
                Order Notes / Delivery Instructions
              </Text>
              <Text
                style={{
                  fontSize: "13px",
                  color: "#334155",
                  lineHeight: "1.6",
                  margin: "0",
                }}
              >
                {orderNotes}
              </Text>
            </Section>
          )}

          <Hr style={s.hr} />

          {/* Footer */}
          <Text style={s.footer}>
            {supplierName}
            {"\n"}This is an automated dispatch notification. Please do not
            reply directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

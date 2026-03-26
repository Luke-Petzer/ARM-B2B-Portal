/**
 * ClientStatement — outstanding orders statement sent to a 30-day credit client.
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

export interface StatementOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface StatementOrder {
  referenceNumber: string;
  confirmedAt: string;
  totalAmount: number;
  totalFormatted: string;
  items: StatementOrderItem[];
}

export interface ClientStatementProps {
  businessName: string;
  contactName: string;
  accountNumber: string | null;
  orders: StatementOrder[];
  totalOutstanding: string;
  supplierName: string;
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
  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
};

const s = {
  body: {
    backgroundColor: C.bg,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    maxWidth: "600px",
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
  totalBox: {
    backgroundColor: C.redBg,
    border: `1px solid ${C.redBorder}`,
    borderRadius: "8px",
    padding: "20px 24px",
    marginBottom: "32px",
  },
  totalLabel: {
    fontSize: "10px",
    fontWeight: "600" as const,
    color: C.red,
    textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
    marginBottom: "4px",
  },
  totalValue: {
    fontSize: "28px",
    fontWeight: "700" as const,
    color: C.red,
    margin: "0",
  },
  sectionHeading: {
    fontSize: "10px",
    fontWeight: "600" as const,
    color: C.muted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
    margin: "0 0 12px",
  },
  orderCard: {
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "16px 20px",
    marginBottom: "12px",
    backgroundColor: C.accentBg,
  },
  orderRef: {
    fontSize: "13px",
    fontWeight: "600" as const,
    color: C.heading,
    margin: "0 0 2px",
  },
  orderMeta: {
    fontSize: "11px",
    color: C.muted,
    margin: "0 0 10px",
  },
  itemRow: {
    fontSize: "12px",
    color: C.body,
    margin: "3px 0",
  },
  orderTotal: {
    fontSize: "13px",
    fontWeight: "600" as const,
    color: C.heading,
    margin: "10px 0 0",
  },
  hr: {
    borderColor: C.border,
    margin: "24px 0",
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

function fmtR(n: number): string {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ClientStatement({
  businessName,
  contactName,
  accountNumber,
  orders,
  totalOutstanding,
  supplierName,
  supportEmail,
}: ClientStatementProps) {
  const firstName = contactName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Account statement for {businessName} — {totalOutstanding} outstanding
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Brand */}
          <Text style={s.brand}>{supplierName}</Text>

          {/* Heading */}
          <Heading style={s.heading}>Account Statement</Heading>
          <Text style={s.subheading}>
            Hi {firstName}, please find your current account statement below
            {accountNumber ? ` (Account: ${accountNumber})` : ""}.
            This lists all outstanding orders on your 30-day credit account.
          </Text>

          {/* Total outstanding */}
          <Section style={s.totalBox}>
            <Text style={s.totalLabel}>Total Outstanding</Text>
            <Text style={s.totalValue}>{totalOutstanding}</Text>
          </Section>

          {/* Orders */}
          {orders.length === 0 ? (
            <Text style={{ fontSize: "14px", color: C.muted }}>
              You have no outstanding orders at this time.
            </Text>
          ) : (
            <>
              <Text style={s.sectionHeading}>
                Outstanding Orders ({orders.length})
              </Text>
              {orders.map((order) => (
                <Section key={order.referenceNumber} style={s.orderCard}>
                  <Row>
                    <Column>
                      <Text style={s.orderRef}>#{order.referenceNumber}</Text>
                      <Text style={s.orderMeta}>
                        Approved {fmtDate(order.confirmedAt)}
                      </Text>
                    </Column>
                    <Column style={{ textAlign: "right" as const }}>
                      <Text style={s.orderTotal}>{order.totalFormatted}</Text>
                    </Column>
                  </Row>
                  {order.items.map((item, i) => (
                    <Text key={i} style={s.itemRow}>
                      {item.quantity}× {item.productName} — {fmtR(item.lineTotal)}
                    </Text>
                  ))}
                </Section>
              ))}
            </>
          )}

          <Hr style={s.hr} />

          {/* Payment instructions */}
          <Text style={{ fontSize: "13px", color: C.body, lineHeight: "1.7" }}>
            Please settle the outstanding balance by your agreed payment terms.
            If you have any questions about this statement, please contact us.
          </Text>

          {/* Footer */}
          <Text style={s.footer}>
            {supplierName}
            {supportEmail ? ` · ${supportEmail}` : ""}
            {"\n"}This is an automated statement. Please do not reply directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * PDF Invoice generator — @react-pdf/renderer
 *
 * Usage (server-side only):
 *   import { renderInvoiceToBuffer } from "@/lib/pdf/invoice";
 *   const pdfBuffer = await renderInvoiceToBuffer({ order, items, profile, config });
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Prop types (Row shapes from DB types)
// ---------------------------------------------------------------------------

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TenantConfig = Database["public"]["Tables"]["tenant_config"]["Row"];

export interface InvoiceProps {
  order: Order;
  items: OrderItem[];
  profile: Profile;
  config: TenantConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

function fmt(n: number | string | null | undefined): string {
  return ZAR.format(Number(n ?? 0));
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Styles — monochrome corporate palette
// ---------------------------------------------------------------------------

const C = {
  black: "#0f172a",
  mid: "#475569",
  light: "#94a3b8",
  rule: "#e2e8f0",
  bg: "#f8fafc",
  white: "#ffffff",
  accent: "#0f172a",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.black,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    backgroundColor: C.white,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  supplierBlock: {
    flexDirection: "column",
    gap: 2,
  },
  supplierName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    marginBottom: 4,
  },
  supplierMeta: {
    fontSize: 7.5,
    color: C.mid,
    lineHeight: 1.5,
  },
  invoiceTitleBlock: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    letterSpacing: 1,
  },
  invoiceRef: {
    fontSize: 9,
    color: C.mid,
    marginTop: 4,
  },
  invoiceDate: {
    fontSize: 8,
    color: C.light,
    marginTop: 2,
  },

  // ── Divider ─────────────────────────────────────────────────────────────
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    marginBottom: 20,
  },
  ruleDark: {
    borderBottomWidth: 1,
    borderBottomColor: C.black,
    marginBottom: 20,
  },

  // ── Meta row (Bill To + Order Details side-by-side) ──────────────────
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 24,
  },
  metaBlock: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.light,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metaValueLg: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.black,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 8,
    color: C.mid,
    lineHeight: 1.5,
  },
  metaPair: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 3,
  },
  metaKey: {
    fontSize: 7.5,
    color: C.light,
    width: 80,
  },
  metaVal: {
    fontSize: 7.5,
    color: C.mid,
    flex: 1,
  },

  // ── Line items table ─────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.black,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 0,
  },
  tableHeaderCell: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  tableRowAlt: {
    backgroundColor: C.bg,
  },
  tableCell: {
    fontSize: 8,
    color: C.black,
    lineHeight: 1.4,
  },
  tableCellMuted: {
    fontSize: 7.5,
    color: C.mid,
  },

  // Column widths
  colSku: { width: 80 },
  colDesc: { flex: 1 },
  colQty: { width: 36, textAlign: "right" },
  colUnitPrice: { width: 72, textAlign: "right" },
  colLineTotal: { width: 72, textAlign: "right" },

  // ── Totals ────────────────────────────────────────────────────────────
  totalsWrapper: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    marginBottom: 28,
  },
  totalsBlock: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    backgroundColor: C.black,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  totalsLabel: {
    fontSize: 8,
    color: C.mid,
  },
  totalsValue: {
    fontSize: 8,
    color: C.black,
    fontFamily: "Helvetica-Bold",
  },
  totalsFinalLabel: {
    fontSize: 9,
    color: C.white,
    fontFamily: "Helvetica-Bold",
  },
  totalsFinalValue: {
    fontSize: 9,
    color: C.white,
    fontFamily: "Helvetica-Bold",
  },

  // ── Banking details ───────────────────────────────────────────────────
  bankSection: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 4,
    padding: 14,
    marginBottom: 20,
  },
  bankTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.light,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  bankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  bankCell: {
    width: "33.33%",
    marginBottom: 8,
  },
  bankLabel: {
    fontSize: 6.5,
    color: C.light,
    marginBottom: 2,
  },
  bankValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.black,
  },
  bankRefCell: {
    width: "100%",
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  bankRefLabel: {
    fontSize: 6.5,
    color: C.light,
    marginBottom: 2,
  },
  bankRefValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.black,
  },

  // ── Footer ────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.rule,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: C.light,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ order, config }: { order: Order; config: TenantConfig }) {
  return (
    <View style={styles.headerRow}>
      {/* Left — supplier identity */}
      <View style={styles.supplierBlock}>
        <Text style={styles.supplierName}>
          {config.trading_name ?? config.business_name}
        </Text>
        {config.vat_number && (
          <Text style={styles.supplierMeta}>
            VAT Reg: {config.vat_number}
          </Text>
        )}
        {config.support_email && (
          <Text style={styles.supplierMeta}>{config.support_email}</Text>
        )}
        {config.support_phone && (
          <Text style={styles.supplierMeta}>{config.support_phone}</Text>
        )}
      </View>

      {/* Right — invoice title + ref */}
      <View style={styles.invoiceTitleBlock}>
        <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
        <Text style={styles.invoiceRef}>#{order.reference_number}</Text>
        <Text style={styles.invoiceDate}>
          Date: {fmtDate(order.created_at)}
        </Text>
      </View>
    </View>
  );
}

function MetaSection({
  order,
  profile,
  config,
}: {
  order: Order;
  profile: Profile;
  config: TenantConfig;
}) {
  const paymentLabel =
    order.payment_method === "eft"
      ? "EFT"
      : `30-Day Account (${config.payment_terms_days} days)`;

  return (
    <View style={styles.metaRow}>
      {/* Bill To */}
      <View style={styles.metaBlock}>
        <Text style={styles.metaLabel}>Bill To</Text>
        <Text style={styles.metaValueLg}>{profile.business_name}</Text>
        {profile.trading_name && (
          <Text style={styles.metaValue}>t/a {profile.trading_name}</Text>
        )}
        {profile.contact_name && (
          <Text style={styles.metaValue}>Attn: {profile.contact_name}</Text>
        )}
        {profile.email && (
          <Text style={styles.metaValue}>{profile.email}</Text>
        )}
        {profile.vat_number && (
          <Text style={styles.metaValue}>VAT: {profile.vat_number}</Text>
        )}
      </View>

      {/* Order Details */}
      <View style={styles.metaBlock}>
        <Text style={styles.metaLabel}>Order Details</Text>
        <View style={styles.metaPair}>
          <Text style={styles.metaKey}>Reference</Text>
          <Text style={styles.metaVal}>#{order.reference_number}</Text>
        </View>
        {profile.account_number && (
          <View style={styles.metaPair}>
            <Text style={styles.metaKey}>Account No.</Text>
            <Text style={styles.metaVal}>{profile.account_number}</Text>
          </View>
        )}
        <View style={styles.metaPair}>
          <Text style={styles.metaKey}>Order Date</Text>
          <Text style={styles.metaVal}>{fmtDate(order.created_at)}</Text>
        </View>
        <View style={styles.metaPair}>
          <Text style={styles.metaKey}>Payment</Text>
          <Text style={styles.metaVal}>{paymentLabel}</Text>
        </View>
        <View style={styles.metaPair}>
          <Text style={styles.metaKey}>Status</Text>
          <Text style={[styles.metaVal, { textTransform: "capitalize" }]}>
            {order.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <View>
      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU</Text>
        <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
        <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>
          Unit Price
        </Text>
        <Text style={[styles.tableHeaderCell, styles.colLineTotal]}>
          Line Total
        </Text>
      </View>

      {/* Rows */}
      {items.map((item, idx) => (
        <View
          key={item.id}
          style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}
        >
          <Text style={[styles.tableCell, styles.colSku]}>{item.sku}</Text>
          <View style={styles.colDesc}>
            <Text style={styles.tableCell}>{item.product_name}</Text>
            {item.discount_pct > 0 && (
              <Text style={styles.tableCellMuted}>
                {item.discount_pct}% discount applied
              </Text>
            )}
          </View>
          <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
          <Text style={[styles.tableCell, styles.colUnitPrice]}>
            {fmt(item.unit_price)}
          </Text>
          <Text style={[styles.tableCell, styles.colLineTotal]}>
            {fmt(item.line_total)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Totals({ order, config }: { order: Order; config: TenantConfig }) {
  const vatPct = Math.round(Number(config.vat_rate) * 100);
  return (
    <View style={styles.totalsWrapper}>
      <View style={styles.totalsBlock}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal (excl. VAT)</Text>
          <Text style={styles.totalsValue}>{fmt(order.subtotal)}</Text>
        </View>
        {Number(order.discount_amount) > 0 && (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Discount</Text>
            <Text style={styles.totalsValue}>
              -{fmt(order.discount_amount)}
            </Text>
          </View>
        )}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>VAT ({vatPct}%)</Text>
          <Text style={styles.totalsValue}>{fmt(order.vat_amount)}</Text>
        </View>
        <View style={styles.totalsRowFinal}>
          <Text style={styles.totalsFinalLabel}>Total Due (incl. VAT)</Text>
          <Text style={styles.totalsFinalValue}>{fmt(order.total_amount)}</Text>
        </View>
      </View>
    </View>
  );
}

function BankingDetails({
  order,
  config,
}: {
  order: Order;
  config: TenantConfig;
}) {
  const bankRef = `${config.bank_reference_prefix ?? "INV"}-${order.reference_number}`;

  return (
    <View style={styles.bankSection}>
      <Text style={styles.bankTitle}>EFT Banking Details</Text>
      <View style={styles.bankGrid}>
        <View style={styles.bankCell}>
          <Text style={styles.bankLabel}>Bank</Text>
          <Text style={styles.bankValue}>{config.bank_name ?? "—"}</Text>
        </View>
        <View style={styles.bankCell}>
          <Text style={styles.bankLabel}>Account Holder</Text>
          <Text style={styles.bankValue}>
            {config.bank_account_holder ?? config.business_name}
          </Text>
        </View>
        <View style={styles.bankCell}>
          <Text style={styles.bankLabel}>Account Type</Text>
          <Text style={styles.bankValue}>
            {config.bank_account_type ?? "—"}
          </Text>
        </View>
        <View style={styles.bankCell}>
          <Text style={styles.bankLabel}>Account Number</Text>
          <Text style={styles.bankValue}>
            {config.bank_account_number ?? "—"}
          </Text>
        </View>
        <View style={styles.bankCell}>
          <Text style={styles.bankLabel}>Branch Code</Text>
          <Text style={styles.bankValue}>
            {config.bank_branch_code ?? "—"}
          </Text>
        </View>

        {/* Payment reference spans full width */}
        <View style={styles.bankRefCell}>
          <Text style={styles.bankRefLabel}>
            Use this reference when making payment
          </Text>
          <Text style={styles.bankRefValue}>{bankRef}</Text>
        </View>
      </View>
    </View>
  );
}

function Footer({ config }: { config: TenantConfig }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {config.footer_text ??
          `${config.business_name} — Thank you for your business.`}
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

function InvoiceDocument({ order, items, profile, config }: InvoiceProps) {
  return (
    <Document
      title={`Invoice ${order.reference_number}`}
      author={config.business_name}
      subject={`Tax Invoice — ${profile.business_name}`}
    >
      <Page size="A4" style={styles.page}>
        <Header order={order} config={config} />
        <View style={styles.ruleDark} />
        <MetaSection order={order} profile={profile} config={config} />
        <View style={styles.rule} />
        <ItemsTable items={items} />
        <Totals order={order} config={config} />
        <BankingDetails order={order} config={config} />
        <Footer config={config} />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders the invoice to a Node Buffer (for Resend email attachment).
 * Must only be called in a server context.
 */
export async function renderInvoiceToBuffer(
  props: InvoiceProps
): Promise<Buffer> {
  const buffer = await renderToBuffer(<InvoiceDocument {...props} />);
  return Buffer.from(buffer);
}

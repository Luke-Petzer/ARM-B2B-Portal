# Refund Request, Invite Fix & Cooling-Off Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invite email redirect URL, replace the cooling-off notice with a discreet modal, and add a refund request flow to Order History that sends emails via Resend to the buyer and supplier.

**Architecture:** Three independent changes — a one-line server action fix, a UI-only modal swap on the EFT payment page, and a new end-to-end refund flow (server action + two email templates + modal component wired into OrderHistoryTable). The Dialog primitive is missing from ui/ but `@radix-ui/react-dialog` is already installed, so we add it as Task 1. All new buyer-facing email sends are fire-and-forget (`.catch()` pattern matching existing checkout.ts convention).

**Tech Stack:** Next.js App Router, React, Tailwind, Radix Dialog (`@radix-ui/react-dialog` already installed), Zod v4, Resend + React Email, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| **Create** | `src/components/ui/dialog.tsx` | Radix Dialog primitive (shadcn pattern) |
| **Modify** | `src/app/actions/admin.ts` | Add `redirectTo` to `inviteUserByEmail` |
| **Create** | `src/components/portal/CoolingOffModal.tsx` | Info icon + dialog with legal text |
| **Modify** | `src/app/(portal)/checkout/payment/page.tsx` | Swap `<CoolingOffNotice />` for `<CoolingOffModal />` |
| **Create** | `src/emails/RefundRequest.tsx` | Two React Email templates (buyer + business) |
| **Create** | `src/app/actions/refund.ts` | `submitRefundRequestAction` server action |
| **Create** | `src/components/portal/RefundRequestModal.tsx` | Three-dots button + refund dialog + form |
| **Modify** | `src/components/portal/OrderHistoryTable.tsx` | Add `<RefundRequestModal>` per order row |
| **Create** | `tests/audit/order/refund-action.test.ts` | Structural tests for refund action |
| **Create** | `tests/audit/email/refund-email.test.ts` | Structural tests for refund email |

---

## Task 1: Add Dialog UI Component

**Files:**
- Create: `src/components/ui/dialog.tsx`

`@radix-ui/react-dialog` is already installed (Sheet uses it). We just need the shadcn wrapper component. This is used by Tasks 2 and 5.

- [ ] **Step 1.1: Create `src/components/ui/dialog.tsx`**

```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] mx-4",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-opacity">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 p-6 pb-0", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 pt-4", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-slate-900", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-slate-500", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

- [ ] **Step 1.2: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "feat(ui): add Dialog primitive component"
```

---

## Task 2: Fix Invite Email Redirect URL

**Files:**
- Modify: `src/app/actions/admin.ts` (line ~1052)

The current `inviteUserByEmail` call has no `redirectTo`, so invite emails link to the raw Supabase project URL. Adding `redirectTo` routes the invited user through our auth callback to the verify-success page.

- [ ] **Step 2.1: Write the structural test first**

Create `tests/audit/order/invite-redirect.test.ts`:

```typescript
/**
 * Structural test: inviteClientAction must include redirectTo pointing at
 * NEXT_PUBLIC_APP_URL so invite emails land on our verify-success page,
 * not the raw Supabase project URL.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/admin.ts"),
  "utf-8"
);

describe("inviteClientAction — redirectTo", () => {
  it("passes redirectTo to inviteUserByEmail", () => {
    expect(source).toMatch(/inviteUserByEmail\(email,\s*\{[\s\S]*?redirectTo:/);
  });

  it("redirectTo uses NEXT_PUBLIC_APP_URL", () => {
    expect(source).toMatch(/NEXT_PUBLIC_APP_URL.*auth\/callback.*verify-success/);
  });
});
```

- [ ] **Step 2.2: Run test to confirm it fails**

```bash
cd /Users/lukepetzer/LP-Web-Studio/Clients/Rasheed-B2B/Codebase/rasheed-ordering-portal
npx vitest run tests/audit/order/invite-redirect.test.ts
```

Expected: FAIL — "passes redirectTo to inviteUserByEmail"

- [ ] **Step 2.3: Apply the fix in `src/app/actions/admin.ts`**

Find the block starting at ~line 1052:
```typescript
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "buyer_default",
      contact_name: contactName,
      business_name: businessName ?? "",
    },
  });
```

Replace with:
```typescript
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/verify-success`,
    data: {
      role: "buyer_default",
      contact_name: contactName,
      business_name: businessName ?? "",
    },
  });
```

- [ ] **Step 2.4: Run test to confirm it passes**

```bash
npx vitest run tests/audit/order/invite-redirect.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 2.5: Commit**

```bash
git add src/app/actions/admin.ts tests/audit/order/invite-redirect.test.ts
git commit -m "fix(invite): add redirectTo so invite emails land on verify-success page"
```

---

## Task 3: Cooling-Off Modal Component

**Files:**
- Create: `src/components/portal/CoolingOffModal.tsx`
- Modify: `src/app/(portal)/checkout/payment/page.tsx`

Replace the full-width `<CoolingOffNotice />` banner with a small `Info` icon that opens a dialog containing the same legal text. The `CoolingOffNotice` component is NOT deleted — it remains as an unused file for reference.

- [ ] **Step 3.1: Create `src/components/portal/CoolingOffModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CoolingOffModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="View cooling-off and returns notice"
      >
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Returns &amp; cancellations notice</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Returns &amp; Cancellations Notice</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 text-[13px] text-slate-600 leading-relaxed space-y-3">
            <p>
              Consumer customers have the right to cancel this order within{" "}
              <strong className="text-slate-800">five (5) business days</strong> of
              receiving the goods, in terms of Section 44 of the Electronic
              Communications and Transactions Act, 2002.
            </p>
            <p>
              This right does not apply to custom-manufactured goods, goods cut or
              altered to your specifications, or to business-to-business purchases.
            </p>
            <p>
              For full details, see our{" "}
              <Link
                href="/terms#returns"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-900"
                onClick={() => setOpen(false)}
              >
                Returns, Refunds &amp; Cancellations Policy
              </Link>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3.2: Update `src/app/(portal)/checkout/payment/page.tsx`**

At the top of the file, find:
```typescript
import CoolingOffNotice from "@/components/CoolingOffNotice";
```
Replace with:
```typescript
import CoolingOffModal from "@/components/portal/CoolingOffModal";
```

Find in the JSX body:
```tsx
            {/* ECT Act Section 44 cooling-off disclosure */}
            <CoolingOffNotice />
```
Replace with:
```tsx
            {/* ECT Act Section 44 — discreet link to returns notice */}
            <div className="flex justify-end">
              <CoolingOffModal />
            </div>
```

- [ ] **Step 3.3: Verify the page builds without errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `CoolingOffNotice` or `CoolingOffModal`.

- [ ] **Step 3.4: Commit**

```bash
git add src/components/portal/CoolingOffModal.tsx src/app/(portal)/checkout/payment/page.tsx
git commit -m "feat(checkout): replace cooling-off notice with discreet info icon modal"
```

---

## Task 4: Refund Request Email Templates

**Files:**
- Create: `src/emails/RefundRequest.tsx`
- Create: `tests/audit/email/refund-email.test.ts`

Two exports in one file: `BuyerRefundConfirmationEmail` (sent to buyer) and `BusinessRefundNotificationEmail` (sent to supplier). Both follow the existing React Email style from `BuyerReceipt.tsx`.

- [ ] **Step 4.1: Write the structural email tests**

Create `tests/audit/email/refund-email.test.ts`:

```typescript
/**
 * Structural tests for RefundRequest email templates.
 * Verifies both exports exist and contain required content markers.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../../../src/emails/RefundRequest.tsx"),
  "utf-8"
);

describe("RefundRequest email file", () => {
  it("exports BuyerRefundConfirmationEmail", () => {
    expect(source).toMatch(/export function BuyerRefundConfirmationEmail/);
  });

  it("exports BusinessRefundNotificationEmail", () => {
    expect(source).toMatch(/export function BusinessRefundNotificationEmail/);
  });

  it("BuyerRefundConfirmationEmail references Consumer Protection Act", () => {
    expect(source).toMatch(/Consumer Protection Act/);
  });

  it("BusinessRefundNotificationEmail references reason field", () => {
    expect(source).toMatch(/reasonLabel/);
  });

  it("both templates accept orderReference prop", () => {
    const matches = source.match(/orderReference/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 4.2: Run test to confirm it fails**

```bash
npx vitest run tests/audit/email/refund-email.test.ts
```

Expected: FAIL — file not found or exports not found.

- [ ] **Step 4.3: Create `src/emails/RefundRequest.tsx`**

```tsx
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
  body: {
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
}

// ── Buyer confirmation email ────────────────────────────────────────────────

export function BuyerRefundConfirmationEmail({
  contactName,
  orderReference,
  reasonLabel,
  supplierName,
}: RefundRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your return request for {orderReference} has been received.</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Heading style={s.heading}>Return Request Received</Heading>
          <Text style={s.body}>Hi {contactName},</Text>
          <Text style={s.body}>
            We have received your return request for order{" "}
            <strong>{orderReference}</strong>. Our team will review it and
            contact you within <strong>3 business days</strong>.
          </Text>

          <Section style={s.infoBox}>
            <Text style={s.label}>Order Reference</Text>
            <Text style={s.value}>{orderReference}</Text>

            <Text style={s.label}>Reason Submitted</Text>
            <Text style={{ ...s.value, marginBottom: "0" }}>{reasonLabel}</Text>
          </Section>

          <Text style={s.body}>
            Under the Consumer Protection Act 68 of 2008, you have the right to
            return defective or incorrectly described goods within 6 months of
            delivery. {supplierName} will assess your request and respond
            accordingly.
          </Text>

          <Hr style={{ borderColor: C.border, margin: "24px 0" }} />

          <Text style={s.muted}>
            If you have any urgent questions, please reply to this email or
            contact {supplierName} directly.
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
  reasonLabel,
  dateReceived,
  details,
  supplierName,
  buyerEmail,
}: RefundRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        New return request from {contactName} — {orderReference}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Heading style={s.heading}>New Return Request</Heading>
          <Text style={s.body}>
            A return request has been submitted by a customer via the ordering
            portal. Details below.
          </Text>

          <Section style={s.infoBox}>
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

          <Text style={s.body}>
            Please review this request and contact the customer within 3
            business days in accordance with your returns policy.
          </Text>

          <Hr style={{ borderColor: C.border, margin: "24px 0" }} />
          <Text style={s.muted}>{supplierName} — {new Date().getFullYear()}</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4.4: Run email tests to confirm they pass**

```bash
npx vitest run tests/audit/email/refund-email.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 4.5: Commit**

```bash
git add src/emails/RefundRequest.tsx tests/audit/email/refund-email.test.ts
git commit -m "feat(email): add buyer and business refund request email templates"
```

---

## Task 5: Refund Request Server Action

**Files:**
- Create: `src/app/actions/refund.ts`
- Create: `tests/audit/order/refund-action.test.ts`

The action validates input, verifies order ownership, fetches buyer email from the profiles table, and sends two Resend emails (buyer + supplier). Email failures are fire-and-forget (`.catch()`) — a failed email never blocks the user getting a success response. Requires `SUPPLIER_EMAIL` and `RESEND_FROM_EMAIL` env vars (both already in use by `checkout.ts`).

- [ ] **Step 5.1: Write the structural action tests**

Create `tests/audit/order/refund-action.test.ts`:

```typescript
/**
 * Structural tests for submitRefundRequestAction.
 * Verifies auth check, ownership guard, and email isolation patterns.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/refund.ts"),
  "utf-8"
);

describe("submitRefundRequestAction — auth & ownership", () => {
  it("checks session before any DB call", () => {
    const sessionIndex = source.indexOf("getSession()");
    const dbIndex = source.indexOf("adminClient");
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(dbIndex).toBeGreaterThan(-1);
    expect(sessionIndex).toBeLessThan(dbIndex);
  });

  it("verifies order belongs to the buyer via profile_id filter", () => {
    expect(source).toMatch(/\.eq\("profile_id", session\.profileId\)/);
  });

  it("uses Zod to validate reason enum", () => {
    expect(source).toMatch(/z\.enum\(\[/);
  });
});

describe("submitRefundRequestAction — email isolation", () => {
  it("buyer email send uses .catch() — never awaited directly", () => {
    expect(source).toMatch(/resend\.emails\.send\([\s\S]*?\)\.catch\(/);
  });

  it("never throws after an email send error", () => {
    expect(source).not.toMatch(/catch[\s\S]*?throw/);
  });
});

describe("submitRefundRequestAction — schema", () => {
  it("validates orderId as UUID", () => {
    expect(source).toMatch(/z\.string\(\)\.uuid\(\)/);
  });

  it("caps details at 1000 characters", () => {
    expect(source).toMatch(/max\(1000/);
  });
});
```

- [ ] **Step 5.2: Run test to confirm it fails**

```bash
npx vitest run tests/audit/order/refund-action.test.ts
```

Expected: FAIL — file not found.

- [ ] **Step 5.3: Create `src/app/actions/refund.ts`**

```typescript
"use server";

import { z } from "zod";
import { Resend } from "resend";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import {
  BuyerRefundConfirmationEmail,
  BusinessRefundNotificationEmail,
} from "@/emails/RefundRequest";

const resend = new Resend(process.env.RESEND_API_KEY);

const REASON_LABELS: Record<string, string> = {
  defective_damaged: "Defective or damaged goods",
  incorrect_items: "Incorrect items received",
  not_as_described: "Goods not as described",
  other: "Other",
};

const RefundSchema = z.object({
  orderId: z.string().uuid("Invalid order ID."),
  reason: z.enum([
    "defective_damaged",
    "incorrect_items",
    "not_as_described",
    "other",
  ]),
  dateReceived: z.string().min(1, "Please enter the date you received the goods."),
  details: z.string().max(1000, "Details must be 1000 characters or fewer.").optional(),
});

export async function submitRefundRequestAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  // 1. Auth check — must come before any DB call
  const session = await getSession();
  if (!session || !session.isBuyer) return { error: "Not authenticated." };

  // 2. Validate input
  const parsed = RefundSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    dateReceived: formData.get("dateReceived"),
    details: (formData.get("details") as string)?.trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { orderId, reason, dateReceived, details } = parsed.data;

  // 3. Verify order belongs to this buyer (ownership check)
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id, reference_number")
    .eq("id", orderId)
    .eq("profile_id", session.profileId)
    .single();

  if (orderError || !order) {
    return { error: "Order not found." };
  }

  // 4. Fetch buyer email and supplier config from DB
  const [profileResult, configResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("email, contact_name")
      .eq("id", session.profileId)
      .single(),
    adminClient.from("tenant_config").select("company_name").eq("id", 1).single(),
  ]);

  const buyerEmail = profileResult.data?.email ?? null;
  const contactName = profileResult.data?.contact_name ?? "Customer";
  const supplierName = configResult.data?.company_name ?? "AR Steel Manufacturing";
  const supplierEmail = process.env.SUPPLIER_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail || !supplierEmail) {
    console.error("[refund] Missing email env vars: RESEND_FROM_EMAIL or SUPPLIER_EMAIL");
    return { error: "Could not send refund request. Please contact us directly." };
  }

  const reasonLabel = REASON_LABELS[reason] ?? reason;
  const emailProps = {
    contactName,
    orderReference: order.reference_number,
    reasonLabel,
    dateReceived,
    details: details ?? null,
    supplierName,
    buyerEmail: buyerEmail ?? "unknown",
  };

  // 5. Send emails — fire-and-forget so a Resend failure never blocks the user
  const sends: Promise<void>[] = [];

  if (buyerEmail) {
    sends.push(
      resend.emails
        .send({
          from: fromEmail,
          to: buyerEmail,
          subject: `Return Request Received — ${order.reference_number}`,
          react: BuyerRefundConfirmationEmail(emailProps),
        })
        .then(() => undefined)
        .catch((err: unknown) => {
          console.error("[refund] buyer confirmation email failed:", err);
        })
    );
  }

  sends.push(
    resend.emails
      .send({
        from: fromEmail,
        to: supplierEmail,
        subject: `New Return Request — ${order.reference_number}`,
        react: BusinessRefundNotificationEmail(emailProps),
      })
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error("[refund] business notification email failed:", err);
      })
  );

  // Fire-and-forget: we return success before emails complete
  Promise.all(sends).catch((err: unknown) => {
    console.error("[refund] email send batch error:", err);
  });

  return { success: true };
}
```

- [ ] **Step 5.4: Run tests to confirm they pass**

```bash
npx vitest run tests/audit/order/refund-action.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5.5: Commit**

```bash
git add src/app/actions/refund.ts tests/audit/order/refund-action.test.ts
git commit -m "feat(refund): add submitRefundRequestAction with email isolation"
```

---

## Task 6: RefundRequestModal Component

**Files:**
- Create: `src/components/portal/RefundRequestModal.tsx`

A three-dots ellipsis button per order row. Clicking it opens a Dialog with the refund form. On submit, calls `submitRefundRequestAction`. On success, shows a confirmation message then closes. No dropdown needed — there is only one action.

- [ ] **Step 6.1: Create `src/components/portal/RefundRequestModal.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Loader2, CheckCircle } from "lucide-react";
import { submitRefundRequestAction } from "@/app/actions/refund";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RefundRequestModalProps {
  orderId: string;
  referenceNumber: string;
}

const REASON_OPTIONS = [
  { value: "defective_damaged", label: "Defective or damaged goods" },
  { value: "incorrect_items", label: "Incorrect items received" },
  { value: "not_as_described", label: "Goods not as described" },
  { value: "other", label: "Other" },
] as const;

export default function RefundRequestModal({
  orderId,
  referenceNumber,
}: RefundRequestModalProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog close animation
    setTimeout(() => {
      setSubmitted(false);
      setError(null);
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orderId", orderId);

    startTransition(async () => {
      const result = await submitRefundRequestAction(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
        aria-label={`Options for order ${referenceNumber}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          {submitted ? (
            /* Success state */
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Request Submitted
                </h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Your return request for <strong>{referenceNumber}</strong> has
                  been submitted. We will review it and contact you within{" "}
                  <strong>3 business days</strong> in accordance with the
                  Consumer Protection Act.
                </p>
              </div>
              <Button onClick={handleClose} className="w-full mt-2">
                Done
              </Button>
            </div>
          ) : (
            /* Form state */
            <>
              <DialogHeader>
                <DialogTitle>Request a Return</DialogTitle>
                <DialogDescription>
                  Order <span className="font-medium text-slate-700">{referenceNumber}</span>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
                {/* Reason */}
                <div>
                  <label
                    htmlFor="refund-reason"
                    className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    Reason for Return *
                  </label>
                  <select
                    id="refund-reason"
                    name="reason"
                    required
                    defaultValue=""
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  >
                    <option value="" disabled>
                      Select a reason…
                    </option>
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date received */}
                <div>
                  <label
                    htmlFor="refund-date"
                    className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    Date Goods Were Received *
                  </label>
                  <input
                    id="refund-date"
                    name="dateReceived"
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>

                {/* Additional details */}
                <div>
                  <label
                    htmlFor="refund-details"
                    className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    Additional Details{" "}
                    <span className="normal-case font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="refund-details"
                    name="details"
                    rows={3}
                    maxLength={1000}
                    placeholder="Describe the issue in more detail…"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all resize-none"
                  />
                </div>

                {/* Disclaimer */}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Submitting this form initiates a review process. Under the
                  Consumer Protection Act, returns of defective goods are
                  assessed on a case-by-case basis. You will be contacted once
                  your request is reviewed.
                </p>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Return Request"
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 6.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "RefundRequestModal\|refund" | head -20
```

Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/portal/RefundRequestModal.tsx
git commit -m "feat(refund): add RefundRequestModal component with three-dots trigger"
```

---

## Task 7: Wire RefundRequestModal into OrderHistoryTable

**Files:**
- Modify: `src/components/portal/OrderHistoryTable.tsx`

Add `<RefundRequestModal>` to each order row in both the desktop and mobile layouts. Placed in the same column as the "Reorder" button area. On desktop it goes beside the Reorder button. On mobile it goes alongside the order controls.

- [ ] **Step 7.1: Add import and wire into desktop layout**

Open `src/components/portal/OrderHistoryTable.tsx`.

Add the import at the top with the other imports:
```typescript
import RefundRequestModal from "@/components/portal/RefundRequestModal";
```

**Desktop row** — find the action column `<div>` (line ~238):
```tsx
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleReorder(order.id)}
                  disabled={pendingId === order.id}
                  className={[
                    "text-[12px] font-bold px-4 py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    isExpanded
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {pendingId === order.id ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Adding...</>
                  ) : (
                    "Reorder"
                  )}
                </button>
              </div>
```

Replace with:
```tsx
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <RefundRequestModal orderId={order.id} referenceNumber={order.reference_number} />
                <button
                  type="button"
                  onClick={() => handleReorder(order.id)}
                  disabled={pendingId === order.id}
                  className={[
                    "text-[12px] font-bold px-4 py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    isExpanded
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {pendingId === order.id ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Adding...</>
                  ) : (
                    "Reorder"
                  )}
                </button>
              </div>
```

**Mobile card** — find the div that has the Reorder button on mobile (line ~183):
```tsx
              <div
                className="flex items-center justify-between pl-6"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-semibold text-slate-900">
                  {ZAR.format(order.total_amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleReorder(order.id)}
                  disabled={pendingId === order.id}
                  className={[
                    "text-[12px] font-bold px-4 py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    isExpanded
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {pendingId === order.id ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Adding...</>
                  ) : (
                    "Reorder"
                  )}
                </button>
              </div>
```

Replace with:
```tsx
              <div
                className="flex items-center justify-between pl-6"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-semibold text-slate-900">
                  {ZAR.format(order.total_amount)}
                </span>
                <div className="flex items-center gap-1">
                  <RefundRequestModal orderId={order.id} referenceNumber={order.reference_number} />
                  <button
                    type="button"
                    onClick={() => handleReorder(order.id)}
                    disabled={pendingId === order.id}
                    className={[
                      "text-[12px] font-bold px-4 py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                      isExpanded
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {pendingId === order.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Adding...</>
                    ) : (
                      "Reorder"
                    )}
                  </button>
                </div>
              </div>
```

- [ ] **Step 7.2: Full type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7.3: Run all tests to ensure nothing regressed**

```bash
npx vitest run
```

Expected: all tests pass (previously passing count + 11 new tests from Tasks 2, 4, 5).

- [ ] **Step 7.4: Commit**

```bash
git add src/components/portal/OrderHistoryTable.tsx
git commit -m "feat(orders): add refund request button to each order row"
```

---

## Self-Review

**Spec coverage:**
- ✅ Email invite redirect fix (Task 2)
- ✅ Cooling-off notice → discreet icon + modal (Task 3)
- ✅ Refund email templates — buyer confirmation + business notification (Task 4)
- ✅ Refund server action — auth, ownership, validation, fire-and-forget emails (Task 5)
- ✅ Three-dots trigger + refund modal form (Task 6)
- ✅ Wired into desktop and mobile order rows (Task 7)
- ✅ Dialog primitive added as dependency (Task 1)
- ✅ CPA disclaimer in success message and form footer
- ✅ No "preferred resolution" field (supplier decides remedy under CPA)

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `RefundRequestEmailProps` is defined in `RefundRequest.tsx` and matches usage in `refund.ts`
- `submitRefundRequestAction` returns `{ error: string } | { success: true }` — matches the check pattern in `RefundRequestModal.tsx`
- `RefundRequestModal` props `{ orderId, referenceNumber }` match usage in `OrderHistoryTable.tsx`

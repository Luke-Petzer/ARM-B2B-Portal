# AR Steel Manufacturing — Legal Terms & Policies (Current State)

> **Source:** Extracted word-for-word from `src/app/terms/page.tsx` and `src/app/(auth)/register/page.tsx`
>
> **Date of extraction:** 22 April 2026
>
> **Effective date (as displayed on site):** 1 April 2025
>
> **Jurisdiction:** Republic of South Africa

---

## Preamble

These Terms and Conditions ("Terms") govern your access to and use of the AR Steel Manufacturing B2B Ordering Portal ("Portal"), operated by AR Steel Manufacturing (Pty) Ltd ("we", "us", "our"). By registering for or using the Portal, you agree to be bound by these Terms and our Privacy Policy set out below. If you do not agree, do not use the Portal.

---

## Terms and Conditions

### 1. Eligibility

The Portal is available exclusively to registered South African businesses. By registering, you confirm that you are authorised to act on behalf of the business entity you represent and that all information provided is accurate and up to date.

### 2. Account Registration

You must provide a valid contact name, business name, and business email address to register. You are responsible for maintaining the confidentiality of your login credentials and for all activity conducted under your account. You must notify us immediately of any unauthorised use at orders@arsteelmanufacturing.co.za.

### 3. Orders and Credit

All orders placed through the Portal constitute a binding purchase order subject to our confirmation. Credit limits, payment terms, and account status are managed at our sole discretion and may be reviewed or amended at any time. Overdue accounts may result in suspension of Portal access.

### 4. Pricing and VAT

All prices displayed are exclusive of Value-Added Tax (VAT) unless otherwise stated. VAT will be calculated and applied at the applicable statutory rate at the time of order confirmation. We reserve the right to update pricing without prior notice.

### 5. Intellectual Property

All content on the Portal, including product data, images, and the portal software itself, is the property of AR Steel Manufacturing (Pty) Ltd or its licensors. You may not reproduce, distribute, or modify any Portal content without our prior written consent.

### 6. Limitation of Liability

To the maximum extent permitted by applicable law, we shall not be liable for any indirect, incidental, or consequential loss arising from your use of or inability to use the Portal. Our total aggregate liability shall not exceed the value of the specific order giving rise to the claim.

### 7. Amendments

We reserve the right to amend these Terms at any time. Continued use of the Portal following notification of changes constitutes acceptance of the revised Terms.

### 8. Governing Law

These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the exclusive jurisdiction of the South African courts.

---

## Privacy Policy

This Privacy Policy is issued in accordance with the **Protection of Personal Information Act 4 of 2013 (POPIA)** and applies to all personal information collected through the Portal.

### 1. Information Officer

Our Information Officer, as required by POPIA, can be contacted at: orders@arsteelmanufacturing.co.za.

### 2. Personal Information We Collect

We collect only the information necessary to operate the Portal:

- Contact name
- Business name
- Business email address
- Account number (assigned upon approval)
- Credit limit and payment terms (set administratively)

### 3. Purpose of Processing

Your personal information is collected and processed solely for the following purposes:

- Processing and fulfilling B2B purchase orders
- Managing your account, credit limit, and payment terms
- Sending transactional emails (order confirmations, invoices, statements)
- Complying with our legal and financial record-keeping obligations

We do not use your personal information for marketing, profiling, or any purpose unrelated to your account and orders.

### 4. Legal Basis for Processing

Processing is carried out on the basis of (a) your consent given at registration, (b) the necessity of processing to perform the contract between us, and (c) compliance with legal obligations applicable to our business.

### 5. Third-Party Service Providers

We engage the following sub-processors to operate the Portal. Each provider processes data solely on our instructions and under appropriate data processing agreements:

- **Vercel Inc.** — Cloud hosting and content delivery. Data may be processed in the United States.
- **Supabase Inc.** — Database storage and authentication services. Data may be processed in the United States.
- **Resend Inc.** — Transactional email delivery (order confirmations and invoices). Data may be processed in the United States.

Where personal information is transferred outside South Africa, we take reasonable steps to ensure that the recipient is subject to a law, binding corporate rules, or a binding agreement that provides a comparable level of protection to POPIA.

### 6. Data Retention

We retain your personal information for as long as your account remains active and for a period of five (5) years thereafter, as required by South African financial record-keeping legislation. You may request deletion of non-mandatory data at any time (see Section 8).

### 7. Security

We implement industry-standard technical and organisational measures to protect your personal information against unauthorised access, loss, or destruction. These measures include encrypted data transmission (TLS), access controls, and role-based permissions within the Portal.

### 8. Your Rights Under POPIA

You have the right to:

- Request access to the personal information we hold about you
- Request correction of inaccurate information
- Request deletion of your information (subject to legal retention requirements)
- Object to the processing of your information
- Lodge a complaint with the **Information Regulator of South Africa** at https://inforegulator.org.za

To exercise any of the above rights, contact our Information Officer at orders@arsteelmanufacturing.co.za.

### 9. Cookies

The Portal uses strictly necessary session cookies to authenticate your account. No tracking, advertising, or analytics cookies are used.

### 10. Changes to this Policy

We may update this Privacy Policy from time to time. Material changes will be communicated via the Portal or by email. Continued use of the Portal after such notification constitutes acceptance of the updated policy.

---

## User Consent Mechanism (Registration Page)

On the registration page (`/register`), users must check a mandatory checkbox before their account can be created:

> **Checkbox label:** "I accept the Terms and Conditions"
>
> **Link target:** `/terms` (opens in new tab)
>
> **Validation:** `terms: z.literal(true, { message: "You must accept the Terms and Conditions." })`
>
> **Behaviour:** Registration form cannot be submitted unless the checkbox is checked. A validation error is displayed if the user attempts to submit without accepting.

---

## Footer (Landing Page)

The landing page footer (`/`) displays the following contact information:

- **Phone:** 021 271 0526
- **Email:** info@armanufacturing.co.za
- **Address:** 15 Hadji Ebrahim Crescent, Unit 9, Belgravia Industrial Park, Athlone, 7764
- **Copyright:** © 2026 AR Steel Manufacturing. All rights reserved.

**Note:** The footer does NOT currently link to the Terms & Conditions or Privacy Policy page.

---

## Summary of What Exists vs What Is Missing

### Exists

| Item | Location |
|---|---|
| Terms and Conditions (8 clauses) | `/terms` page |
| Privacy Policy / POPIA (10 clauses) | `/terms` page (same page, below T&C) |
| Consent checkbox on registration | `/register` page |
| Contact details in footer | `/` landing page footer |

### Missing (Not Yet Implemented)

| Item | Notes |
|---|---|
| Returns, Refunds & Cancellations Policy | No page exists |
| Delivery / Shipping Terms | No page exists |
| PAIA Manual (Section 51) | Legally required for all SA private bodies |
| Force Majeure clause | Not in current T&C |
| Product Warranty / Disclaimer | Not in current T&C |
| Dispute Resolution mechanism | Not in current T&C |
| Order Acceptance / Formation clause | Not in current T&C |
| Credit Terms detail (interest, debt collection) | Not in current T&C |
| Acceptable Use Policy | No page exists |
| CIPC registration number | Not displayed anywhere |
| VAT registration number | Not displayed anywhere |
| Information Officer name | Only email provided, no name |
| ECT Act Section 44 cooling-off notice | Not mentioned |
| Footer links to legal pages | Footer has no links to /terms |
| Separate /privacy route | Privacy policy is bundled into /terms |

---

*© 2026 AR Steel Manufacturing (Pty) Ltd. All rights reserved.*

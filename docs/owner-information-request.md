# AR Steel Manufacturing -- Owner Information Request

**Prepared by:** Luke Petzer
**Date:** 22 April 2026
**Purpose:** List of information required from the business owner to finalise the B2B Ordering Portal's legal documentation, compliance, and handover.

---

## How to use this document

This document is a **living checklist** of everything that needs to be confirmed, collected, or decided by the business owner before the platform's legal and compliance posture can be considered complete. Some items are **critical** (needed before handover / launch). Others are **can-wait** (parked for follow-up after handover).

Work through the critical items with the owner first. Most of them can be answered in a single 20-minute conversation or WhatsApp exchange.

---

## CRITICAL -- needed before handover / launch

These items have placeholders currently sitting in the deployed legal documents (marked `[SQUARE BRACKETS]`). The platform is legally usable without them in the short term, but they should be filled in as soon as possible.

### 1. Information Officer (POPIA)

**What's needed:** The full name of the person designated as the business's Information Officer.

**Why it matters:** POPIA requires every business that processes personal information to designate an Information Officer. The Privacy Policy currently lists only an email address. A named individual is required by law.

**Default under POPIA:** If no one is formally designated, the CEO / head of the business is the Information Officer by default. So this is often just confirming who that is.

**Suggested question to owner:**
> "Who should we list as the Information Officer on the Privacy Policy? POPIA requires a named person. It's usually the business owner or a senior manager. We just need the full name; the existing orders@ email stays as the contact address."

**Where it goes:** Privacy Policy, Section 1.

---

### 2. CIPC Registration Number

**What's needed:** The business's Companies and Intellectual Property Commission registration number (format: YYYY/NNNNNN/NN).

**Why it matters:** Required on commercial websites in South Africa under the ECT Act and company law. It's a basic trust signal for customers.

**Suggested question to owner:**
> "Can you send me the CIPC registration number for AR Steel Manufacturing (Pty) Ltd? It's the number on the company registration certificate, usually in the format 2015/123456/07."

**Where it goes:** Website footer, below the company name.

---

### 3. VAT Registration Number

**What's needed:** The business's VAT number (10-digit format, starts with 4).

**Why it matters:** Required on all tax invoices under the VAT Act. Also required on the website because pricing is quoted excluding VAT.

**Suggested question to owner:**
> "What's the VAT number for AR Steel? We need it on the footer and on order confirmations."

**Where it goes:** Website footer.

---

### 4. Delivery Area

**What's needed:** A clear description of where the business delivers.

**Why it matters:** The Delivery & Shipping section currently has a placeholder for this. Customers need to know upfront whether the business will deliver to them.

**Options to discuss with owner:**
- Cape Town metropolitan area only
- Western Cape only
- Nationally across South Africa
- Cape Town metro standard, elsewhere by arrangement
- Other (specify)

**Suggested question to owner:**
> "For the Delivery section of the T&Cs -- what's the standard delivery area? Is it Cape Town only, the Western Cape, or nationwide? And do you do deliveries outside that area by arrangement?"

**Where it goes:** Delivery & Shipping Terms, Section 1.

---

### 5. Delivery Lead Times

**What's needed:** Rough estimates for (a) in-stock item dispatch, (b) custom-manufactured item dispatch, (c) delivery transit times.

**Why it matters:** Customers expect delivery estimates before they confirm an order. The platform currently has placeholders.

**Suggested question to owner:**
> "For the delivery terms, we need rough lead times. Something like: 'in-stock items dispatched within X business days, custom items within X to Y business days, delivery transit X to Y business days.' These can be estimates -- they're not guarantees."

**Where it goes:** Delivery & Shipping Terms, Section 2.

---

### 6. Custom-Manufactured Goods Scope

**What's needed:** Confirmation that some or all orders are custom-manufactured or cut-to-spec.

**Why it matters:** Affects the cooling-off wording. The current draft assumes custom goods exist and are exempt from the ECT Act Section 44 cooling-off right. If everything is off-the-shelf standard stock, the wording needs to change.

**Suggested question to owner:**
> "Do any orders involve custom cuts, lengths, or specifications made to a customer's request, or is everything standard stock? I've drafted the refund policy to exempt custom work from the cooling-off period, which is standard for steel suppliers, but I want to make sure that matches how you actually operate."

**Where it goes:** Returns, Refunds & Cancellations Policy, Sections 1 and 4.

---

### 7. Cancellation Fee Policy for Custom Orders

**What's needed:** The owner's position on cancellation fees for custom orders where production has started.

**Why it matters:** The draft policy says cancellation may incur a fee "up to the full value of the order." The owner needs to confirm whether that's accurate, or whether they want specific thresholds (e.g., 25% of order value if cancelled before materials are ordered, 100% if cancelled after production begins).

**Suggested question to owner:**
> "If a customer cancels a custom order after production has started, what's fair? The draft says we can charge up to the full value, but we might want to be more specific -- for example, 50% if we've already ordered materials, 100% if manufacturing is complete. Your call."

**Where it goes:** Returns, Refunds & Cancellations Policy, Section 4.

---

### 8. Credit Terms (existing clause in T&C needs review)

**What's needed:** Confirmation that the existing "Orders and Credit" clause (Clause 3) reflects the business's actual practice. Questions to raise:

- Are there standard payment terms (e.g. 30 days from invoice)?
- Is interest charged on overdue accounts? At what rate?
- What triggers portal access suspension?

**Why it matters:** The existing clause is vague. For a B2B operation with credit accounts, the owner may want more specific terms that they can point to if a customer disputes.

**Suggested question to owner:**
> "The credit clause in the T&Cs is currently pretty general. Do you want to tighten it up? For example: standard payment terms of 30 days, interest charged at prime + X% on overdue accounts, portal access suspended after 60 days overdue. Up to you whether to keep it general or make it specific."

**Where it goes:** Terms and Conditions, Clause 3. Only update if the owner wants more detail.

---

## CAN-WAIT -- follow-up after handover

These items are not blocking. They can be added in a follow-up engagement or handled by the business directly.

### 9. PAIA Manual (Promotion of Access to Information Act)

**What's needed:** A Section 51 PAIA Manual describing what categories of records the business holds and how the public can request access.

**Legal status:** Required for all private bodies in South Africa, though the Information Regulator has granted exemptions for small businesses. Whether AR Steel qualifies for exemption depends on turnover and employee count.

**Why it's parked:** This is a specialised legal document. It's typically commissioned from a lawyer or a PAIA compliance service (R2,000-R5,000 typical cost) rather than drafted by a developer. Not appropriate for me to produce.

**Recommendation to owner:**
> "There's one remaining compliance item called a PAIA Manual -- it's a separate legal document about public access to records. Most small SA businesses use a compliance service to produce one, they cost around R2,000 to R5,000. I'd recommend commissioning this separately after we go live."

---

### 10. Force Majeure Clause

**What's needed:** A clause covering what happens if the business can't fulfil orders due to circumstances beyond its control (load shedding, strikes, supply chain disruption, etc.).

**Why it's parked:** Not urgent. Load shedding and similar are covered indirectly by the existing delivery delay wording. A dedicated force majeure clause is a nice-to-have.

---

### 11. Acceptable Use Policy

**What's needed:** A policy governing what users can and cannot do on the platform (e.g. no scraping, no sharing credentials, no reselling portal access).

**Why it's parked:** For a B2B portal with vetted customers, abuse risk is low. Can be added if needed later.

---

### 12. Dispute Resolution Mechanism

**What's needed:** A defined escalation path for disputes (e.g. negotiation, then mediation, then arbitration, before court).

**Why it's parked:** The existing governing law clause covers this at a basic level. Most B2B disputes get resolved directly. Not urgent.

---

### 13. Product Warranty / Disclaimer

**What's needed:** Specific wording on product warranties -- what's guaranteed (e.g. steel grade, dimensions) and what isn't (e.g. fitness for specific unusual applications).

**Why it's parked:** The CPA already provides default warranty rights (Section 55 and 56) which apply regardless of what's in the T&Cs. A bespoke warranty clause would only add to these, and drafting one properly requires knowing the industry's trade practices in detail.

**Recommendation:** Discuss with owner whether this is needed. If AR Steel has standard product specifications and tolerances they want to enforce, a lawyer should draft this.

---

## CLIENT-SIDE ACTIONS AFTER HANDOVER

Items the business will need to maintain going forward. Include these in the handover documentation.

### 14. Keeping the Legal Content Up to Date

The business is responsible for keeping the Terms, Privacy Policy, and Returns Policy up to date as its practices change. If delivery areas expand, lead times change, or new sub-processors are engaged (e.g. a new email provider), the content needs to be updated.

### 15. POPIA -- Sub-processor Changes

If any of the named sub-processors (Vercel, Supabase, Resend) are replaced, the Privacy Policy needs updating. The same applies if any new processor is added (e.g. a payment gateway).

### 16. POPIA -- Data Subject Requests

The business must respond to data subject requests (access, correction, deletion) within the timeframes required by POPIA. Usually that's 30 days. Basic process:

1. Verify the requester is the data subject (their registered business account).
2. Action the request: provide the data, correct it, or delete what's legally permitted to delete.
3. Retain the request in a log for compliance.

### 17. Incident Reporting

If there's a data breach (unauthorised access to customer data), POPIA requires reporting to the Information Regulator **as soon as reasonably possible**. The business needs a basic incident response process.

### 18. Information Regulator Registration

The Information Officer should be registered with the Information Regulator of South Africa via their online portal. Registration is free but required.

---

## Summary -- what to ask in the next conversation with the owner

If you want a single tight script for a 15-minute conversation, use this:

> "Hey -- for the portal handover I need a few pieces of information from you to finalise the legal docs. Most of it is quick. Can we go through it now or over WhatsApp?
>
> 1. Who should I name as the Information Officer for POPIA -- you, or someone else?
> 2. What's the CIPC registration number?
> 3. What's the VAT number?
> 4. What's the standard delivery area -- Cape Town, Western Cape, or nationally?
> 5. Rough lead times -- how long for in-stock dispatch, how long for custom orders, how long for delivery?
> 6. Do you do custom / cut-to-spec orders, or is everything standard stock?
> 7. If a customer cancels a custom order mid-production, what's fair to charge them?
>
> Also, two things I've parked for later that you should know about:
> - There's a legal document called a PAIA Manual that's separate from the T&Cs and usually commissioned from a compliance service. I'd recommend sorting that separately.
> - A product warranty clause specific to steel grades and tolerances -- if you want one, it needs a lawyer, not me.
>
> Everything else is ready to go live."

---

*End of document.*

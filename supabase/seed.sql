-- ============================================================
-- B2B Ordering Portal — Development Seed Data
-- ============================================================
-- Run AFTER init.sql in the Supabase SQL Editor.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
-- DO NOT run init.sql after seeding — it will drop all tables.
-- ============================================================
-- Admin user: create manually in Supabase Auth dashboard.
-- Buyer logins: use account numbers TEST-EFT-001 / TEST-30D-002.
-- ============================================================


-- ============================================================
-- SECTION 1: Tenant Configuration
-- ============================================================
-- Update the singleton row with realistic supplier details.

UPDATE public.tenant_config SET
  business_name         = 'SA Wholesale Direct (Pty) Ltd',
  trading_name          = 't/a SWD Supplies',
  vat_number            = '4890123456',
  vat_rate              = 0.15,
  bank_name             = 'First National Bank',
  bank_account_holder   = 'SA Wholesale Direct (Pty) Ltd',
  bank_account_number   = '62789123456',
  bank_branch_code      = '250655',
  bank_account_type     = 'Current',
  bank_reference_prefix = 'SWD',
  email_from_name       = 'SA Wholesale Direct',
  email_from_address    = 'orders@sawholesale.co.za',
  email_reply_to        = 'support@sawholesale.co.za',
  support_phone         = '+27 11 555 0100',
  support_email         = 'support@sawholesale.co.za',
  payment_terms_days    = 30,
  footer_text           = 'Thank you for your order. Payment confirms acceptance of our standard terms and conditions. E&OE.'
WHERE id = 1;


-- ============================================================
-- SECTION 2: Categories
-- ============================================================
-- Using deterministic UUIDs (20000000-…) for cross-reference below.

INSERT INTO public.categories (id, name, slug, description, display_order, is_active)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'Cleaning Supplies',
    'cleaning-supplies',
    'Industrial and commercial cleaning, degreasing, and sanitising products.',
    1, true
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Paper & Stationery',
    'paper-stationery',
    'Office paper, print media, and POS consumables.',
    2, true
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'Safety Equipment',
    'safety-equipment',
    'PPE, respirators, gloves, and workplace safety consumables.',
    3, true
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'Catering Supplies',
    'catering-supplies',
    'Disposable catering, food service, and hospitality consumables.',
    4, true
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 3: Products (10 items)
-- ============================================================
-- Using deterministic UUIDs (30000000-…).
-- Mix of tracked/untracked stock, different price points and categories.

INSERT INTO public.products (
  id, sku, name, description, details,
  price, category_id,
  track_stock, stock_qty, low_stock_alert,
  tags, is_active
)
VALUES
  -- ── Cleaning Supplies ──────────────────────────────────────────────────
  (
    '30000000-0000-0000-0000-000000000001',
    'CLN-DEGREASER-5L',
    'Multi-Surface Degreaser 5L',
    'Heavy-duty industrial degreaser. Safe on stainless steel, tile, and sealed concrete. Concentrated formula — dilute 1:10 for light-duty use.',
    'Fragrance: Fresh citrus. pH: 11.5. Flash point: None. Keep away from direct sunlight. Store upright.',
    145.00,
    '20000000-0000-0000-0000-000000000001',
    true, 120, 20,
    ARRAY['cleaning', 'degreaser', 'industrial', 'bulk'],
    true
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'CLN-BLEACH-25L',
    'Industrial Bleach 25L',
    'Commercial-grade sodium hypochlorite solution. Effective against bacteria, fungi, and viruses. Suitable for floors, drains, and food-prep surfaces (diluted).',
    'Active chlorine: 5%. Dilution: 1:50 for general sanitising. Not for use on coloured fabrics. Store in cool, dark place.',
    89.50,
    '20000000-0000-0000-0000-000000000001',
    true, 48, 10,
    ARRAY['cleaning', 'bleach', 'sanitiser', 'industrial'],
    true
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'CLN-SANITIZER-1L',
    'Antibacterial Hand Sanitiser 1L (Case of 6)',
    '70% isopropyl alcohol hand sanitiser. WHO-compliant formula. Sold as a case of 6 × 1L pump bottles. Fast-drying, non-sticky finish.',
    'Active ingredient: Isopropanol 70% v/v. Kills 99.9% of germs. Shelf life: 3 years from manufacture date.',
    312.00,
    '20000000-0000-0000-0000-000000000001',
    true, 85, 15,
    ARRAY['sanitiser', 'hygiene', 'ppe', 'cleaning'],
    true
  ),

  -- ── Paper & Stationery ─────────────────────────────────────────────────
  (
    '30000000-0000-0000-0000-000000000004',
    'PAP-A4-COPY80',
    'A4 Copy Paper 80gsm (Box of 5 Reams)',
    'Premium-quality white copy paper. Suitable for laser and inkjet printers. 80gsm weight for reduced show-through. Box contains 5 × 500-sheet reams (2 500 sheets total).',
    'Brightness: 146 CIE. Thickness: 106 µm. Acid-free. FSC certified.',
    215.00,
    '20000000-0000-0000-0000-000000000002',
    false, 0, NULL,
    ARRAY['paper', 'office', 'stationery', 'print'],
    true
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    'PAP-ROLL-80-80',
    'Thermal POS Roll 80mm × 80m (Box of 50)',
    'High-sensitivity thermal receipt rolls. Compatible with all major POS printers (Epson, Star, Bixolon). Box of 50 rolls. BPA-free coating.',
    'Core diameter: 12mm. Paper thickness: 60µm. Operating temperature: 0–60°C. Print life: 7 years archival.',
    380.00,
    '20000000-0000-0000-0000-000000000002',
    true, 35, 8,
    ARRAY['thermal', 'pos', 'stationery', 'rolls'],
    true
  ),

  -- ── Safety Equipment ───────────────────────────────────────────────────
  (
    '30000000-0000-0000-0000-000000000006',
    'SAF-GLOVE-LATEX-M',
    'Latex Examination Gloves Medium (Box of 100)',
    'Powder-free latex gloves. Textured fingertips for improved grip. SANS/ISO certified. Suitable for food handling, medical, and cleaning applications. Box of 100.',
    'Material: Natural rubber latex. Thickness: 0.1mm palm / 0.08mm fingers. AQL: 1.5. Length: 240mm.',
    78.00,
    '20000000-0000-0000-0000-000000000003',
    true, 60, 12,
    ARRAY['gloves', 'ppe', 'safety', 'latex'],
    true
  ),
  (
    '30000000-0000-0000-0000-000000000007',
    'SAF-MASK-N95-20',
    'N95 Respirator Masks (Box of 20)',
    'NIOSH-approved N95 particulate respirators. Filters ≥95% of airborne particles ≥0.3 microns. Adjustable nose clip and dual head straps. Box of 20 individually wrapped masks.',
    'Standards: NIOSH 42 CFR 84, CE EN149:2001+A1:2009. Filter efficiency: ≥95%. Breathing resistance: ≤343 Pa.',
    320.00,
    '20000000-0000-0000-0000-000000000003',
    true, 25, 5,
    ARRAY['mask', 'respirator', 'n95', 'ppe', 'safety'],
    true
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    'SAF-APRON-DISP',
    'Disposable PE Aprons (Pack of 100)',
    'Lightweight polyethylene disposable aprons. Fluid-resistant. Suitable for food handling, cleaning, and laboratory use. Perforated for easy tear-off. Pack of 100.',
    'Material: LDPE (Low-Density Polyethylene). Thickness: 25 micron. Size: 700mm × 1100mm. Colour: White.',
    62.00,
    '20000000-0000-0000-0000-000000000003',
    true, 150, 30,
    ARRAY['apron', 'disposable', 'ppe', 'safety', 'food'],
    true
  ),

  -- ── Catering Supplies ──────────────────────────────────────────────────
  (
    '30000000-0000-0000-0000-000000000009',
    'CAT-CUP-DISP-250',
    'Disposable Cups 250ml (Pack of 1000)',
    'Smooth-wall polystyrene cups. Suitable for hot and cold beverages. Stackable design for easy storage. Pack of 1000 cups.',
    'Capacity: 250ml. Material: Expanded Polystyrene (EPS). Suitable for use with lids (sold separately). Temperature range: 0–90°C.',
    165.00,
    '20000000-0000-0000-0000-000000000004',
    false, 0, NULL,
    ARRAY['cups', 'disposable', 'catering', 'beverages'],
    true
  ),
  (
    '30000000-0000-0000-0000-000000000010',
    'CAT-FOIL-TRAY-3',
    'Foil Containers No.3 with Lids (Pack of 100)',
    'Standard No.3 aluminium foil containers with matching cardboard lids. Oven-safe to 220°C. Ideal for meal prep, takeaways, and catering. Pack of 100 trays + 100 lids.',
    'Dimensions: 227mm × 177mm × 40mm. Capacity: approx. 1100ml. Gauge: 50µm. Lids: White coated board with aluminium moisture barrier.',
    245.00,
    '20000000-0000-0000-0000-000000000004',
    true, 80, 15,
    ARRAY['foil', 'containers', 'catering', 'takeaway', 'oven'],
    true
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 4: Client Profiles
-- ============================================================
-- Two buyer accounts for QA testing.
-- auth_user_id is NULL — buyers use account number + custom JWT.
-- Using deterministic UUIDs (10000000-…).

INSERT INTO public.profiles (
  id, auth_user_id, account_number, role,
  business_name, trading_name, vat_number,
  contact_name, contact_title, email, phone, mobile,
  credit_limit, payment_terms_days, notes,
  is_active
)
VALUES
  -- EFT buyer — pays via bank transfer at checkout
  (
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'TEST-EFT-001',
    'buyer_default',
    'Cape Fresh Produce (Pty) Ltd',
    't/a Cape Fresh',
    '4123456789',
    'John Smit',
    'Mr',
    'john.smit@capefresh.co.za',
    '+27 21 555 0101',
    '+27 82 555 0101',
    50000.00,
    NULL,
    'Test EFT account for QA. Uses the standard payment flow. Login: TEST-EFT-001.',
    true
  ),
  -- 30-Day account buyer — bypasses payment at checkout
  (
    '10000000-0000-0000-0000-000000000002',
    NULL,
    'TEST-30D-002',
    'buyer_30_day',
    'Highveld Hospitality Group (Pty) Ltd',
    't/a HHG Hospitality',
    '4987654321',
    'Sarah van den Berg',
    'Ms',
    'sarah.vandenberg@hhg.co.za',
    '+27 11 555 0202',
    '+27 83 555 0202',
    150000.00,
    30,
    'Test 30-Day account for QA. Bypasses the payment page — goes direct to order confirmation. Login: TEST-30D-002.',
    true
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 5: Addresses
-- ============================================================
-- One default shipping address per buyer.

INSERT INTO public.addresses (
  id, profile_id, type, label,
  line1, line2, suburb, city, province, postal_code, country,
  is_default
)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'shipping',
    'Warehouse',
    '14 Koeberg Road',
    'Unit 7',
    'Montague Gardens',
    'Cape Town',
    'Western Cape',
    '7441',
    'South Africa',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'shipping',
    'Central Kitchen',
    '88 Commissioner Street',
    NULL,
    'Marshalltown',
    'Johannesburg',
    'Gauteng',
    '2001',
    'South Africa',
    true
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 6: Sample Orders
-- ============================================================
-- Three pre-seeded orders across both buyers and multiple statuses.
-- reference_number auto-generates from the order_seq sequence.
-- The order_status_history trigger fires automatically on each insert.
--
-- Order 1: EFT, pending — TEST-EFT-001  (awaiting payment proof)
-- Order 2: EFT, confirmed — TEST-EFT-001 (payment verified, awaiting fulfilment)
-- Order 3: 30-day, fulfilled — TEST-30D-002 (complete)
-- ============================================================

-- ── Order 1: EFT, pending ──────────────────────────────────────────────
-- Subtotal: R904.00  |  VAT (15%): R135.60  |  Total: R1,039.60

INSERT INTO public.orders (
  id, profile_id, status, payment_method,
  subtotal, discount_amount, vat_amount, total_amount,
  shipping_address,
  buyer_reference, notes,
  confirmed_at, fulfilled_at, cancelled_at
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'pending',
  'eft',
  904.00, 0.00, 135.60, 1039.60,
  '{"line1": "14 Koeberg Road", "line2": "Unit 7", "suburb": "Montague Gardens", "city": "Cape Town", "province": "Western Cape", "postal_code": "7441", "country": "South Africa"}'::jsonb,
  'PO-CF-2024-0891',
  NULL,
  NULL, NULL, NULL
)
ON CONFLICT (id) DO NOTHING;

-- ── Order 2: EFT, confirmed ────────────────────────────────────────────
-- Subtotal: R2,215.00  |  VAT (15%): R332.25  |  Total: R2,547.25

INSERT INTO public.orders (
  id, profile_id, status, payment_method,
  subtotal, discount_amount, vat_amount, total_amount,
  shipping_address,
  buyer_reference, notes,
  confirmed_at, fulfilled_at, cancelled_at
)
VALUES (
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'confirmed',
  'eft',
  2215.00, 0.00, 332.25, 2547.25,
  '{"line1": "14 Koeberg Road", "line2": "Unit 7", "suburb": "Montague Gardens", "city": "Cape Town", "province": "Western Cape", "postal_code": "7441", "country": "South Africa"}'::jsonb,
  'PO-CF-2024-0876',
  'Urgent — required before month end.',
  NOW() - INTERVAL '2 days', NULL, NULL
)
ON CONFLICT (id) DO NOTHING;

-- ── Order 3: 30-day, fulfilled ─────────────────────────────────────────
-- Subtotal: R2,021.00  |  VAT (15%): R303.15  |  Total: R2,324.15
-- Item 1 has a 5% line discount.

INSERT INTO public.orders (
  id, profile_id, status, payment_method,
  subtotal, discount_amount, vat_amount, total_amount,
  shipping_address,
  buyer_reference, notes,
  confirmed_at, fulfilled_at, cancelled_at
)
VALUES (
  '40000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  'fulfilled',
  '30_day_account',
  2021.00, 0.00, 303.15, 2324.15,
  '{"line1": "88 Commissioner Street", "suburb": "Marshalltown", "city": "Johannesburg", "province": "Gauteng", "postal_code": "2001", "country": "South Africa"}'::jsonb,
  'HHG-PO-1144',
  NULL,
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '3 days',
  NULL
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 7: Order Items
-- ============================================================
-- line_total = ROUND(unit_price * quantity * (1 - discount_pct / 100), 2)
-- Must match exactly — enforced by trg_order_items_validate_line_total.

INSERT INTO public.order_items (
  id, order_id, product_id,
  sku, product_name, unit_price, quantity, discount_pct, line_total
)
VALUES
  -- Order 1: EFT pending
  (
    '60000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'CLN-DEGREASER-5L', 'Multi-Surface Degreaser 5L',
    145.00, 5, 0.00, 725.00     -- ROUND(145.00 × 5 × 1.00, 2) = 725.00
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'CLN-BLEACH-25L', 'Industrial Bleach 25L',
    89.50, 2, 0.00, 179.00      -- ROUND(89.50 × 2 × 1.00, 2) = 179.00
  ),

  -- Order 2: EFT confirmed
  (
    '60000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000004',
    'PAP-A4-COPY80', 'A4 Copy Paper 80gsm (Box of 5 Reams)',
    215.00, 8, 0.00, 1720.00    -- ROUND(215.00 × 8 × 1.00, 2) = 1720.00
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000009',
    'CAT-CUP-DISP-250', 'Disposable Cups 250ml (Pack of 1000)',
    165.00, 3, 0.00, 495.00     -- ROUND(165.00 × 3 × 1.00, 2) = 495.00
  ),

  -- Order 3: 30-day fulfilled (item 1 has 5% discount)
  (
    '60000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000006',
    'SAF-GLOVE-LATEX-M', 'Latex Examination Gloves Medium (Box of 100)',
    78.00, 10, 5.00, 741.00     -- ROUND(78.00 × 10 × 0.95, 2) = 741.00
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000007',
    'SAF-MASK-N95-20', 'N95 Respirator Masks (Box of 20)',
    320.00, 4, 0.00, 1280.00    -- ROUND(320.00 × 4 × 1.00, 2) = 1280.00
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 8: Payments (EFT orders only)
-- ============================================================
-- Order 1 (pending): payment submitted, awaiting verification.
-- Order 2 (confirmed): payment verified.
-- Order 3 (30-day): no payment record — skips payment entirely.

INSERT INTO public.payments (
  id, order_id, payment_method, amount,
  status, reference, notes,
  submitted_at, verified_at, verified_by
)
VALUES
  -- Order 1: pending payment
  (
    '70000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'eft',
    1039.60,
    'pending',
    'SWD-CAPEFRESH-001',
    'EFT submitted. Awaiting admin verification.',
    NOW() - INTERVAL '1 day',
    NULL,
    NULL
  ),
  -- Order 2: verified payment
  (
    '70000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'eft',
    2547.25,
    'verified',
    'SWD-CAPEFRESH-002',
    NULL,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    NULL  -- verified_by would be admin profile UUID; NULL for seed data
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SEED COMPLETE
-- ============================================================
-- Summary of what was inserted:
--
-- tenant_config (1 row updated)
-- categories    (4 rows): Cleaning, Paper, Safety, Catering
-- products     (10 rows): CLN-DEGREASER-5L … CAT-FOIL-TRAY-3
-- profiles      (2 rows): TEST-EFT-001 (buyer_default), TEST-30D-002 (buyer_30_day)
-- addresses     (2 rows): one default shipping address per buyer
-- orders        (3 rows): 1×pending EFT, 1×confirmed EFT, 1×fulfilled 30-day
-- order_items   (6 rows): 2+2+2 items for the three orders
-- payments      (2 rows): 1×pending, 1×verified (EFT orders only)
--
-- Buyer logins (on /login page):
--   Account Number: TEST-EFT-001   → EFT checkout flow
--   Account Number: TEST-30D-002   → 30-Day bypass flow
-- ============================================================

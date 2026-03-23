-- ============================================================
-- AR Steel Manufacturing — Complete Product Seed
-- ============================================================
-- Run AFTER init.sql in the Supabase SQL Editor.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
-- Wrap in BEGIN/COMMIT so errors roll back cleanly.
--
-- Contents:
--   Section 1: Tenant Configuration (AR Steel Manufacturing)
--   Section 2: Categories (16 product categories)
--   Section 3: Products (142 SKUs from the product catalogue)
--   Section 4: QA Test Buyer Profiles (2 accounts)
--   Section 5: QA Test Addresses
-- ============================================================

BEGIN;


-- ============================================================
-- SECTION 1: Tenant Configuration
-- ============================================================

UPDATE public.tenant_config SET
  business_name         = 'AR Steel Manufacturing (Pty) Ltd',
  trading_name          = 't/a AR Steel Manufacturing',
  vat_number            = '4300293455',
  bank_reference_prefix = 'ARM',
  email_from_name       = 'AR Steel Manufacturing',
  email_from_address    = 'info@armanufacturing.co.za',
  email_reply_to        = 'info@armanufacturing.co.za',
  support_phone         = '021 271 0526',
  support_email         = 'info@armanufacturing.co.za',
  website_url           = 'https://www.armanufacturing.co.za',
  footer_text           = 'AR Steel Manufacturing (Pty) Ltd | Reg: 2014/198126/07 | VAT: 4300293455 | 15 Hadji Ebrahim Crescent, Unit 9, Belgravia Industrial Park, Athlone, 7764 | Tel: 021 271 0526 | info@armanufacturing.co.za | www.armanufacturing.co.za | Payment confirms acceptance of standard terms & conditions. E&OE.'
WHERE id = 1;


-- ============================================================
-- SECTION 2: Categories
-- ============================================================
-- Using deterministic UUIDs (20000001-…) — non-colliding with existing seed.

INSERT INTO public.categories (id, name, slug, description, display_order, is_active)
VALUES
  ('20000001-0000-0000-0000-000000000001', 'Carport Poles',                   'carport-poles',                  'Round and square structural steel poles for carport construction.',                          10,  true),
  ('20000001-0000-0000-0000-000000000002', 'Washing Line Poles',               'washing-line-poles',             'Galvanised round steel poles for washing line installations.',                               20,  true),
  ('20000001-0000-0000-0000-000000000003', 'Flashings',                        'flashings',                      'Galvanised steel flashings for roofing applications — sidewall and barge board profiles.',    30,  true),
  ('20000001-0000-0000-0000-000000000004', 'Truss Hangers',                    'truss-hangers',                  'Galvanised pressed-steel joist hangers and mini truss hangers.',                              40,  true),
  ('20000001-0000-0000-0000-000000000005', 'Truss Clips',                      'truss-clips',                    'Hurricane wind uplift clips for securing roof trusses to wall plates.',                        50,  true),
  ('20000001-0000-0000-0000-000000000006', 'L-Plates',                         'l-plates',                       'Galvanised L-shaped connector plates for timber-to-timber and timber-to-wall joints.',        60,  true),
  ('20000001-0000-0000-0000-000000000007', 'Truss Nail Plates',                'truss-nail-plates',              'Toothed galvanised nail plates for timber truss fabrication and repair.',                      70,  true),
  ('20000001-0000-0000-0000-000000000008', 'Galv. Bracing Straps',             'galv-bracing-straps',            'Galvanised perforated steel strapping for structural bracing and tie-down applications.',      80,  true),
  ('20000001-0000-0000-0000-000000000009', 'Galv. Hoop Iron',                  'galv-hoop-iron',                 'Galvanised flat steel hoop iron for masonry reinforcement and strapping.',                     90,  true),
  ('20000001-0000-0000-0000-000000000010', 'Razor Wire & Security',             'razor-wire-security',            'Razor wire concertina, flat wrap, brackets, wall spikes, and vibracrete channels.',            100, true),
  ('20000001-0000-0000-0000-000000000011', 'Argo Range',                       'argo-range',                     'Argo brand gate wheel kits, StrikeMax welding rods, and cutting disks.',                       110, true),
  ('20000001-0000-0000-0000-000000000012', 'Lock Boxes & Holders',             'lock-boxes-holders',             'Steel lock boxes and lock holders for sliding and swing gate installations.',                  120, true),
  ('20000001-0000-0000-0000-000000000013', 'Gate Catches & Lugs',              'gate-catches-lugs',              'Gate catches, flat lugs, 90-degree lugs, and lug feet for gate fabrication.',                  130, true),
  ('20000001-0000-0000-0000-000000000014', 'Hinges & Bolt Locks',              'hinges-bolt-locks',              'Butterfly and R16 hinges, barrel bolts, and drop bolts for gates and doors.',                  140, true),
  ('20000001-0000-0000-0000-000000000015', 'Palisade Spikes & Razor Combs',   'palisade-spikes-razor-combs',    'Palisade fence spikes and razor wire combs for perimeter security.',                            150, true),
  ('20000001-0000-0000-0000-000000000016', 'Gate Wheels & Guides',             'gate-wheels-guides',             'V-groove gate wheels, nylon guide wheels, guide tracks, and adjustable brackets.',             160, true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 3: Products (142 SKUs)
-- ============================================================
-- UUID prefix: 30000001-0000-0000-0000-0000000000{001..142}
-- All prices set to 0.00 — update via admin panel.
-- All track_stock = false, stock_qty = 0, low_stock_alert = NULL.
-- ============================================================

INSERT INTO public.products (
  id, sku, name, description, details,
  price, category_id,
  track_stock, stock_qty, low_stock_alert,
  tags, is_active
)
VALUES

-- ── CARPORT POLES (cat 1) ──────────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000001', 'POLE01',
   'Carport Pole Round 76x1.2mm (3.0m)',
   'Round galvanised steel tube for carport frame construction. 76mm diameter, 1.2mm wall thickness, 3.0m length.',
   'Diameter: 76mm. Wall thickness: 1.2mm. Length: 3.0m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'round', '76mm', '3m'], true),

  ('30000001-0000-0000-0000-000000000002', 'POLE03',
   'Carport Pole Round 76x1.2mm (3.6m)',
   'Round galvanised steel tube for carport frame construction. 76mm diameter, 1.2mm wall thickness, 3.6m length.',
   'Diameter: 76mm. Wall thickness: 1.2mm. Length: 3.6m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'round', '76mm', '3.6m'], true),

  ('30000001-0000-0000-0000-000000000003', 'POLE04',
   'Carport Pole Round 76x1.6mm (3.0m)',
   'Heavy-gauge round galvanised steel tube for carport frame construction. 76mm diameter, 1.6mm wall thickness, 3.0m length.',
   'Diameter: 76mm. Wall thickness: 1.6mm. Length: 3.0m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'round', '76mm', '1.6mm', '3m'], true),

  ('30000001-0000-0000-0000-000000000004', 'POLE14',
   'Carport Pole Round 76x1.6mm (3.6m)',
   'Heavy-gauge round galvanised steel tube for carport frame construction. 76mm diameter, 1.6mm wall thickness, 3.6m length.',
   'Diameter: 76mm. Wall thickness: 1.6mm. Length: 3.6m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'round', '76mm', '1.6mm', '3.6m'], true),

  ('30000001-0000-0000-0000-000000000005', 'POLE02',
   'Carport Pole Round 60x1.2mm (3.0m)',
   'Round galvanised steel tube for carport frame construction. 60mm diameter, 1.2mm wall thickness, 3.0m length.',
   'Diameter: 60mm. Wall thickness: 1.2mm. Length: 3.0m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'round', '60mm', '3m'], true),

  ('30000001-0000-0000-0000-000000000006', 'POLE05',
   'Carport Pole Square 76x76x1.2mm (3.0m)',
   'Square galvanised steel tube for carport frame construction. 76x76mm section, 1.2mm wall thickness, 3.0m length.',
   'Section: 76x76mm. Wall thickness: 1.2mm. Length: 3.0m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'square', '76mm', '3m'], true),

  ('30000001-0000-0000-0000-000000000007', 'POLE07',
   'Carport Pole Square 76x76x1.2mm (3.6m)',
   'Square galvanised steel tube for carport frame construction. 76x76mm section, 1.2mm wall thickness, 3.6m length.',
   'Section: 76x76mm. Wall thickness: 1.2mm. Length: 3.6m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'square', '76mm', '3.6m'], true),

  ('30000001-0000-0000-0000-000000000008', 'POLE11',
   'Carport Pole Square 76x76x1.6mm (3.0m)',
   'Heavy-gauge square galvanised steel tube for carport frame construction. 76x76mm section, 1.6mm wall thickness, 3.0m length.',
   'Section: 76x76mm. Wall thickness: 1.6mm. Length: 3.0m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'square', '76mm', '1.6mm', '3m'], true),

  ('30000001-0000-0000-0000-000000000009', 'POLE15',
   'Carport Pole Square 76x76x1.6mm (3.6m)',
   'Heavy-gauge square galvanised steel tube for carport frame construction. 76x76mm section, 1.6mm wall thickness, 3.6m length.',
   'Section: 76x76mm. Wall thickness: 1.6mm. Length: 3.6m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'square', '76mm', '1.6mm', '3.6m'], true),

  ('30000001-0000-0000-0000-000000000010', 'POLE06',
   'Carport Pole Square 60x60x1.2mm (3.0m)',
   'Square galvanised steel tube for carport frame construction. 60x60mm section, 1.2mm wall thickness, 3.0m length.',
   'Section: 60x60mm. Wall thickness: 1.2mm. Length: 3.0m. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000001', false, 0, NULL,
   ARRAY['carport', 'pole', 'square', '60mm', '3m'], true),

-- ── WASHING LINE POLES (cat 2) ────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000011', 'POLE08',
   'Washing Line Pole Round 48mm (2.4m)',
   'Round galvanised steel pole for washing line installations. 48mm diameter, 2.4m length.',
   'Diameter: 48mm. Length: 2.4m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000002', false, 0, NULL,
   ARRAY['washing line', 'pole', 'round', '48mm'], true),

  ('30000001-0000-0000-0000-000000000012', 'POLE09',
   'Washing Line Pole Round 60mm (2.4m)',
   'Round galvanised steel pole for washing line installations. 60mm diameter, 2.4m length.',
   'Diameter: 60mm. Length: 2.4m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000002', false, 0, NULL,
   ARRAY['washing line', 'pole', 'round', '60mm'], true),

-- ── FLASHINGS (cat 3) ────────────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000013', 'TA051',
   'Galv. Flashing Sidewall 230x75mm (2.4m) 0.4mm',
   'Galvanised steel sidewall flashing for roofing applications. 230mm x 75mm profile, 0.4mm thickness, 2.4m length. Also available in 0.3mm and 0.47mm thicknesses.',
   'Profile: Sidewall 230x75mm. Thickness: 0.4mm. Length: 2.4m. Pack qty: 20.',
   0.00, '20000001-0000-0000-0000-000000000003', false, 0, NULL,
   ARRAY['flashing', 'sidewall', 'galvanised', 'roofing'], true),

  ('30000001-0000-0000-0000-000000000014', 'TA054',
   'Galv. Flashing Barge Board 200x200mm (2.4m) 0.4mm',
   'Galvanised steel barge board flashing for roofing applications. 200mm x 200mm profile, 0.4mm thickness, 2.4m length. Also available in 0.3mm and 0.47mm thicknesses.',
   'Profile: Barge Board 200x200mm. Thickness: 0.4mm. Length: 2.4m. Pack qty: 20.',
   0.00, '20000001-0000-0000-0000-000000000003', false, 0, NULL,
   ARRAY['flashing', 'barge board', 'galvanised', 'roofing'], true),

  ('30000001-0000-0000-0000-000000000015', 'TA057',
   'Galv. Flashing Barge Board 230x230mm (2.4m) 0.4mm',
   'Galvanised steel barge board flashing for roofing applications. 230mm x 230mm profile, 0.4mm thickness, 2.4m length. Also available in 0.3mm and 0.47mm thicknesses.',
   'Profile: Barge Board 230x230mm. Thickness: 0.4mm. Length: 2.4m. Pack qty: 20.',
   0.00, '20000001-0000-0000-0000-000000000003', false, 0, NULL,
   ARRAY['flashing', 'barge board', 'galvanised', 'roofing'], true),

-- ── TRUSS HANGERS (cat 4) ────────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000016', 'TA001',
   'Galv. Truss Hanger 38mm',
   'Galvanised pressed-steel joist hanger for 38mm timber members. Used to support roof trusses and floor joists.',
   'Size: 38mm. Material: Galvanised steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000004', false, 0, NULL,
   ARRAY['truss', 'hanger', 'joist', '38mm', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000017', 'TA002',
   'Galv. Truss Hanger 50mm',
   'Galvanised pressed-steel joist hanger for 50mm timber members. Used to support roof trusses and floor joists.',
   'Size: 50mm. Material: Galvanised steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000004', false, 0, NULL,
   ARRAY['truss', 'hanger', 'joist', '50mm', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000018', 'TH004',
   'Galv. Truss Hanger 38mm Mini',
   'Compact galvanised pressed-steel joist hanger for 38mm timber members in restricted-space applications.',
   'Size: 38mm Mini. Material: Galvanised steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000004', false, 0, NULL,
   ARRAY['truss', 'hanger', 'mini', '38mm', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000019', 'TH005',
   'Galv. Truss Hanger 50mm Mini',
   'Compact galvanised pressed-steel joist hanger for 50mm timber members in restricted-space applications.',
   'Size: 50mm Mini. Material: Galvanised steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000004', false, 0, NULL,
   ARRAY['truss', 'hanger', 'mini', '50mm', 'galvanised'], true),

-- ── TRUSS CLIPS (cat 5) ──────────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000020', 'TA006',
   'Hurricane Clip (Left)',
   'Galvanised steel wind uplift clip for securing roof trusses to wall plates. Left-hand orientation.',
   'Orientation: Left. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000005', false, 0, NULL,
   ARRAY['hurricane clip', 'truss clip', 'wind uplift', 'left'], true),

  ('30000001-0000-0000-0000-000000000021', 'TA007',
   'Hurricane Clip (Right)',
   'Galvanised steel wind uplift clip for securing roof trusses to wall plates. Right-hand orientation.',
   'Orientation: Right. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000005', false, 0, NULL,
   ARRAY['hurricane clip', 'truss clip', 'wind uplift', 'right'], true),

-- ── L-PLATES (cat 6) ─────────────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000022', 'TA020',
   'L-Plate 50(h) x 50(w) x 20(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 50mm height, 50mm width, 20mm leg length.',
   'Dimensions: 50(h) x 50(w) x 20(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000023', 'TA021',
   'L-Plate 50(h) x 50(w) x 50(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 50mm height, 50mm width, 50mm leg length.',
   'Dimensions: 50(h) x 50(w) x 50(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000024', 'TA022',
   'L-Plate 50(h) x 50(w) x 100(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 50mm height, 50mm width, 100mm leg length.',
   'Dimensions: 50(h) x 50(w) x 100(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000025', 'TA023',
   'L-Plate 50(h) x 150(w) x 50(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 50mm height, 150mm width, 50mm leg length.',
   'Dimensions: 50(h) x 150(w) x 50(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000026', 'TA024',
   'L-Plate 50(h) x 250(w) x 50(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 50mm height, 250mm width, 50mm leg length.',
   'Dimensions: 50(h) x 250(w) x 50(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000027', 'TA025',
   'L-Plate 75(h) x 65(w) x 150(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 75mm height, 65mm width, 150mm leg length.',
   'Dimensions: 75(h) x 65(w) x 150(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000028', 'TA026',
   'L-Plate 75(h) x 75(w) x 20(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 75mm height, 75mm width, 20mm leg length.',
   'Dimensions: 75(h) x 75(w) x 20(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000029', 'TA027',
   'L-Plate 100(h) x 50(w) x 50(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 100mm height, 50mm width, 50mm leg length.',
   'Dimensions: 100(h) x 50(w) x 50(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000030', 'TA028',
   'L-Plate 100(h) x 100(w) x 20(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 100mm height, 100mm width, 20mm leg length.',
   'Dimensions: 100(h) x 100(w) x 20(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000031', 'TA029',
   'L-Plate 100(h) x 100(w) x 50(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 100mm height, 100mm width, 50mm leg length.',
   'Dimensions: 100(h) x 100(w) x 50(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000032', 'TA030',
   'L-Plate 150(h) x 150(w) x 50(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 150mm height, 150mm width, 50mm leg length.',
   'Dimensions: 150(h) x 150(w) x 50(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000033', 'TA031',
   'L-Plate 80(h) x 100(w) x 150(l)',
   'Galvanised steel L-shaped connector plate for timber framing. 80mm height, 100mm width, 150mm leg length.',
   'Dimensions: 80(h) x 100(w) x 150(l) mm. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000006', false, 0, NULL,
   ARRAY['l-plate', 'connector', 'bracket', 'galvanised'], true),

-- ── TRUSS NAIL PLATES (cat 7) ────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000034', 'TA010',
   'Truss Nail Plate 50mm x 50mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 50mm x 50mm.',
   'Dimensions: 50 x 50mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000035', 'TA011',
   'Truss Nail Plate 50mm x 100mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 50mm x 100mm.',
   'Dimensions: 50 x 100mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000036', 'TA012',
   'Truss Nail Plate 50mm x 150mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 50mm x 150mm.',
   'Dimensions: 50 x 150mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000037', 'TA013',
   'Truss Nail Plate 100mm x 100mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 100mm x 100mm.',
   'Dimensions: 100 x 100mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000038', 'TA014',
   'Truss Nail Plate 100mm x 150mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 100mm x 150mm.',
   'Dimensions: 100 x 150mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000039', 'TA015',
   'Truss Nail Plate 100mm x 200mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 100mm x 200mm.',
   'Dimensions: 100 x 200mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000040', 'TA016',
   'Truss Nail Plate 100mm x 250mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 100mm x 250mm.',
   'Dimensions: 100 x 250mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000041', 'TA017',
   'Truss Nail Plate 150mm x 150mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 150mm x 150mm.',
   'Dimensions: 150 x 150mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000042', 'TA018',
   'Truss Nail Plate 150mm x 250mm',
   'Galvanised toothed nail plate for timber truss joint fabrication and repair. 150mm x 250mm.',
   'Dimensions: 150 x 250mm. Material: Galvanised toothed steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000007', false, 0, NULL,
   ARRAY['nail plate', 'truss', 'timber', 'galvanised'], true),

-- ── GALV. BRACING STRAPS (cat 8) ────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000043', 'TA032',
   'Galv. Bracing Strap 25mm (3m)',
   'Galvanised perforated steel bracing strap for structural tie-down and bracing applications. 25mm wide, 3m length.',
   'Width: 25mm. Length: 3m. Material: Galvanised perforated steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000008', false, 0, NULL,
   ARRAY['bracing strap', 'perforated', 'galvanised', '25mm'], true),

  ('30000001-0000-0000-0000-000000000044', 'TA033',
   'Galv. Bracing Strap 25mm (5m)',
   'Galvanised perforated steel bracing strap for structural tie-down and bracing applications. 25mm wide, 5m length.',
   'Width: 25mm. Length: 5m. Material: Galvanised perforated steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000008', false, 0, NULL,
   ARRAY['bracing strap', 'perforated', 'galvanised', '25mm'], true),

  ('30000001-0000-0000-0000-000000000045', 'TA034',
   'Galv. Bracing Strap 25mm (10m)',
   'Galvanised perforated steel bracing strap for structural tie-down and bracing applications. 25mm wide, 10m length.',
   'Width: 25mm. Length: 10m. Material: Galvanised perforated steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000008', false, 0, NULL,
   ARRAY['bracing strap', 'perforated', 'galvanised', '25mm'], true),

  ('30000001-0000-0000-0000-000000000046', 'TA035',
   'Galv. Bracing Strap 25mm (20m)',
   'Galvanised perforated steel bracing strap for structural tie-down and bracing applications. 25mm wide, 20m length.',
   'Width: 25mm. Length: 20m. Material: Galvanised perforated steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000008', false, 0, NULL,
   ARRAY['bracing strap', 'perforated', 'galvanised', '25mm'], true),

  ('30000001-0000-0000-0000-000000000047', 'TA036',
   'Galv. Bracing Strap 25mm (30m)',
   'Galvanised perforated steel bracing strap for structural tie-down and bracing applications. 25mm wide, 30m length.',
   'Width: 25mm. Length: 30m. Material: Galvanised perforated steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000008', false, 0, NULL,
   ARRAY['bracing strap', 'perforated', 'galvanised', '25mm'], true),

-- ── GALV. HOOP IRON (cat 9) ──────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000048', 'TA037',
   'Galv. Hoop Iron 32mm (3m)',
   'Galvanised flat steel hoop iron for masonry reinforcement and general strapping. 32mm wide, 3m length.',
   'Width: 32mm. Length: 3m. Material: Galvanised flat steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000009', false, 0, NULL,
   ARRAY['hoop iron', 'galvanised', 'masonry', '32mm'], true),

  ('30000001-0000-0000-0000-000000000049', 'TA038',
   'Galv. Hoop Iron 32mm (5m)',
   'Galvanised flat steel hoop iron for masonry reinforcement and general strapping. 32mm wide, 5m length.',
   'Width: 32mm. Length: 5m. Material: Galvanised flat steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000009', false, 0, NULL,
   ARRAY['hoop iron', 'galvanised', 'masonry', '32mm'], true),

  ('30000001-0000-0000-0000-000000000050', 'TA039',
   'Galv. Hoop Iron 32mm (10m)',
   'Galvanised flat steel hoop iron for masonry reinforcement and general strapping. 32mm wide, 10m length.',
   'Width: 32mm. Length: 10m. Material: Galvanised flat steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000009', false, 0, NULL,
   ARRAY['hoop iron', 'galvanised', 'masonry', '32mm'], true),

  ('30000001-0000-0000-0000-000000000051', 'TA040',
   'Galv. Hoop Iron 32mm (20m)',
   'Galvanised flat steel hoop iron for masonry reinforcement and general strapping. 32mm wide, 20m length.',
   'Width: 32mm. Length: 20m. Material: Galvanised flat steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000009', false, 0, NULL,
   ARRAY['hoop iron', 'galvanised', 'masonry', '32mm'], true),

  ('30000001-0000-0000-0000-000000000052', 'TA041',
   'Galv. Hoop Iron 32mm (30m)',
   'Galvanised flat steel hoop iron for masonry reinforcement and general strapping. 32mm wide, 30m length.',
   'Width: 32mm. Length: 30m. Material: Galvanised flat steel. Pack qty: 5.',
   0.00, '20000001-0000-0000-0000-000000000009', false, 0, NULL,
   ARRAY['hoop iron', 'galvanised', 'masonry', '32mm'], true),

-- ── RAZOR WIRE & SECURITY (cat 10) ──────────────────────────────────────

  ('30000001-0000-0000-0000-000000000053', 'WVA001',
   'Razor Wire Concertina (11m)',
   'Coiled concertina razor wire for perimeter security. Expands to 11m. Suitable for wall tops and fence installation.',
   'Type: Concertina (coiled). Expanded length: 11m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['razor wire', 'concertina', 'security', 'perimeter'], true),

  ('30000001-0000-0000-0000-000000000054', 'WVA002',
   'Razor Wire Flat Wrap (15m)',
   'Flat-wrap razor wire for perimeter security. 15m length. Suitable for wall tops, fences, and palisade installations.',
   'Type: Flat wrap. Length: 15m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['razor wire', 'flat wrap', 'security', 'perimeter'], true),

  ('30000001-0000-0000-0000-000000000055', 'WVA003',
   'Razor Wire Straight Bracket',
   'Steel straight bracket for mounting razor wire concertina on walls and fences.',
   'Type: Straight bracket. Material: Steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['razor wire', 'bracket', 'straight', 'security'], true),

  ('30000001-0000-0000-0000-000000000056', 'WVA004',
   'Galv. Razor Wire Angle 45° Bracket',
   'Galvanised steel 45-degree angle bracket for mounting razor wire concertina on walls and fences.',
   'Type: 45-degree angle bracket. Material: Galvanised steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['razor wire', 'bracket', '45 degree', 'galvanised', 'security'], true),

  ('30000001-0000-0000-0000-000000000057', 'WV003',
   'Baracuda Wall Spike (2.4m) Black',
   'Black powder-coated Baracuda steel wall spike for security on top of boundary walls. 2.4m length.',
   'Finish: Black powder-coated. Length: 2.4m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['wall spike', 'baracuda', 'security', 'black', '2.4m'], true),

  ('30000001-0000-0000-0000-000000000058', 'WV004',
   'Galv. Baracuda Wall Spike (2.4m)',
   'Galvanised Baracuda steel wall spike for security on top of boundary walls. 2.4m length.',
   'Finish: Galvanised. Length: 2.4m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['wall spike', 'baracuda', 'security', 'galvanised', '2.4m'], true),

  ('30000001-0000-0000-0000-000000000059', 'WV005',
   'Galv. Baracuda Wall Spike (1.5m)',
   'Galvanised Baracuda steel wall spike for security on top of boundary walls. 1.5m length.',
   'Finish: Galvanised. Length: 1.5m. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['wall spike', 'baracuda', 'security', 'galvanised', '1.5m'], true),

  ('30000001-0000-0000-0000-000000000060', 'WV006',
   'Galv. Baracuda Vibracrete Spike (1.5m)',
   'Galvanised Baracuda vibracrete spike for security on top of pre-cast concrete panels. 1.5m length.',
   'Finish: Galvanised. Length: 1.5m. Type: Vibracrete spike. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['vibracrete', 'spike', 'baracuda', 'security', 'galvanised', '1.5m'], true),

  ('30000001-0000-0000-0000-000000000061', 'WV007',
   'Galv. Baracuda Vibracrete Post-Spike',
   'Galvanised Baracuda post-mounted spike for vibracrete fence security.',
   'Finish: Galvanised. Type: Post-spike for vibracrete. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['vibracrete', 'post spike', 'baracuda', 'security', 'galvanised'], true),

  ('30000001-0000-0000-0000-000000000062', 'WV009',
   'Galv. Vibracrete Channels 0.5mm (2.4m)',
   'Galvanised steel U-channel for vibracrete fence panel construction. 0.5mm thickness, 2.4m length.',
   'Thickness: 0.5mm. Length: 2.4m. Dimensions: 50x25mm. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['vibracrete', 'channel', 'galvanised', '0.5mm', '2.4m'], true),

  ('30000001-0000-0000-0000-000000000063', 'WV010',
   'Galv. Vibracrete Channels 0.8mm (2.4m)',
   'Heavy-gauge galvanised steel U-channel for vibracrete fence panel construction. 0.8mm thickness, 2.4m length.',
   'Thickness: 0.8mm. Length: 2.4m. Dimensions: 50x25mm. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000010', false, 0, NULL,
   ARRAY['vibracrete', 'channel', 'galvanised', '0.8mm', '2.4m'], true),

-- ── ARGO RANGE (cat 11) ───────────────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000064', 'ARGO01',
   'Argo Wheel Kit 50mm',
   'Argo EasyRoll gate wheel kit for sliding gates. 50mm wheel diameter. Kit includes 2x PVC guides and 2x fully electro-plated wheels.',
   'Wheel diameter: 50mm. Kit includes: 2x PVC guides, 2x wheels. Finish: Electro-plated. Pack qty: 20.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'wheel kit', 'gate wheel', '50mm', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000065', 'ARGO02',
   'Argo Wheel Kit 60mm',
   'Argo EasyRoll gate wheel kit for sliding gates. 60mm wheel diameter. Kit includes 2x PVC guides and 2x fully electro-plated wheels.',
   'Wheel diameter: 60mm. Kit includes: 2x PVC guides, 2x wheels. Finish: Electro-plated. Pack qty: 20.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'wheel kit', 'gate wheel', '60mm', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000066', 'ARGO03',
   'Argo Wheel Kit 80mm',
   'Argo EasyRoll gate wheel kit for sliding gates. 80mm wheel diameter. Kit includes 2x PVC guides and 2x fully electro-plated wheels.',
   'Wheel diameter: 80mm. Kit includes: 2x PVC guides, 2x wheels. Finish: Electro-plated. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'wheel kit', 'gate wheel', '80mm', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000067', 'ARGO10',
   'Argo StrikeMax Welding Rods 1.0kg',
   'Argo StrikeMax general purpose welding electrodes. E6013 type. 1.0kg pack. Suitable for mild steel welding.',
   'Type: E6013 general purpose electrodes. Weight: 1.0kg. Approx 60 rods. Pack qty: 20.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'welding rods', 'electrodes', 'strikemax', '1kg'], true),

  ('30000001-0000-0000-0000-000000000068', 'ARGO11',
   'Argo StrikeMax Welding Rods 2.5kg',
   'Argo StrikeMax general purpose welding electrodes. E6013 type. 2.5kg pack. Suitable for mild steel welding.',
   'Type: E6013 general purpose electrodes. Weight: 2.5kg. Pack qty: 8.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'welding rods', 'electrodes', 'strikemax', '2.5kg'], true),

  ('30000001-0000-0000-0000-000000000069', 'ARGO12',
   'Argo StrikeMax Welding Rods 5.0kg',
   'Argo StrikeMax general purpose welding electrodes. E6013 type. 5.0kg pack. Suitable for mild steel welding.',
   'Type: E6013 general purpose electrodes. Weight: 5.0kg. Pack qty: 4.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'welding rods', 'electrodes', 'strikemax', '5kg'], true),

  ('30000001-0000-0000-0000-000000000070', 'ARGO20',
   'Argo Cutting Disk 115 x 1.0mm x 22.2',
   'Argo thin-cut cutting disk for angle grinders. 115mm diameter, 1.0mm thickness, 22.2mm bore. Suitable for steel and stainless steel.',
   'Diameter: 115mm. Thickness: 1.0mm. Bore: 22.2mm. For: angle grinder. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'cutting disk', '115mm', 'angle grinder'], true),

  ('30000001-0000-0000-0000-000000000071', 'ARGO21',
   'Argo Cutting Disk 230 x 3.0mm x 22.3',
   'Argo cutting disk for large angle grinders. 230mm diameter, 3.0mm thickness, 22.3mm bore. Suitable for steel.',
   'Diameter: 230mm. Thickness: 3.0mm. Bore: 22.3mm. For: large angle grinder. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'cutting disk', '230mm', 'angle grinder'], true),

  ('30000001-0000-0000-0000-000000000072', 'ARGO22',
   'Argo Cutting Disk 355 x 3.0mm x 22.3',
   'Argo cutting disk for chop saws. 355mm diameter, 3.0mm thickness, 22.3mm bore. Suitable for steel and mild steel.',
   'Diameter: 355mm. Thickness: 3.0mm. Bore: 22.3mm. For: chop saw / metal saw. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'cutting disk', '355mm', 'chop saw'], true),

  ('30000001-0000-0000-0000-000000000073', 'ARGO23',
   'Argo Cutting Disk 400 x 3.0mm x 22.3',
   'Argo cutting disk for large chop saws. 400mm diameter, 3.0mm thickness, 22.3mm bore. Suitable for steel.',
   'Diameter: 400mm. Thickness: 3.0mm. Bore: 22.3mm. For: large chop saw. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000011', false, 0, NULL,
   ARRAY['argo', 'cutting disk', '400mm', 'chop saw'], true),

-- ── LOCK BOXES & HOLDERS (cat 12) ────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000074', 'LB001',
   'Lock Box Lauden',
   'Standard Lauden-profile steel lock box for sliding gate motor lock installations.',
   'Profile: Lauden. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'lauden', 'gate', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000075', 'LB001-E',
   'Galv. Lock Box Lauden',
   'Galvanised Lauden-profile steel lock box for sliding gate motor lock installations. Corrosion resistant.',
   'Profile: Lauden. Finish: Galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'lauden', 'galvanised', 'gate', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000076', 'LB002',
   'Lock Box Lauden Long (1m)',
   'Extended 1m Lauden-profile steel lock box for sliding gate installations requiring longer lock coverage.',
   'Profile: Lauden. Length: 1m. Finish: Standard steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'lauden', 'long', '1m', 'gate'], true),

  ('30000001-0000-0000-0000-000000000077', 'LB003',
   'Lock Box Pear Shape (Small)',
   'Small pear-shaped steel lock box for gate lock installations.',
   'Profile: Pear shape small. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'pear shape', 'small', 'gate'], true),

  ('30000001-0000-0000-0000-000000000078', 'LB003-E',
   'Galv. Lock Box Pear Shape (Small)',
   'Small galvanised pear-shaped steel lock box for gate lock installations. Corrosion resistant.',
   'Profile: Pear shape small. Finish: Galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'pear shape', 'small', 'galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000079', 'LB004',
   'Lock Box Pear Shape Large',
   'Large pear-shaped steel lock box for gate lock installations.',
   'Profile: Pear shape large. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'pear shape', 'large', 'gate'], true),

  ('30000001-0000-0000-0000-000000000080', 'LB004-E',
   'Galv. Lock Box Pear Shape Large',
   'Large galvanised pear-shaped steel lock box for gate lock installations. Corrosion resistant.',
   'Profile: Pear shape large. Finish: Galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'pear shape', 'large', 'galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000081', 'LB005',
   'Lock Box Expanda',
   'Expanda-profile steel lock box for gate lock installations.',
   'Profile: Expanda. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'expanda', 'gate'], true),

  ('30000001-0000-0000-0000-000000000082', 'LB005-E',
   'Galv. Lock Box Expanda',
   'Galvanised Expanda-profile steel lock box for gate lock installations. Corrosion resistant.',
   'Profile: Expanda. Finish: Galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock box', 'expanda', 'galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000083', 'LBO10',
   'Lock Holder',
   'Standard steel lock holder for gate and door lock installations.',
   'Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock holder', 'gate', 'door'], true),

  ('30000001-0000-0000-0000-000000000084', 'LB011',
   'Electro-Galv. Lock Holder',
   'Electro-galvanised steel lock holder for gate and door lock installations. Improved corrosion resistance.',
   'Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['lock holder', 'electro galvanised', 'gate', 'door'], true),

  ('30000001-0000-0000-0000-000000000085', 'LB012',
   'Galv. Tap Lock',
   'Galvanised tap lock for securing gate latches and lock bars.',
   'Finish: Galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000012', false, 0, NULL,
   ARRAY['tap lock', 'galvanised', 'gate', 'latch'], true),

-- ── GATE CATCHES & LUGS (cat 13) ────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000086', 'GC001',
   'Gate Catch 32mm',
   'Steel gate catch for 32mm square or round tube gate frames.',
   'Size: 32mm. Finish: Standard steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['gate catch', '32mm', 'gate'], true),

  ('30000001-0000-0000-0000-000000000087', 'GC001-E',
   'Electro-Galv. Gate Catch 32mm',
   'Electro-galvanised steel gate catch for 32mm tube gate frames. Improved corrosion resistance.',
   'Size: 32mm. Finish: Electro-galvanised. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['gate catch', '32mm', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000088', 'GC002',
   'Gate Catch 38mm',
   'Steel gate catch for 38mm square or round tube gate frames.',
   'Size: 38mm. Finish: Standard steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['gate catch', '38mm', 'gate'], true),

  ('30000001-0000-0000-0000-000000000089', 'GC002-E',
   'Electro-Galv. Gate Catch 38mm',
   'Electro-galvanised steel gate catch for 38mm tube gate frames. Improved corrosion resistance.',
   'Size: 38mm. Finish: Electro-galvanised. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['gate catch', '38mm', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000090', 'GC003',
   'Gate Catch 50mm',
   'Steel gate catch for 50mm square or round tube gate frames.',
   'Size: 50mm. Finish: Standard steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['gate catch', '50mm', 'gate'], true),

  ('30000001-0000-0000-0000-000000000091', 'GC003-E',
   'Electro-Galv. Gate Catch 50mm',
   'Electro-galvanised steel gate catch for 50mm tube gate frames. Improved corrosion resistance.',
   'Size: 50mm. Finish: Electro-galvanised. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['gate catch', '50mm', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000092', 'LS001',
   'Lug 50 x 25 x 08mm',
   'Flat steel lug for gate and fence fabrication. 50mm x 25mm flat, 8mm hole.',
   'Dimensions: 50 x 25mm flat. Hole: 8mm. Finish: Standard steel. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', 'flat', '8mm hole', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000093', 'LS002',
   'Lug 50 x 25 x 10mm',
   'Flat steel lug for gate and fence fabrication. 50mm x 25mm flat, 10mm hole.',
   'Dimensions: 50 x 25mm flat. Hole: 10mm. Finish: Standard steel. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', 'flat', '10mm hole', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000094', 'LS003',
   'Lug 50 x 25 x 12mm',
   'Flat steel lug for gate and fence fabrication. 50mm x 25mm flat, 12mm hole.',
   'Dimensions: 50 x 25mm flat. Hole: 12mm. Finish: Standard steel. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', 'flat', '12mm hole', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000095', 'LS003-E',
   'Electro-Galv. Lugs 50 x 25 x 12mm',
   'Electro-galvanised flat steel lug for gate and fence fabrication. 50mm x 25mm flat, 12mm hole.',
   'Dimensions: 50 x 25mm flat. Hole: 12mm. Finish: Electro-galvanised. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', 'flat', '12mm hole', 'electro galvanised', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000096', 'LS008',
   'Lug 90° 50 x 25 with 10mm Hole',
   '90-degree bent steel lug for gate and fence fabrication. 50mm x 25mm, 10mm hole.',
   'Dimensions: 50 x 25mm. Angle: 90°. Hole: 10mm. Finish: Standard steel. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', '90 degree', '10mm hole', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000097', 'LS009',
   'Lug 90° 50 x 25 with 12mm Hole',
   '90-degree bent steel lug for gate and fence fabrication. 50mm x 25mm, 12mm hole.',
   'Dimensions: 50 x 25mm. Angle: 90°. Hole: 12mm. Finish: Standard steel. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', '90 degree', '12mm hole', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000098', 'LS009-E',
   'Electro-Galv. Lug 90° 50mm x 25mm with 12mm Hole',
   'Electro-galvanised 90-degree bent steel lug for gate and fence fabrication. 50mm x 25mm, 12mm hole.',
   'Dimensions: 50 x 25mm. Angle: 90°. Hole: 12mm. Finish: Electro-galvanised. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug', '90 degree', '12mm hole', 'electro galvanised', 'gate fabrication'], true),

  ('30000001-0000-0000-0000-000000000099', 'LS013',
   'Lug Feet 16mm with 08mm Hole',
   'Steel lug feet connector for gate and fence post base applications. 16mm, 8mm hole.',
   'Width: 16mm. Hole: 8mm. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug feet', '8mm hole', 'gate', 'post base'], true),

  ('30000001-0000-0000-0000-000000000100', 'LS011',
   'Lug Feet 16mm with 10mm Hole',
   'Steel lug feet connector for gate and fence post base applications. 16mm, 10mm hole.',
   'Width: 16mm. Hole: 10mm. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug feet', '10mm hole', 'gate', 'post base'], true),

  ('30000001-0000-0000-0000-000000000101', 'LS012',
   'Lug Feet 16mm with 12mm Hole',
   'Steel lug feet connector for gate and fence post base applications. 16mm, 12mm hole.',
   'Width: 16mm. Hole: 12mm. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug feet', '12mm hole', 'gate', 'post base'], true),

  ('30000001-0000-0000-0000-000000000102', 'LS012-E',
   'Electro-Galv. Lug Feet 16mm with 12mm Hole',
   'Electro-galvanised steel lug feet connector for gate and fence post base applications. 16mm, 12mm hole.',
   'Width: 16mm. Hole: 12mm. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000013', false, 0, NULL,
   ARRAY['lug feet', '12mm hole', 'electro galvanised', 'gate', 'post base'], true),

-- ── HINGES & BOLT LOCKS (cat 14) ────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000103', 'HS009',
   'Hinge Butterfly Steel Pin',
   'Butterfly-style weld-on gate hinge with steel pin. Suitable for steel gate and door fabrication.',
   'Type: Butterfly with steel pin. Finish: Standard steel. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'butterfly', 'steel pin', 'gate', 'weld-on'], true),

  ('30000001-0000-0000-0000-000000000104', 'HS009-E',
   'Electro-Galv. Hinge Butterfly Steel Pin',
   'Electro-galvanised butterfly-style weld-on gate hinge with steel pin. Improved corrosion resistance.',
   'Type: Butterfly with steel pin. Finish: Electro-galvanised. Pack qty: 100.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'butterfly', 'steel pin', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000105', 'HS010',
   'Hinge Butterfly Brass Pin',
   'Butterfly-style weld-on gate hinge with brass pin. Self-lubricating for smooth operation.',
   'Type: Butterfly with brass pin. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'butterfly', 'brass pin', 'gate', 'weld-on'], true),

  ('30000001-0000-0000-0000-000000000106', 'HS011',
   'Hinge R16',
   'R16 weld-on gate hinge for steel gate fabrication.',
   'Type: R16. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r16', 'gate', 'weld-on'], true),

  ('30000001-0000-0000-0000-000000000107', 'HS011-E',
   'Electro-Galv. Hinge R16',
   'Electro-galvanised R16 weld-on gate hinge. Improved corrosion resistance.',
   'Type: R16. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r16', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000108', 'HS012',
   'Hinge R16 Extended Flat',
   'R16 weld-on gate hinge with extended flat plate for wider gate mounting surface.',
   'Type: R16 Extended Flat. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r16', 'extended flat', 'gate'], true),

  ('30000001-0000-0000-0000-000000000109', 'HS012-E',
   'Electro-Galv. Hinge R16 Extended Flat',
   'Electro-galvanised R16 weld-on gate hinge with extended flat plate.',
   'Type: R16 Extended Flat. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r16', 'extended flat', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000110', 'HS013',
   'Hinge R16 Swivel',
   'R16 swivel gate hinge allowing adjustable gate alignment during and after installation.',
   'Type: R16 Swivel. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r16', 'swivel', 'adjustable', 'gate'], true),

  ('30000001-0000-0000-0000-000000000111', 'HS013-E',
   'Electro-Galv. Hinge R16 Swivel',
   'Electro-galvanised R16 swivel gate hinge. Adjustable alignment with improved corrosion resistance.',
   'Type: R16 Swivel. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r16', 'swivel', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000112', 'HS014',
   'Hinge Swivel Extended Flat',
   'Swivel gate hinge with extended flat plate for adjustable gate alignment and wider mounting surface.',
   'Type: Swivel Extended Flat. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'swivel', 'extended flat', 'adjustable', 'gate'], true),

  ('30000001-0000-0000-0000-000000000113', 'HS015',
   'Hinge R15 Multi',
   'R15 multi-purpose weld-on gate hinge with double pivot for heavy-duty gate applications.',
   'Type: R15 Multi. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r15', 'multi', 'heavy duty', 'gate'], true),

  ('30000001-0000-0000-0000-000000000114', 'HS015-E',
   'Electro-Galv. Hinge R15 Multi',
   'Electro-galvanised R15 multi-purpose weld-on gate hinge. Heavy-duty with improved corrosion resistance.',
   'Type: R15 Multi. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['hinge', 'r15', 'multi', 'electro galvanised', 'gate'], true),

  ('30000001-0000-0000-0000-000000000115', 'BL001',
   'Barrel Bolt 12mm',
   'Steel barrel bolt for gate and door locking. 12mm diameter barrel.',
   'Type: Barrel bolt. Diameter: 12mm. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['barrel bolt', '12mm', 'gate', 'door', 'lock'], true),

  ('30000001-0000-0000-0000-000000000116', 'BL001-E',
   'Electro-Galv. Barrel Bolt 12mm',
   'Electro-galvanised steel barrel bolt for gate and door locking. 12mm diameter.',
   'Type: Barrel bolt. Diameter: 12mm. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['barrel bolt', '12mm', 'electro galvanised', 'gate', 'door', 'lock'], true),

  ('30000001-0000-0000-0000-000000000117', 'DB001',
   'Drop Bolt 12mm',
   'Steel drop bolt for securing double gates and doors to the ground or floor socket.',
   'Type: Drop bolt. Diameter: 12mm. Finish: Standard steel. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['drop bolt', '12mm', 'gate', 'double gate', 'lock'], true),

  ('30000001-0000-0000-0000-000000000118', 'DB001-E',
   'Electro-Galv. Drop Bolt 12mm',
   'Electro-galvanised steel drop bolt for securing double gates to the ground or floor socket.',
   'Type: Drop bolt. Diameter: 12mm. Finish: Electro-galvanised. Pack qty: 50.',
   0.00, '20000001-0000-0000-0000-000000000014', false, 0, NULL,
   ARRAY['drop bolt', '12mm', 'electro galvanised', 'gate', 'double gate'], true),

-- ── PALISADE SPIKES & RAZOR COMBS (cat 15) ──────────────────────────────

  ('30000001-0000-0000-0000-000000000119', 'WV001',
   'Razor Wire Comb 2mm (2.4m)',
   'Standard steel razor wire comb for perimeter security on walls, fences, and palisades. 2mm wire, 2.4m length.',
   'Wire: 2mm. Length: 2.4m. Finish: Standard steel. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['razor comb', 'security', 'perimeter', '2.4m'], true),

  ('30000001-0000-0000-0000-000000000120', 'WV002',
   'Galv. Razor Wire Comb 2mm (2.4m)',
   'Galvanised steel razor wire comb for perimeter security. Corrosion resistant. 2mm wire, 2.4m length.',
   'Wire: 2mm. Length: 2.4m. Finish: Galvanised. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['razor comb', 'galvanised', 'security', 'perimeter', '2.4m'], true),

  ('30000001-0000-0000-0000-000000000121', 'ARP001',
   'AR Palisade Spike 30x30x2mm (300mm)',
   'AR Steel palisade spike for palisade fence security. 30x30mm square section, 2mm wall, 300mm length. Readily available.',
   'Section: 30x30mm. Wall: 2mm. Length: 300mm. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['palisade spike', 'ar steel', '300mm', 'security', 'fence'], true),

  ('30000001-0000-0000-0000-000000000122', 'ARP002',
   'AR Palisade Spike 30x30x2mm (400mm)',
   'AR Steel palisade spike for palisade fence security. 30x30mm square section, 2mm wall, 400mm length. Readily available.',
   'Section: 30x30mm. Wall: 2mm. Length: 400mm. Pack qty: 25.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['palisade spike', 'ar steel', '400mm', 'security', 'fence'], true),

  ('30000001-0000-0000-0000-000000000123', 'ARP003',
   'AR Palisade Spike 30x30x2mm (600mm)',
   'AR Steel palisade spike for palisade fence security. 30x30mm square section, 2mm wall, 600mm length. Available on request.',
   'Section: 30x30mm. Wall: 2mm. Length: 600mm. Pack qty: 25. Note: Available on request.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['palisade spike', 'ar steel', '600mm', 'security', 'fence'], true),

  ('30000001-0000-0000-0000-000000000124', 'ARP004',
   'AR Palisade Spike 30x30x2mm (1.8m)',
   'AR Steel palisade spike for palisade fence security. 30x30mm square section, 2mm wall, 1.8m length. Available on request.',
   'Section: 30x30mm. Wall: 2mm. Length: 1.8m. Pack qty: 25. Note: Available on request.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['palisade spike', 'ar steel', '1.8m', 'security', 'fence'], true),

  ('30000001-0000-0000-0000-000000000125', 'ARP005',
   'AR Palisade Spike 30x30x2mm (2.0m)',
   'AR Steel palisade spike for palisade fence security. 30x30mm square section, 2mm wall, 2.0m length. Available on request.',
   'Section: 30x30mm. Wall: 2mm. Length: 2.0m. Pack qty: 25. Note: Available on request.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['palisade spike', 'ar steel', '2m', 'security', 'fence'], true),

  ('30000001-0000-0000-0000-000000000126', 'ARP006',
   'AR Palisade Spike 30x30x2mm (2.4m)',
   'AR Steel palisade spike for palisade fence security. 30x30mm square section, 2mm wall, 2.4m length. Available on request.',
   'Section: 30x30mm. Wall: 2mm. Length: 2.4m. Pack qty: 25. Note: Available on request.',
   0.00, '20000001-0000-0000-0000-000000000015', false, 0, NULL,
   ARRAY['palisade spike', 'ar steel', '2.4m', 'security', 'fence'], true),

-- ── GATE WHEELS & GUIDES (cat 16) ────────────────────────────────────────

  ('30000001-0000-0000-0000-000000000127', 'TG001',
   'Guide PVC',
   'PVC sliding gate guide for keeping gate aligned on the bottom guide track.',
   'Material: PVC. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate guide', 'pvc', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000128', 'TG002',
   'Guide Nylon Wheel 37mm',
   'Nylon wheel guide for sliding gate bottom guide track. 37mm wheel diameter.',
   'Wheel diameter: 37mm. Material: Nylon. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate guide', 'nylon wheel', '37mm', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000129', 'TG003',
   'Guide Nylon Wheel 53mm',
   'Nylon wheel guide for sliding gate bottom guide track. 53mm wheel diameter.',
   'Wheel diameter: 53mm. Material: Nylon. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate guide', 'nylon wheel', '53mm', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000130', 'TG004',
   'Galv. Nylon Guide Track 37mm (2.4m)',
   'Galvanised steel nylon guide track for sliding gate installations. 37mm channel, 2.4m length. Sold individually.',
   'Channel: 37mm. Length: 2.4m. Material: Galvanised steel with nylon guide. Sold: Each.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['guide track', 'galvanised', 'nylon', '37mm', '2.4m', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000131', 'TG005',
   'Galv. Nylon Guide Track 53mm (2.4m)',
   'Galvanised steel nylon guide track for sliding gate installations. 53mm channel, 2.4m length. Sold individually.',
   'Channel: 53mm. Length: 2.4m. Material: Galvanised steel with nylon guide. Sold: Each.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['guide track', 'galvanised', 'nylon', '53mm', '2.4m', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000132', 'WHL003',
   'Gate Wheel in Casing 80mm (V-Groove)',
   'Gate wheel in steel casing for sliding gates. 80mm V-groove wheel. Also available in U-groove.',
   'Wheel diameter: 80mm. Groove: V-groove. Includes casing. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'casing', '80mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000133', 'WHL004',
   'Gate Wheel in Casing 100mm (V-Groove)',
   'Gate wheel in steel casing for sliding gates. 100mm V-groove wheel. Also available in U-groove.',
   'Wheel diameter: 100mm. Groove: V-groove. Includes casing. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'casing', '100mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000134', 'WHL005',
   'Gate Wheel in Casing 125mm (V-Groove)',
   'Gate wheel in steel casing for sliding gates. 125mm V-groove wheel. Also available in U-groove.',
   'Wheel diameter: 125mm. Groove: V-groove. Includes casing. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'casing', '125mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000135', 'WHL006',
   'Gate Wheel in Casing 150mm (V-Groove)',
   'Gate wheel in steel casing for sliding gates. 150mm V-groove wheel. Also available in U-groove.',
   'Wheel diameter: 150mm. Groove: V-groove. Includes casing. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'casing', '150mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000136', 'WHL007',
   'Gate Wheel in Casing 180mm (V-Groove)',
   'Gate wheel in steel casing for heavy-duty sliding gates. 180mm V-groove wheel. Also available in U-groove.',
   'Wheel diameter: 180mm. Groove: V-groove. Includes casing. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'casing', '180mm', 'v-groove', 'heavy duty', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000137', 'WHL008',
   'Gate Wheel Loose 80mm (V-Groove)',
   'Loose gate wheel for custom weld-on casing fabrication. 80mm V-groove wheel.',
   'Wheel diameter: 80mm. Groove: V-groove. Loose (no casing). Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'loose', '80mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000138', 'WHL009',
   'Gate Wheel Loose 100mm (V-Groove)',
   'Loose gate wheel for custom weld-on casing fabrication. 100mm V-groove wheel.',
   'Wheel diameter: 100mm. Groove: V-groove. Loose (no casing). Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'loose', '100mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000139', 'WHL010',
   'Gate Wheel Loose 120mm (V-Groove)',
   'Loose gate wheel for custom weld-on casing fabrication. 120mm V-groove wheel.',
   'Wheel diameter: 120mm. Groove: V-groove. Loose (no casing). Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'loose', '120mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000140', 'WHL011',
   'Gate Wheel Loose 150mm (V-Groove)',
   'Loose gate wheel for custom weld-on casing fabrication. 150mm V-groove wheel.',
   'Wheel diameter: 150mm. Groove: V-groove. Loose (no casing). Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['gate wheel', 'loose', '150mm', 'v-groove', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000141', 'ADJ001',
   'ADJ Bracket',
   'Adjustable steel bracket for sliding gate wheel height adjustment. Dimensions: 190mm x 180mm x 75mm.',
   'Dimensions: 190(l) x 180(w) x 75(h) mm. Finish: Standard steel. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['adjustable bracket', 'adj bracket', 'gate wheel', 'sliding gate'], true),

  ('30000001-0000-0000-0000-000000000142', 'ADJ002',
   'Electro-Galv. ADJ Bracket',
   'Electro-galvanised adjustable steel bracket for sliding gate wheel height adjustment. Improved corrosion resistance.',
   'Dimensions: 190(l) x 180(w) x 75(h) mm. Finish: Electro-galvanised. Pack qty: 10.',
   0.00, '20000001-0000-0000-0000-000000000016', false, 0, NULL,
   ARRAY['adjustable bracket', 'adj bracket', 'electro galvanised', 'gate wheel', 'sliding gate'], true)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 4: QA Test Buyer Profiles
-- ============================================================
-- Two buyer accounts retained for QA testing.
-- Use account numbers TEST-EFT-001 / TEST-30D-002 on the buyer login page.

INSERT INTO public.profiles (
  id, auth_user_id, account_number, role,
  business_name, trading_name, vat_number,
  contact_name, contact_title, email, phone, mobile,
  credit_limit, payment_terms_days, notes,
  is_active
)
VALUES
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
    'QA test account — EFT payment flow. Login: TEST-EFT-001.',
    true
  ),
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
    'QA test account — 30-day bypass flow. Login: TEST-30D-002.',
    true
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 5: QA Test Addresses
-- ============================================================

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


COMMIT;

-- ============================================================
-- SEED COMPLETE
-- ============================================================
-- Summary:
--   tenant_config   (1 row updated)   → AR Steel Manufacturing (Pty) Ltd
--   categories      (16 rows)         → Hardware + Gate Accessories sections
--   products        (142 rows)        → All SKUs from the AR Steel catalogue
--   profiles        (2 rows)          → TEST-EFT-001, TEST-30D-002 (QA only)
--   addresses       (2 rows)          → One default shipping address per QA buyer
--
-- Buyer logins (on /login page):
--   Account Number: TEST-EFT-001   → EFT checkout flow
--   Account Number: TEST-30D-002   → 30-Day bypass flow
--
-- Next steps:
--   1. Drop logo image into /public/logo.png
--   2. Set product prices via the admin panel
-- ============================================================

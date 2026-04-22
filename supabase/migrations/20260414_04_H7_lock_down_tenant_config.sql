-- [H7] HIGH: Restrict direct buyer access to tenant_config
--
-- Finding: RLS policy "all_read_tenant_config" allowed any authenticated
-- buyer to SELECT the full tenant_config row, leaking internal fields
-- including email_from_address, dispatch_email, report_emails, and
-- bank account details intended for admin/system use.
--
-- Fix: Drop the buyer-readable policy. All application code that reads
-- tenant_config on buyer-facing pages already uses the service-role
-- admin client (src/app/(portal)/checkout/payment/page.tsx,
-- src/app/(portal)/checkout/confirmed/page.tsx,
-- src/app/api/invoice/[orderId]/route.ts, src/app/actions/checkout.ts),
-- so this is non-breaking at the app layer.
--
-- Admins retain access via is_admin() and the existing UPDATE policy.

DROP POLICY IF EXISTS "all_read_tenant_config" ON public.tenant_config;

-- Admins can read tenant_config via this explicit policy.
CREATE POLICY "admins_read_tenant_config"
  ON public.tenant_config FOR SELECT TO authenticated
  USING (public.is_admin());

-- Defense-in-depth: revoke direct SELECT grants to buyers/anon.
-- Service-role (admin client) bypasses RLS and grants entirely.
REVOKE SELECT ON public.tenant_config FROM authenticated;
REVOKE SELECT ON public.tenant_config FROM anon;

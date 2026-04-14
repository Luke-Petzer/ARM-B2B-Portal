-- [L11] LOW: Extend audit triggers to payments, order_items,
--            tenant_config, addresses, buyer_sessions
--
-- Finding: log_table_audit was only attached to profiles, products,
-- and orders. Sensitive mutations to payments (admin verification),
-- order_items (line-item edits), tenant_config (bank detail changes),
-- addresses (buyer shipping edits), and buyer_sessions (session
-- management) were not captured in the audit log.
--
-- Fix: Attach the existing log_table_audit() trigger to these tables.

CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_tenant_config
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_config
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_addresses
  AFTER INSERT OR UPDATE OR DELETE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_buyer_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.buyer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

/*
# U. Trade Security Hardening
1. Revoke EXECUTE on SECURITY DEFINER functions from anon role — only authenticated should call them.
   - handle_new_user: only called by the auth trigger, not via API
   - increment_seller_sales: only called by the escrow edge function
   - recompute_seller_reputation: only called by trigger
   - sanitize_message_content: only called by trigger
   - protect_profile_fields: only called by trigger
2. Set search_path on touch_updated_at (was missing SET search_path).
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_seller_sales(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_seller_sales(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_seller_reputation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_message_content() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon, authenticated;

-- Fix mutable search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

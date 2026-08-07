/*
# U. Trade Security Hardening — Revoke PUBLIC execute
SECURITY DEFINER functions default to executable by PUBLIC (which includes anon).
Must REVOKE EXECUTE FROM PUBLIC to prevent anon API access.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_seller_sales(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_seller_sales(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_seller_reputation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sanitize_message_content() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM PUBLIC;

/*
# U. Trade: Restrict increment_seller_sales to service role only
The escrow edge function uses the service role key (bypasses RLS and grants).
No authenticated user should call this via the REST API.
*/

REVOKE EXECUTE ON FUNCTION public.increment_seller_sales(uuid) FROM authenticated;

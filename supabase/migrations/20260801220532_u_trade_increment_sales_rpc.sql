/*
# U. Trade: increment_seller_sales RPC
Adds a SECURITY DEFINER function to atomically increment a seller's total_sales
counter after a completed order. Called by the escrow edge function.
*/

CREATE OR REPLACE FUNCTION public.increment_seller_sales(seller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_sales = total_sales + 1
  WHERE id = seller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_seller_sales(uuid) TO authenticated;

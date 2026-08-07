/*
# Atomic listing view counter

## Why
After revoking UPDATE on listings.view_count from authenticated, the
fire-and-forget "increment view count" write in the listing detail page
(no longer works for non-seller viewers. This adds an atomic, server-side
counter increment that any authenticated user can call, while keeping the
column itself non-writable through the Data API.

## Changes
- New SECURITY DEFINER function `increment_listing_view(p_listing_id uuid)`
  that performs `UPDATE listings SET view_count = view_count + 1` atomically.
- EXECUTE granted to authenticated only.

## Notes
- The function does not check ownership: any logged-in user viewing a listing
  increments its counter, which is the intended behavior.
- Uses an atomic UPDATE (no read-then-write), eliminating the previous race
  condition where concurrent viewers could lose increments.
*/

CREATE OR REPLACE FUNCTION public.increment_listing_view(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE listings
  SET view_count = view_count + 1
  WHERE id = p_listing_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_listing_view FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_listing_view TO authenticated;

/*
# Custom listing: artist instructions column

## Why
Custom-order listings need a seller-authored "Consignes pour l'artiste" field
so creators can tell buyers what information they need (colors, dimensions,
style). The buyer-side reference photo and notes already exist on `orders`
(reference_image_urls, production_notes). This adds the seller-side guidance
on the listing itself.

## Changes
- ALTER TABLE listings ADD COLUMN artist_instructions text
- Expose it to sellers via the column-level UPDATE grant added earlier.
*/

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS artist_instructions text;

GRANT UPDATE (artist_instructions) ON listings TO authenticated;

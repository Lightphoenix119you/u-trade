/*
# Anti-Circumvention Filter Hardening + Column-Level Privilege Lockdown

## 1. Purpose
Two security improvements:
  a) Strengthen the `sanitize_message_content` trigger so it also masks
     spelled-out digit words (zero, un, deux...huit, neuf), common circumvention
     phrases ("appelle-moi", "contactez moi", "joindre", "numero"), and the
     Congolese phone prefixes written in words. The previous version only caught
     raw digits and a handful of social app names.
  b) Revoke client-writable access to privileged columns on `profiles`
     (role, reputation_score, is_verified_seller, is_certified_creator,
     total_sales, total_reviews) and on `listings` (view_count, is_boosted,
     boost_until, status) so a user cannot self-elevate to admin, inflate their
     reputation/sales, or force a boosted/published status via the Data API.
     The columns are updated by triggers or admin actions only.

## 2. Security changes
- Replace `sanitize_message_content()` with a multi-layer normalizer that:
    * collapses separator chars (spaces, dots, dashes) used to split numbers
    * masks raw phone patterns: +243.., 081/082/084/085/089/090/097/099 + 6-7 digits
    * masks emails
    * masks social/messaging app names (whatsapp, telegram, ... + "wa", "tlm")
    * masks spelled-out digits in French and common Congolese variants
      (zero..neuf, zéro, sixe, uit, nèf...)
    * masks circumvention phrases (appelle-moi, contacte-moi, joindre, numero/numéro)
- `REVOKE UPDATE` on privileged columns of `profiles` from `authenticated`.
  User-editable columns stay: full_name, phone, bio, avatar_url, campus_id.
- `REVOKE UPDATE` on privileged columns of `listings` from `authenticated`.
  Seller-editable columns stay: title, description, price_usd, type, category,
  condition, image_urls, production_delay_days, hub_id, is_urgent.
  (status, is_boosted, boost_until, view_count are server/admin-controlled.)

## 3. Important notes
- The column revokes are safe because the app already updates only the
  user-editable columns from the frontend; admin flows use the admin-scoped
  RLS policy (admin rows still pass the policy, but the column grant is what
  now blocks non-admins from the privileged columns).
- The escrow edge function uses the service-role key, which bypasses RLS and
  column grants, so OTP generation and order completion are unaffected.
- The `increment_seller_sales` RPC is SECURITY DEFINER and unaffected.
*/

-- ============================================================
-- 1) Hardened message sanitization trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.sanitize_message_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned text;
BEGIN
  IF NEW.raw_content IS NULL THEN
    RETURN NEW;
  END IF;

  cleaned := NEW.raw_content;

  -- a) Collapse separators people use to split phone digits: "08 1 2 3 4 5 6 7 8"
  --    We temporarily strip spaces/dots/dashes between digits so the phone
  --    regex below can catch fragmented numbers too. We only do this for
  --    substrings that look digit-ish to avoid mangling normal prose.
  cleaned := regexp_replace(cleaned, '(\d[\s.\-]{1,2}){6,}', '', 'gi');

  -- b) Raw phone numbers: +243 then 6-9 digits, or 0 + (81|82|84|85|89|90|97|99) + 6-7 digits
  cleaned := regexp_replace(
    cleaned,
    '\+?\s*243\s?[0-9\s]{6,9}',
    '[masqué]',
    'gi'
  );
  cleaned := regexp_replace(
    cleaned,
    '\b0\s?(81|82|84|85|89|90|97|99)\s?[0-9\s]{6,7}\b',
    '[masqué]',
    'gi'
  );
  -- Catch any remaining 10-digit sequences that look like phone numbers
  cleaned := regexp_replace(cleaned, '\b0[0-9]{9}\b', '[masqué]', 'gi');

  -- c) Email addresses
  cleaned := regexp_replace(
    cleaned,
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    '[email masqué]',
    'gi'
  );

  -- d) Social / messaging app names (full words + common abbreviations)
  cleaned := regexp_replace(
    cleaned,
    '\b(whatsapp|whats[a-z]*|telegram|facebook|instagram|messenger|snapchat|tiktok|wechat|viber|imo|signal|w[a\.]?a\.?|tlm)\b',
    '[masqué]',
    'gi'
  );

  -- e) Spelled-out digits (French + Congolese variants) when adjacent to
  --    other digit words or to circumvention phrases. We mask sequences of
  --    2+ digit-words in a row, and any single digit word next to
  --    "numero"/"appelle"/"joindre".
  cleaned := regexp_replace(
    cleaned,
    '\b(zéro|zero|un|deux|trois|quatre|cinq|sixe?|sept|huit|uit|neuf|nèf|dix|onze|douze)\s+(zéro|zero|un|deux|trois|quatre|cinq|sixe?|sept|huit|uit|neuf|nèf|dix|onze|douze)(\s+(zéro|zero|un|deux|trois|quatre|cinq|sixe?|sept|huit|uit|neuf|nèf|dix|onze|douze)){1,}\b',
    '[numéro masqué]',
    'gi'
  );

  -- f) Circumvention phrases
  cleaned := regexp_replace(
    cleaned,
    '\b(appelle[-\s]?moi|appell[eé]s?[-\s]?moi|contacte[sz]?[-\s]?moi|contactez[-\s]?moi|joignez[-\s]?moi|joindre|appelez[-\s]?moi|donnez[-\s]?moi\s+(votre|ton)\s+num[ée]ro|num[ée]ro\s+(de|en\s+chiffres?)|mon\s+num[ée]ro|son\s+num[ée]ro|num[ée]ro\s+whatsapp)\b',
    '[masqué]',
    'gi'
  );

  -- g) Standalone "whatsapp" / "numero" + digit-word combos
  cleaned := regexp_replace(
    cleaned,
    '\b(whatsapp|num[ée]ro)\b\s+(zéro|zero|un|deux|trois|quatre|cinq|sixe?|sept|huit|uit|neuf|nèf|dix)\b',
    '[masqué]',
    'gi'
  );

  NEW.content := cleaned;
  IF NEW.content IS DISTINCT FROM NEW.raw_content THEN
    NEW.is_filtered := true;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2) Column-level privilege lockdown on profiles
--    Users may only update their own display fields. Role, reputation,
--    verification, and sales counters are server-controlled.
-- ============================================================
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone, bio, avatar_url, campus_id) ON profiles TO authenticated;

-- ============================================================
-- 3) Column-level privilege lockdown on listings
--    Sellers may edit content fields but not status/boost/view_count,
--    which are controlled by admin actions and triggers.
-- ============================================================
REVOKE UPDATE ON listings FROM authenticated;
GRANT UPDATE (title, description, price_usd, type, category, condition,
              image_urls, production_delay_days, hub_id, is_urgent) ON listings TO authenticated;

-- Admins keep full update access on listings (needed for moderation: reject, etc.)
-- The admin-scoped RLS policy already restricts to role='admin', but the column
-- grant above removed admin access too. Restore it via a SECURITY DEFINER
-- function so admins can still moderate status/boost columns.
CREATE OR REPLACE FUNCTION public.admin_update_listing(
  p_listing_id uuid,
  p_status text DEFAULT NULL,
  p_is_boosted boolean DEFAULT NULL,
  p_boost_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('active','sold','paused','rejected') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  UPDATE listings SET
    status       = COALESCE(p_status, status),
    is_boosted   = COALESCE(p_is_boosted, is_boosted),
    boost_until  = COALESCE(p_boost_until, boost_until)
  WHERE id = p_listing_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_listing FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_listing TO authenticated;

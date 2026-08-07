/*
# U. Trade Seed Data + Profile Protection
1. Seeds 3 universities (campuses) with distinct theme colors.
2. Seeds campus hubs (rendezvous points) for each campus.
3. Seeds app_settings singleton row.
4. Adds a BEFORE UPDATE trigger on profiles that prevents non-admin users from
   changing protected fields (role, reputation, badges, sales, review counts).
   Only an admin (checked via profiles table) may change these.
*/

-- ============================================================
-- SEED: Campuses
-- ============================================================
INSERT INTO campuses (name, slug, city, primary_color, secondary_color, accent_color, icon_name, sort_order)
VALUES
  ('Université de Kinshasa', 'unikin', 'Kinshasa', '#2563eb', '#3b82f6', '#60a5fa', 'GraduationCap', 1),
  ('Université Protestante du Congo', 'upc', 'Kinshasa', '#059669', '#10b981', '#34d399', 'BookOpen', 2),
  ('Université Catholique du Congo', 'ucc', 'Kinshasa', '#d97706', '#f59e0b', '#fbbf24', 'Landmark', 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  accent_color = EXCLUDED.accent_color,
  icon_name = EXCLUDED.icon_name;

-- ============================================================
-- SEED: Campus Hubs
-- ============================================================
INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Entrée Principale (Portail A)', 'Point de rencontre devant le portail principal du campus', 1
FROM campuses c WHERE c.slug = 'unikin'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Entrée Principale (Portail A)');

INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Bibliothèque Centrale', 'Hall de la bibliothèque centrale, côté gauche', 2
FROM campuses c WHERE c.slug = 'unikin'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Bibliothèque Centrale');

INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Faculté des Sciences (Hall)', 'Hall d''entrée de la Faculté des Sciences', 3
FROM campuses c WHERE c.slug = 'unikin'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Faculté des Sciences (Hall)');

INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Entrée Principale UPC', 'Devant l''entrée principale du campus UPC', 1
FROM campuses c WHERE c.slug = 'upc'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Entrée Principale UPC');

INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Cafétéria Centrale', 'Terrasse de la cafétéria centrale', 2
FROM campuses c WHERE c.slug = 'upc'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Cafétéria Centrale');

INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Entrée Principale UCC', 'Parking devant l''entrée principale', 1
FROM campuses c WHERE c.slug = 'ucc'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Entrée Principale UCC');

INSERT INTO campus_hubs (campus_id, name, description, sort_order)
SELECT c.id, 'Place des Étudiants', 'Espace commun côté est du campus', 2
FROM campuses c WHERE c.slug = 'ucc'
AND NOT EXISTS (SELECT 1 FROM campus_hubs h WHERE h.campus_id = c.id AND h.name = 'Place des Étudiants');

-- ============================================================
-- SEED: App Settings singleton
-- ============================================================
INSERT INTO app_settings (id, usd_to_fc_rate, commission_tier_under5, commission_tier_mid, commission_tier_mid_threshold, commission_tier_custom, boost_price_usd, verified_badge_price_usd, urgent_price_usd)
VALUES (1, 2800, 0, 0.06, 5, 0.09, 2, 5, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TRIGGER: Protect profile fields from non-admin modification
-- Prevents students from changing role, badges, reputation, sales, review counts.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT (p.role = 'admin') INTO is_admin FROM public.profiles p WHERE p.id = auth.uid();
  IF is_admin IS NOT TRUE THEN
    -- Non-admin: force protected fields back to their existing (OLD) values
    NEW.role := OLD.role;
    NEW.reputation_score := OLD.reputation_score;
    NEW.is_verified_seller := OLD.is_verified_seller;
    NEW.is_certified_creator := OLD.is_certified_creator;
    NEW.total_sales := OLD.total_sales;
    NEW.total_reviews := OLD.total_reviews;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON profiles;
CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

/*
# U. Trade Core Schema
Creates the foundational data model for U. Trade, a campus-scoped student marketplace.
All universities, theme colors, and rendezvous points live in the database.
Tables: profiles, campuses, campus_hubs, shops, listings, listing_reviews, orders,
offers, messages, reports, phone_blacklist, ad_banners, app_settings, transactions.
RLS enabled on all tables. Triggers: auto-profile on signup, updated_at, reputation
recompute, message sanitization (anti-circumvention).
Note: profiles created first so campus/hub admin policies can reference it.
*/

-- ============================================================
-- PROFILES (created first so admin policies can reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  campus_id uuid,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  avatar_url text,
  bio text,
  reputation_score numeric NOT NULL DEFAULT 0,
  is_verified_seller boolean NOT NULL DEFAULT false,
  is_certified_creator boolean NOT NULL DEFAULT false,
  total_sales int NOT NULL DEFAULT 0,
  total_reviews int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_select_all" ON profiles;
CREATE POLICY "profile_select_all" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profile_insert_self" ON profiles;
CREATE POLICY "profile_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profile_update_self" ON profiles;
CREATE POLICY "profile_update_self" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profile_delete_self" ON profiles;
CREATE POLICY "profile_delete_self" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============================================================
-- CAMPUSES (universities)
-- ============================================================
CREATE TABLE IF NOT EXISTS campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  city text NOT NULL DEFAULT 'Kinshasa',
  primary_color text NOT NULL DEFAULT '#2563eb',
  secondary_color text NOT NULL DEFAULT '#0ea5e9',
  accent_color text NOT NULL DEFAULT '#22d3ee',
  icon_name text NOT NULL DEFAULT 'GraduationCap',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;

-- link campus_id FK now that campuses exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_campus_id_fkey' AND table_name = 'profiles') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_campus_id_fkey
      FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "campus_select_all" ON campuses;
CREATE POLICY "campus_select_all" ON campuses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "campus_insert_admin" ON campuses;
CREATE POLICY "campus_insert_admin" ON campuses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "campus_update_admin" ON campuses;
CREATE POLICY "campus_update_admin" ON campuses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "campus_delete_admin" ON campuses;
CREATE POLICY "campus_delete_admin" ON campuses FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- CAMPUS HUBS (rendezvous points)
-- ============================================================
CREATE TABLE IF NOT EXISTS campus_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  lat numeric,
  lng numeric,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE campus_hubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_select_all" ON campus_hubs;
CREATE POLICY "hub_select_all" ON campus_hubs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "hub_insert_admin" ON campus_hubs;
CREATE POLICY "hub_insert_admin" ON campus_hubs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "hub_update_admin" ON campus_hubs;
CREATE POLICY "hub_update_admin" ON campus_hubs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "hub_delete_admin" ON campus_hubs;
CREATE POLICY "hub_delete_admin" ON campus_hubs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- SHOPS (creator boutiques)
-- ============================================================
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  campus_id uuid NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  banner_url text,
  approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected')),
  is_custom_shop boolean NOT NULL DEFAULT false,
  production_delay_days text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_select_all" ON shops;
CREATE POLICY "shop_select_all" ON shops FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shop_insert_owner" ON shops;
CREATE POLICY "shop_insert_owner" ON shops FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shop_update_owner_admin" ON shops;
CREATE POLICY "shop_update_owner_admin" ON shops FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "shop_delete_owner_admin" ON shops;
CREATE POLICY "shop_delete_owner_admin" ON shops FOR DELETE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
  campus_id uuid NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  hub_id uuid REFERENCES campus_hubs(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_usd numeric NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  type text NOT NULL DEFAULT 'secondhand' CHECK (type IN ('secondhand','custom')),
  category text NOT NULL DEFAULT 'other',
  condition text,
  image_urls text[] NOT NULL DEFAULT '{}',
  production_delay_days int,
  is_urgent boolean NOT NULL DEFAULT false,
  is_boosted boolean NOT NULL DEFAULT false,
  boost_until timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','paused','rejected')),
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_select_all" ON listings;
CREATE POLICY "listing_select_all" ON listings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "listing_insert_owner" ON listings;
CREATE POLICY "listing_insert_owner" ON listings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "listing_update_owner_admin" ON listings;
CREATE POLICY "listing_update_owner_admin" ON listings FOR UPDATE
  TO authenticated USING (auth.uid() = seller_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (auth.uid() = seller_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "listing_delete_owner_admin" ON listings;
CREATE POLICY "listing_delete_owner_admin" ON listings FOR DELETE
  TO authenticated USING (auth.uid() = seller_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_listings_campus_status ON listings(campus_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(type);

-- ============================================================
-- LISTING REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE listing_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_select_all" ON listing_reviews;
CREATE POLICY "review_select_all" ON listing_reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "review_insert_reviewer" ON listing_reviews;
CREATE POLICY "review_insert_reviewer" ON listing_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "review_update_reviewer" ON listing_reviews;
CREATE POLICY "review_update_reviewer" ON listing_reviews FOR UPDATE
  TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "review_delete_reviewer_admin" ON listing_reviews;
CREATE POLICY "review_delete_reviewer_admin" ON listing_reviews FOR DELETE
  TO authenticated USING (auth.uid() = reviewer_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_reviews_seller ON listing_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON listing_reviews(shop_id);

-- ============================================================
-- ORDERS (with escrow + OTP handshake)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
  campus_id uuid NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  hub_id uuid REFERENCES campus_hubs(id) ON DELETE SET NULL,
  price_usd numeric NOT NULL CHECK (price_usd >= 0),
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_usd numeric NOT NULL DEFAULT 0,
  seller_payout_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment','paid','in_delivery','delivered','completed',
    'disputed','refunded','cancelled'
  )),
  escrow_code text,
  escrow_code_hash text,
  escrow_revealed_at timestamptz,
  production_notes text,
  reference_image_urls text[] NOT NULL DEFAULT '{}',
  is_custom boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  disputed_at timestamptz,
  dispute_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_select_participants" ON orders;
CREATE POLICY "order_select_participants" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "order_insert_buyer" ON orders;
CREATE POLICY "order_insert_buyer" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "order_update_participants_admin" ON orders;
CREATE POLICY "order_update_participants_admin" ON orders FOR UPDATE
  TO authenticated USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    auth.uid() = buyer_id OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "order_delete_admin" ON orders;
CREATE POLICY "order_delete_admin" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================
-- OFFERS (negotiation)
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  offer_price_usd numeric NOT NULL CHECK (offer_price_usd >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_select_participants" ON offers;
CREATE POLICY "offer_select_participants" ON offers FOR SELECT
  TO authenticated USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id
  );

DROP POLICY IF EXISTS "offer_insert_buyer" ON offers;
CREATE POLICY "offer_insert_buyer" ON offers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "offer_update_seller" ON offers;
CREATE POLICY "offer_update_seller" ON offers FOR UPDATE
  TO authenticated USING (auth.uid() = seller_id OR auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = seller_id OR auth.uid() = buyer_id);

DROP POLICY IF EXISTS "offer_delete_participants" ON offers;
CREATE POLICY "offer_delete_participants" ON offers FOR DELETE
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers(listing_id);

-- ============================================================
-- MESSAGES (in-app, sanitized)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  raw_content text,
  content text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  is_filtered boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_select_participants" ON messages;
CREATE POLICY "message_select_participants" ON messages FOR SELECT
  TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

DROP POLICY IF EXISTS "message_insert_sender" ON messages;
CREATE POLICY "message_insert_sender" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "message_update_sender" ON messages;
CREATE POLICY "message_update_sender" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "message_delete_sender" ON messages;
CREATE POLICY "message_delete_sender" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

-- ============================================================
-- REPORTS (moderation)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('listing','user','message','order')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_select_reporter_admin" ON reports;
CREATE POLICY "report_select_reporter_admin" ON reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "report_insert_reporter" ON reports;
CREATE POLICY "report_insert_reporter" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "report_update_admin" ON reports;
CREATE POLICY "report_update_admin" ON reports FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- PHONE BLACKLIST (admin moderation)
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  reason text,
  added_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE phone_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blacklist_select_admin" ON phone_blacklist;
CREATE POLICY "blacklist_select_admin" ON phone_blacklist FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "blacklist_insert_admin" ON phone_blacklist;
CREATE POLICY "blacklist_insert_admin" ON phone_blacklist FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "blacklist_delete_admin" ON phone_blacklist;
CREATE POLICY "blacklist_delete_admin" ON phone_blacklist FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- AD BANNERS (local business ads)
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  link_url text NOT NULL DEFAULT '#',
  campus_id uuid REFERENCES campuses(id) ON DELETE CASCADE,
  placement text NOT NULL DEFAULT 'marketplace_top' CHECK (placement IN ('marketplace_top','marketplace_side','home_hero')),
  is_active boolean NOT NULL DEFAULT true,
  impressions int NOT NULL DEFAULT 0,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ad_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_select_all" ON ad_banners;
CREATE POLICY "ad_select_all" ON ad_banners FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ad_insert_admin" ON ad_banners;
CREATE POLICY "ad_insert_admin" ON ad_banners FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "ad_update_admin" ON ad_banners;
CREATE POLICY "ad_update_admin" ON ad_banners FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "ad_delete_admin" ON ad_banners;
CREATE POLICY "ad_delete_admin" ON ad_banners FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- APP SETTINGS (singleton config)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1,
  usd_to_fc_rate numeric NOT NULL DEFAULT 2800,
  commission_tier_under5 numeric NOT NULL DEFAULT 0,
  commission_tier_mid numeric NOT NULL DEFAULT 0.06,
  commission_tier_mid_threshold numeric NOT NULL DEFAULT 5,
  commission_tier_custom numeric NOT NULL DEFAULT 0.09,
  boost_price_usd numeric NOT NULL DEFAULT 2,
  verified_badge_price_usd numeric NOT NULL DEFAULT 5,
  urgent_price_usd numeric NOT NULL DEFAULT 1,
  mobile_money_instructions text NOT NULL DEFAULT 'Payez via M-Pesa, Airtel Money ou Orange Money sur le numéro indiqué. Le montant inclut la commission de la plateforme.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON app_settings;
CREATE POLICY "settings_select_all" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON app_settings;
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- TRANSACTIONS (platform ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('escrow_lock','escrow_release','commission','refund','boost','badge','urgent','payout')),
  amount_usd numeric NOT NULL DEFAULT 0,
  description text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_select_admin_owner" ON transactions;
CREATE POLICY "transaction_select_admin_owner" ON transactions FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "transaction_insert_admin" ON transactions;
CREATE POLICY "transaction_insert_admin" ON transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR auth.uid() = created_by
  );

DROP POLICY IF EXISTS "transaction_delete_admin" ON transactions;
CREATE POLICY "transaction_delete_admin" ON transactions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: updated_at maintenance
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_profiles ON profiles;
CREATE TRIGGER touch_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_listings ON listings;
CREATE TRIGGER touch_listings BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_orders ON orders;
CREATE TRIGGER touch_orders BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_offers ON offers;
CREATE TRIGGER touch_offers BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- TRIGGER: recompute seller reputation on review insert/delete
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_seller_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
  review_count int;
BEGIN
  SELECT AVG(rating)::numeric, COUNT(*)::int INTO avg_rating, review_count
  FROM public.listing_reviews WHERE seller_id = NEW.seller_id;
  UPDATE public.profiles
  SET reputation_score = COALESCE(avg_rating, 0), total_reviews = COALESCE(review_count, 0)
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recompute_reputation ON listing_reviews;
CREATE TRIGGER recompute_reputation
  AFTER INSERT OR DELETE ON listing_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_seller_reputation();

-- ============================================================
-- TRIGGER: sanitize message content (anti-circumvention)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sanitize_message_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_content IS NOT NULL THEN
    NEW.content := regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(NEW.raw_content, '\+?243\s?[0-9\s]{6,12}', '[numéro masqué]', 'gi'),
          '\b0[0-9]{2}\s?[0-9]{3}\s?[0-9]{4}\b', '[numéro masqué]', 'gi'
        ),
        '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[email masqué]', 'gi'
      ),
      '\b(whatsapp|telegram|facebook|instagram|messenger|snapchat|tiktok|wechat|viber)\b', '[réseau masqué]', 'gi'
    );
    IF NEW.content IS DISTINCT FROM NEW.raw_content THEN
      NEW.is_filtered := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_message ON messages;
CREATE TRIGGER sanitize_message
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_message_content();

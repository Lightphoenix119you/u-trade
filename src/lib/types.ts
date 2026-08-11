export type UserRole = 'student' | 'admin';
export type ListingType = 'secondhand' | 'custom';
export type ListingStatus = 'active' | 'sold' | 'paused' | 'rejected';
export type ShopApproval = 'pending' | 'approved' | 'rejected';
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'in_delivery'
  | 'delivered'
  | 'dispute_pending'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportTarget = 'listing' | 'user' | 'message' | 'order';
export type TransactionType =
  | 'escrow_lock'
  | 'escrow_release'
  | 'commission'
  | 'refund'
  | 'boost'
  | 'badge'
  | 'urgent'
  | 'payout';

export interface Campus {
  id: string;
  name: string;
  slug: string;
  city: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  icon_name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CampusRequest {
  id: string;
  requested_by: string;
  university_name: string;
  city: string;
  contact_info: string;
  suggested_meeting_points: { name: string; description?: string }[];
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  requester?: Profile;
}

export interface CampusHub {
  id: string;
  campus_id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  campus_id: string | null;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  reputation_score: number;
  is_verified_seller: boolean;
  is_certified_creator: boolean;
  total_sales: number;
  total_reviews: number;
  referral_code: string | null;
  referred_by: string | null;
  referral_benefits_until: string | null;
  referral_count: number;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  campus_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  approval_status: ShopApproval;
  is_custom_shop: boolean;
  production_delay_days: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  shop_id: string | null;
  campus_id: string;
  hub_id: string | null;
  title: string;
  description: string;
  price_usd: number;
  type: ListingType;
  category: string;
  condition: string | null;
  image_urls: string[];
  production_delay_days: number | null;
  artist_instructions: string | null;
  is_urgent: boolean;
  is_boosted: boolean;
  boost_until: string | null;
  daily_budget_usd: number | null;
  boost_duration_days: number | null;
  total_boost_budget_usd: number | null;
  status: ListingStatus;
  view_count: number;
  show_view_count: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingWithRelations extends Listing {
  seller?: Profile;
  shop?: Shop | null;
  campus?: Campus;
  hub?: CampusHub | null;
}

export interface ListingReview {
  id: string;
  listing_id: string;
  shop_id: string | null;
  reviewer_id: string;
  seller_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'order' | 'dispute' | 'system';
  read: boolean;
  link_url: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  shop_id: string | null;
  campus_id: string;
  hub_id: string | null;
  price_usd: number;
  commission_rate: number;
  commission_usd: number;
  seller_payout_usd: number;
  status: OrderStatus;
  escrow_code: string | null;
  escrow_revealed_at: string | null;
  production_notes: string | null;
  reference_image_urls: string[];
  is_custom: boolean;
  paid_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  disputed_at: string | null;
  dispute_requested_at: string | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
  listing?: Listing;
  buyer?: Profile;
  seller?: Profile;
  hub?: CampusHub;
}

export interface Offer {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  offer_price_usd: number;
  status: OfferStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
  buyer?: Profile;
  listing?: Listing;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  listing_id: string | null;
  order_id: string | null;
  raw_content: string | null;
  content: string;
  is_system: boolean;
  is_filtered: boolean;
  created_at: string;
  sender?: Profile;
}

export type AdminPermission = 'manage_products' | 'manage_reviews' | 'handle_disputes' | 'manage_users' | 'view_financials';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: 'user' | 'campus_admin' | 'super_admin';
  is_suspended: boolean;
}

export interface AdminMember {
  id: string;
  user_id: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: AdminPermission[];
  created_at: string;
  created_by: string | null;
  profile?: Profile;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reporter?: Profile;
}

export interface PhoneBlacklist {
  id: string;
  phone: string;
  reason: string | null;
  added_by: string | null;
  created_at: string;
}

export interface AdBanner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  campus_id: string | null;
  placement: string;
  is_active: boolean;
  impressions: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number;
  usd_to_fc_rate: number;
  commission_tier_under5: number;
  commission_tier_mid: number;
  commission_tier_mid_threshold: number;
  commission_tier_custom: number;
  guest_fee_extra_percent: number;
  referral_campaign_active: boolean;
  referral_benefit_days: number;
  referral_discount_percent: number;
  boost_price_usd: number;
  verified_badge_price_usd: number;
  urgent_price_usd: number;
  mobile_money_instructions: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  order_id: string | null;
  user_id: string | null;
  type: TransactionType;
  amount_usd: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export const CATEGORIES = [
  { value: 'electronics', label: 'Électronique' },
  { value: 'books', label: 'Livres & Manuels' },
  { value: 'fashion', label: 'Mode & Vêtements' },
  { value: 'art', label: 'Art & Création' },
  { value: 'furniture', label: 'Mobilier' },
  { value: 'services', label: 'Services' },
  { value: 'food', label: 'Nourriture' },
  { value: 'other', label: 'Autres' },
] as const;

export const CONDITIONS = [
  { value: 'new', label: 'Neuf' },
  { value: 'like_new', label: 'Comme neuf' },
  { value: 'good', label: 'Bon état' },
  { value: 'fair', label: 'État correct' },
] as const;

import { z } from 'zod';

// Accepte un préfixe '+' optionnel, puis 7 à 15 chiffres — espaces et
// tirets tolérés entre les chiffres (retirés avant le test). Remplace
// l'ancien format strictement congolais (+243/0 + 8-9 chiffres) : décision
// délibérée d'ouvrir l'inscription à l'international.
export function validatePhone(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s-]/g, '');
  return /^\+?\d{7,15}$/.test(cleaned);
}

export const signUpSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe: 6 caractères minimum'),
  full_name: z.string().min(2, 'Nom requis'),
  phone: z.string().refine(validatePhone, 'Numéro de téléphone invalide (7 à 15 chiffres, + optionnel)'),
  campus_id: z.string().uuid('Campus requis').nullable(),
});

export const signInSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Nom requis').max(60).optional(),
  phone: z.string().refine(validatePhone, 'Numéro de téléphone invalide').optional().or(z.literal('')),
  bio: z.string().max(280).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  campus_id: z.string().uuid().optional().nullable(),
});

export const listingSchema = z.object({
  title: z.string().min(3, 'Titre: 3 caractères minimum').max(80),
  description: z.string().min(10, 'Description: 10 caractères minimum').max(2000),
  price_usd: z.number().min(0, 'Prix invalide').max(100000),
  type: z.enum(['secondhand', 'custom']),
  category: z.string().min(1),
  condition: z.string().optional().nullable(),
  image_urls: z.array(z.string().url()).max(6, '6 images maximum'),
  hub_id: z.string().uuid('Point de rendez-vous requis'),
  production_delay_days: z.number().int().min(1).max(90).optional(),
  artist_instructions: z.string().max(1000).optional(),
  is_urgent: z.boolean().optional(),
});

export const shopSchema = z.object({
  name: z.string().min(2, 'Nom: 2 caractères minimum').max(60),
  description: z.string().max(500).optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  is_custom_shop: z.boolean(),
  production_delay_days: z.string().max(60).optional(),
});

export const offerSchema = z.object({
  offer_price_usd: z.number().min(0.1, 'Offre invalide').max(100000),
  message: z.string().max(280).optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Note minimum: 1').max(5, 'Note maximum: 5'),
  comment: z.string().max(1000).optional().default(''),
});

export const messageSchema = z.object({
  raw_content: z.string().min(1, 'Message vide').max(1000, 'Message trop long'),
});

export const reportSchema = z.object({
  target_type: z.enum(['listing', 'user', 'message', 'order']),
  target_id: z.string().uuid(),
  reason: z.string().min(5, 'Raison: 5 caractères minimum').max(500),
});

export const orderCreateSchema = z.object({
  listing_id: z.string().uuid(),
  hub_id: z.string().uuid('Point de rendez-vous requis'),
  production_notes: z.string().max(2000).optional(),
  reference_image_urls: z.array(z.string().url()).max(5).optional(),
});

export const campusSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug: minuscules, chiffres, tirets'),
  city: z.string().min(2).max(60),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex requise'),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex requise'),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex requise'),
  icon_name: z.string().min(2),
});

export const hubSchema = z.object({
  campus_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
});

export const adBannerSchema = z.object({
  title: z.string().min(2).max(120),
  image_url: z.string().url('URL image requise'),
  link_url: z.string().url('URL lien requise').or(z.literal('#')),
  campus_id: z.string().uuid().optional().nullable(),
  placement: z.enum(['marketplace_top', 'marketplace_side', 'home_hero']),
});

export const settingsSchema = z.object({
  usd_to_fc_rate: z.number().min(1, 'Taux invalide'),
  commission_tier_under5: z.number().min(0).max(1),
  commission_tier_mid: z.number().min(0).max(1),
  commission_tier_mid_threshold: z.number().min(0),
  commission_tier_custom: z.number().min(0).max(1),
  boost_price_usd: z.number().min(0),
  verified_badge_price_usd: z.number().min(0),
  urgent_price_usd: z.number().min(0),
  mobile_money_instructions: z.string().max(1000),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type ShopInput = z.infer<typeof shopSchema>;
export type OfferInput = z.infer<typeof offerSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type CampusInput = z.infer<typeof campusSchema>;
export type HubInput = z.infer<typeof hubSchema>;
export type AdBannerInput = z.infer<typeof adBannerSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export const campusRequestSchema = z.object({
  campusName: z.string().min(2, "Le nom du campus est requis"),
  city: z.string().min(2, "La ville est requise"),
  studentCount: z.string().optional(),
  email: z.string().email("Email invalide"),
  comments: z.string().optional(),
});

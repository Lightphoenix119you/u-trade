import type { Campus, AppSettings } from './types';

// Deterministic UUID for the "no campus / all campuses" state
export const ALL_CAMPUSES_ID = '00000000-0000-0000-0000-000000000000';

export function formatUSD(amount: number): string {
  const value = Number(amount) || 0;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function formatFC(amountUSD: number, rate: number): string {
  const fc = Math.round((Number(amountUSD) || 0) * (rate || 1));
  return `${fc.toLocaleString('fr-FR')} FC`;
}

export function formatDual(amountUSD: number, rate: number): string {
  return `${formatUSD(amountUSD)} · ${formatFC(amountUSD, rate)}`;
}

export function campusThemeVars(campus: Campus | null | undefined): Record<string, string> {
  if (!campus) {
    return {
      '--campus-primary': '#3b82f6',
      '--campus-secondary': '#0ea5e9',
      '--campus-accent': '#38bdf8',
    };
  }
  return {
    '--campus-primary': campus.primary_color,
    '--campus-secondary': campus.secondary_color,
    '--campus-accent': campus.accent_color,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function computeCommission(
  priceUSD: number,
  isCustom: boolean,
  settings: AppSettings | null,
): { rate: number; commission: number; payout: number } {
  const s = settings;
  if (!s) return { rate: 0, commission: 0, payout: priceUSD };

  let rate = s.commission_tier_under5;
  if (isCustom) {
    rate = s.commission_tier_custom;
  } else if (priceUSD >= s.commission_tier_mid_threshold) {
    rate = s.commission_tier_mid;
  }
  const commission = Math.round(priceUSD * rate * 100) / 100;
  const payout = Math.round((priceUSD - commission) * 100) / 100;
  return { rate, commission, payout };
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'à l\'instant';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an(s)`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

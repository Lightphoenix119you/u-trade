/**
 * Anti-circumvention filter for U. Trade.
 *
 * Detects and blocks content that tries to move a transaction off-platform:
 * Congolese phone numbers (081/082/084/085/089/090/097/099 and +243),
 * email addresses, social/messaging app names, spelled-out digit words
 * (zero, huit...), and circumvention phrases like "appelle-moi".
 *
 * Used both for real-time validation (returns a reason) and for masking
 * (returns sanitized text), mirroring the database trigger.
 */

const PHONE_RAW_REGEX =
  /(\+?\s*243\s?[0-9\s]{6,9})|\b0\s?(81|82|84|85|89|90|97|99)\s?[0-9\s]{6,7}\b|\b0[0-9]{9}\b/i;

// Filet plus large en complément du précédent (formats internationaux/locaux
// génériques, avec ou sans séparateurs) — capture ce que le motif RDC-only
// ci-dessus laisserait passer.
const PHONE_GENERIC_REGEX =
  /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:0|\d{1,4})[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

const SOCIAL_REGEX =
  /\b(whatsapp|whats[a-z]*|telegram|facebook|instagram|messenger|snapchat|tiktok|wechat|viber|imo|signal|w\.?a\.?|tlm)\b/i;

// Nouveau : liens web et réseaux sociaux (http/https/www, ou domaine nu type
// tiktok.com, wa.me, t.me...) — le SOCIAL_REGEX ci-dessus ne détectait que
// les NOMS d'applications en toutes lettres, jamais un lien direct.
const LINK_REGEX =
  /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|me|co|app|io)[^\s]*)/gi;

const DIGIT_WORDS = [
  'zéro', 'zero', 'un', 'deux', 'trois', 'quatre', 'cinq',
  'six', 'sixe', 'sept', 'huit', 'uit', 'neuf', 'nèf', 'dix', 'onze', 'douze',
];
const DIGIT_WORD_SEQ_REGEX = new RegExp(
  `\\b((${DIGIT_WORDS.join('|')})\\s+){2,}(${DIGIT_WORDS.join('|')})\\b`,
  'gi',
);

const PHRASE_REGEX =
  /\b(appelle[-\s]?moi|appell[eé]s?[-\s]?moi|contacte[sz]?[-\s]?moi|contactez[-\s]?moi|joignez[-\s]?moi|joindre|appelez[-\s]?moi|donnez[-\s]?moi\s+(votre|ton)\s+num[ée]ro|num[ée]ro\s+(de|en\s+chiffres?)|mon\s+num[ée]ro|son\s+num[ée]ro|num[ée]ro\s+whatsapp)\b/i;

const SOCIAL_OR_NUM_WITH_DIGIT_REGEX =
  /\b(whatsapp|num[ée]ro)\b\s+(zéro|zero|un|deux|trois|quatre|cinq|sixe?|sept|huit|uit|neuf|nèf|dix)\b/i;

const ALL_PATTERNS: RegExp[] = [
  PHONE_RAW_REGEX,
  PHONE_GENERIC_REGEX,
  EMAIL_REGEX,
  SOCIAL_REGEX,
  LINK_REGEX,
  DIGIT_WORD_SEQ_REGEX,
  PHRASE_REGEX,
  SOCIAL_OR_NUM_WITH_DIGIT_REGEX,
];

export interface FilterResult {
  flagged: boolean;
  reason: string | null;
  sanitized: string;
}

/**
 * Returns true if the text contains any blocked pattern.
 */
export function containsBlockedContent(text: string): boolean {
  if (!text) return false;
  return ALL_PATTERNS.some((re) => {
    re.lastIndex = 0; // évite le bug des regex globales dont .test() avance lastIndex entre les appels
    return re.test(text);
  });
}

/**
 * Returns a human-readable reason if the text is flagged, else null.
 * Intended for form validation feedback before submission.
 */
export function detectBlockedContent(text: string): string | null {
  if (!text) return null;
  PHONE_GENERIC_REGEX.lastIndex = 0;
  LINK_REGEX.lastIndex = 0;
  if (PHONE_RAW_REGEX.test(text) || PHONE_GENERIC_REGEX.test(text)) {
    return 'Les numéros de téléphone ne sont pas autorisés. La transaction doit rester sur la plateforme.';
  }
  if (EMAIL_REGEX.test(text)) {
    return 'Les adresses e-mail ne sont pas autorisées dans les messages.';
  }
  LINK_REGEX.lastIndex = 0;
  if (SOCIAL_REGEX.test(text) || LINK_REGEX.test(text)) {
    return 'Les liens et réseaux sociaux/applications de messagerie sont interdits.';
  }
  if (DIGIT_WORD_SEQ_REGEX.test(text)) {
    return 'Les numéros écrits en toutes lettres sont détectés et bloqués.';
  }
  if (PHRASE_REGEX.test(text)) {
    return 'Les tentatives de contact externe (appelle-moi, joindre, numéro...) sont bloquées.';
  }
  if (SOCIAL_OR_NUM_WITH_DIGIT_REGEX.test(text)) {
    return 'Tentative de partage de numéro détectée et bloquée.';
  }
  return null;
}

/**
 * Returns the text with blocked patterns replaced by [masqué].
 * Mirrors the database sanitize_message_content trigger so what the
 * client shows matches what gets stored.
 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  let out = text;
  // Collapse digit separators used to fragment phone numbers
  out = out.replace(/(\d[\s.\-]{1,2}){6,}/gi, '');
  out = out.replace(/\+?\s*243\s?[0-9\s]{6,9}/gi, '[coordonnées masquées]');
  out = out.replace(/\b0\s?(81|82|84|85|89|90|97|99)\s?[0-9\s]{6,7}\b/gi, '[coordonnées masquées]');
  out = out.replace(/\b0[0-9]{9}\b/gi, '[coordonnées masquées]');
  out = out.replace(new RegExp(PHONE_GENERIC_REGEX.source, 'g'), '[coordonnées masquées]');
  out = out.replace(EMAIL_REGEX, '[coordonnées masquées]');
  out = out.replace(
    /\b(whatsapp|whats[a-z]*|telegram|facebook|instagram|messenger|snapchat|tiktok|wechat|viber|imo|signal|w\.?a\.?|tlm)\b/gi,
    '[coordonnées masquées]',
  );
  out = out.replace(new RegExp(LINK_REGEX.source, 'gi'), '[coordonnées masquées]');
  out = out.replace(DIGIT_WORD_SEQ_REGEX, '[coordonnées masquées]');
  out = out.replace(PHRASE_REGEX, '[coordonnées masquées]');
  out = out.replace(SOCIAL_OR_NUM_WITH_DIGIT_REGEX, '[coordonnées masquées]');
  return out;
}

/**
 * Full check used by form validators: returns a FilterResult with
 * flagged flag, reason, and the sanitized preview.
 */
export function filterContent(text: string): FilterResult {
  const reason = detectBlockedContent(text);
  return {
    flagged: reason !== null,
    reason,
    sanitized: sanitizeText(text),
  };
}

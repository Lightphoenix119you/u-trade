/**
 * Anti-circumvention filter for U. Trade.
 *
 * Detects and blocks content that tries to move a transaction off-platform:
 * Congolese phone numbers (081/082/084/085/089/090/097/099 and +243),
 * email addresses, social/messaging app names, spelled-out digit words
 * (zero, huit...), circumvention phrases like "appelle-moi", and several
 * contournements courants : espaces/points intercalés dans un email
 * ("gmail. com"), dans un domaine ("tiktok . com"), ou entre les chiffres
 * d'un numéro ("0.8.9.5"), ainsi que l'envoi d'un seul chiffre par message
 * répété (voir isLoneDigitMessage / LONE_DIGIT_*).
 *
 * Choix délibéré : plutôt que de "nettoyer" le texte (retirer espaces/points)
 * puis chercher la correspondance dans cette version nettoyée, les motifs
 * ci-dessous tolèrent directement des séparateurs À L'INTÉRIEUR d'eux-mêmes
 * (ex: \s*@\s* au lieu de @). Ça atteint le même résultat pratique sans avoir
 * à retrouver ensuite la position exacte dans le texte original pour le
 * masquage — et surtout, ça reste trivialement identique à reproduire dans
 * le trigger SQL sanitize_message_content(), qui doit rester synchronisé
 * avec ces motifs (déjà la cause de plusieurs bugs dans ce projet).
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

// Nouveau : toute séquence de 8 à 15 chiffres, même séparés chiffre par
// chiffre par des espaces, points ou tirets ("0.8.9.5.4.7.0.1.6.0").
const PHONE_SPACED_DIGITS_REGEX = /(?:\d[\s.\-]*){8,15}/g;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

// Nouveau : email tolérant des espaces autour du @ et du point final
// ("nom @ gmail . com", "nom@gmail. com").
const EMAIL_SPACED_REGEX =
  /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/gi;

const SOCIAL_REGEX =
  /\b(whatsapp|whats[a-z]*|telegram|facebook|instagram|messenger|snapchat|tiktok|wechat|viber|imo|signal|w\.?a\.?|tlm)\b/i;

// Liens web et réseaux sociaux (http/https/www, ou domaine nu type
// tiktok.com, wa.me, t.me...) — le SOCIAL_REGEX ci-dessus ne détecte que
// les NOMS d'applications en toutes lettres, jamais un lien direct.
const LINK_REGEX =
  /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|me|co|app|io)[^\s]*)/gi;

// Nouveau : domaine tolérant des espaces autour du point ("tiktok . com").
const LINK_SPACED_REGEX =
  /[a-zA-Z0-9-]+\s*\.\s*(com|net|org|me|co|app|io)\b[^\s]*/gi;

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
  PHONE_SPACED_DIGITS_REGEX,
  EMAIL_REGEX,
  EMAIL_SPACED_REGEX,
  SOCIAL_REGEX,
  LINK_REGEX,
  LINK_SPACED_REGEX,
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
  PHONE_SPACED_DIGITS_REGEX.lastIndex = 0;
  if (PHONE_RAW_REGEX.test(text) || PHONE_GENERIC_REGEX.test(text) || PHONE_SPACED_DIGITS_REGEX.test(text)) {
    return 'Les numéros de téléphone ne sont pas autorisés. La transaction doit rester sur la plateforme.';
  }
  EMAIL_SPACED_REGEX.lastIndex = 0;
  if (EMAIL_REGEX.test(text) || EMAIL_SPACED_REGEX.test(text)) {
    return 'Les adresses e-mail ne sont pas autorisées dans les messages.';
  }
  LINK_REGEX.lastIndex = 0;
  LINK_SPACED_REGEX.lastIndex = 0;
  if (SOCIAL_REGEX.test(text) || LINK_REGEX.test(text) || LINK_SPACED_REGEX.test(text)) {
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
 * Returns the text with blocked patterns replaced by [coordonnées masquées].
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
  out = out.replace(new RegExp(PHONE_SPACED_DIGITS_REGEX.source, 'g'), '[coordonnées masquées]');
  out = out.replace(EMAIL_REGEX, '[coordonnées masquées]');
  out = out.replace(new RegExp(EMAIL_SPACED_REGEX.source, 'gi'), '[coordonnées masquées]');
  out = out.replace(
    /\b(whatsapp|whats[a-z]*|telegram|facebook|instagram|messenger|snapchat|tiktok|wechat|viber|imo|signal|w\.?a\.?|tlm)\b/gi,
    '[coordonnées masquées]',
  );
  out = out.replace(new RegExp(LINK_REGEX.source, 'gi'), '[coordonnées masquées]');
  out = out.replace(new RegExp(LINK_SPACED_REGEX.source, 'gi'), '[coordonnées masquées]');
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

/* ============================================================
 * Limite de fréquence pour les chiffres isolés — contournement où
 * l'utilisateur envoie un numéro un chiffre à la fois, message par
 * message, pour échapper à toute détection au sein d'un seul message.
 *
 * Ceci ne peut pas être résolu par une regex sur un message isolé : il
 * faut un historique. La vraie garantie reste le trigger côté base
 * (voir 024_message_rate_limit.sql) — ce qui suit n'est qu'un
 * pré-contrôle client, pour un retour immédiat plutôt que d'attendre le
 * rejet serveur à chaque message.
 * ============================================================ */
export const LONE_DIGIT_WINDOW_MS = 30_000;
export const LONE_DIGIT_MAX_IN_WINDOW = 5;

export function isLoneDigitMessage(text: string): boolean {
  return /^\d{1,2}$/.test(text.trim());
}

/**
 * Étant donné les timestamps (ms) des envois récents de chiffres isolés,
 * indique si un nouvel envoi maintenant dépasserait la limite.
 */
export function wouldExceedLoneDigitLimit(recentTimestamps: number[], now: number = Date.now()): boolean {
  const withinWindow = recentTimestamps.filter((t) => now - t < LONE_DIGIT_WINDOW_MS);
  return withinWindow.length >= LONE_DIGIT_MAX_IN_WINDOW;
}

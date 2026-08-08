/**
 * Indicateurs de fonctionnalités à l'échelle de l'application.
 *
 * IS_APP_RELEASED : passe à true le jour où l'application mobile est
 * officiellement publiée. Tant qu'il vaut false, les composants qui s'y
 * réfèrent affichent un message d'attente ; une fois à true, ils affichent
 * un lien de téléchargement direct (renseigner APP_DOWNLOAD_URL_* ci-dessous
 * à ce moment-là).
 */
export const IS_APP_RELEASED = false;

export const APP_DOWNLOAD_URL_ANDROID = '';
export const APP_DOWNLOAD_URL_IOS = '';

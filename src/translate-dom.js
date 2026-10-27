/**
 * Puts translated strings into the page markup (UI layer). Elements say what
 * to translate with data attributes:
 *   data-i18n       the text content
 *   data-i18n-aria  the aria-label
 *   data-i18n-tip   the aria-label and the tooltip (plus the data-shortcut key, if any)
 * Text is set with textContent and setAttribute only.
 * @module translate-dom
 */

/**
 * Translates every marked element below root.
 * @param {ParentNode} root
 * @param {(key: string) => string} t translates a string key
 */
export function applyTranslations(root, t) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', t(element.getAttribute('data-i18n-aria')));
  });
  root.querySelectorAll('[data-i18n-tip]').forEach((element) => {
    const label = t(element.getAttribute('data-i18n-tip'));
    const shortcut = element.getAttribute('data-shortcut');
    element.setAttribute('aria-label', label);
    element.setAttribute('title', shortcut ? `${label} (${shortcut})` : label);
  });
}

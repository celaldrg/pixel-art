/**
 * User interface strings in English and Turkish, plus a small translate helper.
 * Pure data and functions: no DOM access, so tests can check the dictionaries.
 * @module i18n
 */

/** Supported interface languages. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

/** Language shown until the visitor picks another one. */
export const DEFAULT_LANGUAGE = 'en';

/** Storage key of the chosen language. */
export const LANGUAGE_KEY = 'pixel-art:lang';

/** Every visible string, by language and key. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    'app.title': 'Pixel Art Editor',
    'lang.code': 'TR',
    'lang.toggle': 'Türkçe’ye geç',
    'toolbar.label': 'Tools',
    'tool.pencil': 'Pencil',
    'tool.eraser': 'Eraser',
    'tool.fill': 'Fill',
    'tool.line': 'Line',
    'tool.rect': 'Rectangle',
    'tool.picker': 'Color picker',
    'action.undo': 'Undo',
    'action.redo': 'Redo',
    'action.clear': 'Clear',
    'tip.clear': 'Clear the canvas',
    'option.mirrorH': 'Mirror left ↔ right',
    'option.mirrorV': 'Mirror top ↕ bottom',
    'option.filled': 'Filled rectangles',
    'option.grid': 'Show grid',
    'zoom.in': 'Zoom in',
    'zoom.out': 'Zoom out',
    'zoom.fit': 'Fit to screen',
    'canvas.label': 'Drawing canvas',
    'panel.color': 'Color',
    'panel.palette': 'Palette',
    'panel.custom': 'Custom colors',
    'custom.add': 'Add color',
    'custom.empty': 'Colors you add show up here.',
    'panel.preview': 'Preview',
    'panel.canvas': 'Canvas & export',
    'field.size': 'Size',
    'field.scale': 'Scale',
    'export.button': 'Export PNG',
    'palette.retro16': 'Retro 16',
    'palette.earth8': 'Earth 8',
    'palette.pastel8': 'Pastel 8',
    'palette.gray8': 'Grays 8',
    'swatch.label': 'Color {color}',
    'status.size': '{width} × {height}',
    'status.cell': 'x {x} · y {y}',
    'status.saved': 'Saved',
    'status.pending': 'Saving…',
    'status.failed': 'Not saved',
    'status.demo': 'Demo · not saved',
    'hint.mouse': 'Wheel: zoom · Space + drag: pan',
    'hint.touch': 'Two fingers: pan and zoom',
    'toast.cleared': 'Canvas cleared. Undo brings it back.',
    'toast.exported': 'Exported {file}',
    'toast.exportFailed': 'Export failed',
    'footer.source': 'Source on GitHub',
  }),
  tr: Object.freeze({
    'app.title': 'Piksel Çizim Editörü',
    'lang.code': 'EN',
    'lang.toggle': 'Switch to English',
    'toolbar.label': 'Araçlar',
    'tool.pencil': 'Kalem',
    'tool.eraser': 'Silgi',
    'tool.fill': 'Boya kovası',
    'tool.line': 'Çizgi',
    'tool.rect': 'Dikdörtgen',
    'tool.picker': 'Damlalık',
    'action.undo': 'Geri al',
    'action.redo': 'Yinele',
    'action.clear': 'Temizle',
    'tip.clear': 'Tuvali temizle',
    'option.mirrorH': 'Ayna: sol ↔ sağ',
    'option.mirrorV': 'Ayna: üst ↕ alt',
    'option.filled': 'Dolu dikdörtgen',
    'option.grid': 'Izgarayı göster',
    'zoom.in': 'Yakınlaştır',
    'zoom.out': 'Uzaklaştır',
    'zoom.fit': 'Ekrana sığdır',
    'canvas.label': 'Çizim tuvali',
    'panel.color': 'Renk',
    'panel.palette': 'Palet',
    'panel.custom': 'Özel renkler',
    'custom.add': 'Renk ekle',
    'custom.empty': 'Eklediğin renkler burada görünür.',
    'panel.preview': 'Önizleme',
    'panel.canvas': 'Tuval ve dışa aktarma',
    'field.size': 'Boyut',
    'field.scale': 'Ölçek',
    'export.button': 'PNG olarak indir',
    'palette.retro16': 'Retro 16',
    'palette.earth8': 'Toprak 8',
    'palette.pastel8': 'Pastel 8',
    'palette.gray8': 'Griler 8',
    'swatch.label': 'Renk {color}',
    'status.size': '{width} × {height}',
    'status.cell': 'x {x} · y {y}',
    'status.saved': 'Kaydedildi',
    'status.pending': 'Kaydediliyor…',
    'status.failed': 'Kaydedilemedi',
    'status.demo': 'Demo · kaydedilmez',
    'hint.mouse': 'Tekerlek: yakınlaştır · Boşluk + sürükle: kaydır',
    'hint.touch': 'İki parmak: kaydır ve yakınlaştır',
    'toast.cleared': 'Tuval temizlendi. Geri al ile geri gelir.',
    'toast.exported': '{file} indirildi',
    'toast.exportFailed': 'Dışa aktarma başarısız',
    'footer.source': 'Kaynak kod GitHub’da',
  }),
});

/**
 * Returns value when it names a supported language, the default language otherwise.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(/** @type {string} */ (value)) ? /** @type {string} */ (value) : DEFAULT_LANGUAGE;
}

/**
 * The language the toggle button switches to.
 * @param {string} language
 * @returns {string}
 */
export function otherLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a string and fills in its {name} placeholders.
 * Missing keys fall back to English, then to the key itself.
 * @param {string} language
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translate(language, key, params = {}) {
  const table = [STRINGS[normalizeLanguage(language)], STRINGS.en].find((strings) => Object.hasOwn(strings, key));
  const template = table ? table[key] : key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => (Object.hasOwn(params, name) ? String(params[name]) : placeholder));
}

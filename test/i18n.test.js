import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  normalizeLanguage,
  otherLanguage,
  STRINGS,
  translate,
} from '../src/i18n.js';
import { PALETTES } from '../src/palettes.js';

/** Placeholder names used in a template, e.g. ["color"] for "Color {color}". */
function placeholders(template) {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

/** Text of a project file. */
function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('string tables', () => {
  test('English and Turkish define exactly the same keys', () => {
    assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
  });

  test('no string is empty and both languages use the same placeholders', () => {
    for (const key of Object.keys(STRINGS.en)) {
      for (const language of LANGUAGES) {
        assert.ok(STRINGS[language][key].trim().length > 0, `${language}:${key} is empty`);
      }
      assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
    }
  });

  test('every key used in index.html exists', () => {
    const html = readProjectFile('index.html');
    const keys = [...html.matchAll(/data-i18n(?:-aria|-tip)?="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(keys.length > 20);
    for (const key of keys) assert.ok(Object.hasOwn(STRINGS.en, key), `missing key ${key}`);
  });

  test('every key the UI code builds or quotes exists', () => {
    const dynamicKeys = [
      ...PALETTES.map(({ id }) => `palette.${id}`),
      ...['saved', 'pending', 'failed', 'demo'].map((status) => `status.${status}`),
    ];
    const quotedKeys = ['main.js', 'controls.js'].flatMap((file) => {
      const code = readProjectFile(`src/${file}`);
      return [...code.matchAll(/'((?:app|hint|status|swatch|toast)\.[a-zA-Z]+)'/g)].map((match) => match[1]);
    });
    assert.ok(quotedKeys.length >= 8);
    for (const key of [...dynamicKeys, ...quotedKeys]) assert.ok(Object.hasOwn(STRINGS.en, key), `missing key ${key}`);
  });

  test('the language button names the other language', () => {
    assert.equal(STRINGS.en['lang.code'], 'TR');
    assert.equal(STRINGS.tr['lang.code'], 'EN');
  });
});

describe('translate', () => {
  test('returns the string of the requested language', () => {
    assert.equal(translate('en', 'tool.pencil'), 'Pencil');
    assert.equal(translate('tr', 'tool.pencil'), 'Kalem');
  });

  test('fills placeholders and leaves unknown ones untouched', () => {
    assert.equal(translate('en', 'status.size', { width: 32, height: 16 }), '32 × 16');
    assert.equal(translate('tr', 'toast.exported', { file: 'a.png' }), 'a.png indirildi');
    assert.equal(translate('en', 'swatch.label'), 'Color {color}');
  });

  test('unknown languages fall back to English, unknown keys to the key itself', () => {
    assert.equal(translate('de', 'action.undo'), 'Undo');
    assert.equal(translate('en', 'no.such.key'), 'no.such.key');
    assert.equal(translate('tr', 'constructor'), 'constructor');
  });
});

describe('language helpers', () => {
  test('normalizeLanguage keeps supported codes and defaults to English', () => {
    assert.equal(DEFAULT_LANGUAGE, 'en');
    assert.equal(normalizeLanguage('tr'), 'tr');
    assert.equal(normalizeLanguage('en'), 'en');
    assert.equal(normalizeLanguage('TR'), 'en');
    assert.equal(normalizeLanguage(null), 'en');
    assert.equal(normalizeLanguage(undefined), 'en');
  });

  test('otherLanguage toggles between English and Turkish', () => {
    assert.equal(otherLanguage('en'), 'tr');
    assert.equal(otherLanguage('tr'), 'en');
    assert.equal(otherLanguage('xx'), 'tr');
  });
});

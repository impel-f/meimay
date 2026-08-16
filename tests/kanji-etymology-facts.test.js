const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const facts = require('../public/data/kanji_etymology_facts.json');
const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);

const ALLOWED_TYPES = new Set(['象形', '指事', '会意', '形声', '会意形声', '仮借']);
const ALLOWED_STATUSES = new Set(['single_source', 'cross_checked']);
const BANNED_PROSE_KEYS = new Set(['text', 'description', 'originText', 'explanation']);

test('etymology facts contain source-backed structured data without copied prose', () => {
  assert.equal(facts.schemaVersion, 1);
  assert.ok(Object.keys(facts.entries).length >= 350);

  for (const [kanji, entry] of Object.entries(facts.entries)) {
    assert.equal(Array.from(kanji).length, 1, `${kanji}: key must be one character`);
    assert.ok(entry.structure, `${kanji}: missing structure`);
    assert.doesNotMatch(entry.structure, /[\uE000-\uF8FF\uFFFD]/u, `${kanji}: broken glyph`);
    assert.ok(Array.isArray(entry.formationTypes), `${kanji}: formationTypes must be an array`);
    entry.formationTypes.forEach((type) => assert.ok(ALLOWED_TYPES.has(type), `${kanji}: unsupported type ${type}`));
    assert.ok(ALLOWED_STATUSES.has(entry.verificationStatus), `${kanji}: invalid verification status`);
    assert.ok(Array.isArray(entry.sources) && entry.sources.length > 0, `${kanji}: missing sources`);
    entry.sources.forEach((source) => assert.match(source.url, /^https:\/\//));
    Object.keys(entry).forEach((key) => assert.ok(!BANNED_PROSE_KEYS.has(key), `${kanji}: prose field ${key}`));
  }
});

test('known component regressions are cross-checked by two independent sources', () => {
  for (const [kanji, semantic, phonetic] of [['舵', '舟', '它'], ['櫂', '木', '翟']]) {
    const entry = facts.entries[kanji];
    assert.ok(entry);
    assert.equal(entry.semanticComponent, semantic);
    assert.equal(entry.phoneticComponent, phonetic);
    assert.equal(entry.verificationStatus, 'cross_checked');
    assert.ok(new Set(entry.sources.map((source) => new URL(source.url).hostname)).size >= 2);
  }
});

test('structured etymology overrides generated prose and participates in cache validation', () => {
  assert.match(originSource, /function buildStructuredEtymologyText/);
  assert.match(originSource, /structuredOriginText \|\| \(isLikelyTruncatedSection/);
  assert.match(originSource, /buildStructuredEtymologyHint\(kanji, etymologyFact\)/);
  assert.match(originSource, /KANJI_ETYMOLOGY_FACTS_URL/);
});

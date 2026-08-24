const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const facts = require('../public/data/kanji_etymology_facts.json');
const master = require('../public/data/kanji_data.json');
const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);

const ALLOWED_TYPES = new Set(['象形', '指事', '会意', '形声', '会意形声', '仮借']);
const ALLOWED_STATUSES = new Set(['component_only', 'single_source', 'cross_checked']);
const BANNED_PROSE_KEYS = new Set(['text', 'description', 'originText', 'explanation']);
const PRIORITY_REVIEWED_KANJI = Array.from(
  '一大仁正光良志空知明幸和英昇昌茉春星昭美洋勇泉奏香咲俊祐亮真航笑桜純恵華悟哲剛珠泰桂晃浩隼晋栞凉理章'
);

test('etymology facts contain source-backed structured data without copied prose', () => {
  assert.equal(facts.schemaVersion, 1);
  assert.equal(Object.keys(facts.entries).length, 3000);

  for (const [kanji, entry] of Object.entries(facts.entries)) {
    assert.equal(Array.from(kanji).length, 1, `${kanji}: key must be one character`);
    assert.doesNotMatch(entry.structure || '', /[\uE000-\uF8FF\uFFFD]/u, `${kanji}: broken glyph`);
    assert.ok(Array.isArray(entry.formationTypes), `${kanji}: formationTypes must be an array`);
    assert.ok(Array.isArray(entry.visualComponents), `${kanji}: visualComponents must be an array`);
    entry.formationTypes.forEach((type) => assert.ok(ALLOWED_TYPES.has(type), `${kanji}: unsupported type ${type}`));
    assert.ok(ALLOWED_STATUSES.has(entry.verificationStatus), `${kanji}: invalid verification status`);
    assert.ok(Array.isArray(entry.sources), `${kanji}: sources must be an array`);
    entry.sources.forEach((source) => assert.match(source.url, /^https:\/\//));
    Object.keys(entry).forEach((key) => assert.ok(!BANNED_PROSE_KEYS.has(key), `${kanji}: prose field ${key}`));
  }
});

test('every appropriate master kanji has a safe structure or visible components', () => {
  for (const row of master.filter((item) => Number(item['不適切フラグ'] || 0) !== 1)) {
    const kanji = row['漢字'];
    const entry = facts.entries[kanji];
    assert.ok(entry, `${kanji}: missing fact entry`);
    assert.ok(entry.structure || entry.visualComponents.length > 0, `${kanji}: missing safe visual data`);
  }
});

test('known component regressions are cross-checked by two independent sources', () => {
  for (const [kanji, semantic, phonetic] of [
    ['都', '邑（おおざと）', '者'],
    ['悠', '心', '攸'],
    ['翔', '羽', '羊'],
    ['結', '糸', '吉'],
    ['孟', '子', '皿'],
    ['海', '水（さんずい）', '每'],
    ['舵', '舟', '它'],
    ['櫂', '木', '翟']
  ]) {
    const entry = facts.entries[kanji];
    assert.ok(entry);
    assert.equal(entry.semanticComponent, semantic);
    assert.equal(entry.phoneticComponent, phonetic);
    assert.equal(entry.verificationStatus, 'cross_checked');
    assert.ok(new Set(entry.sources.map((source) => new URL(source.url).hostname)).size >= 2);
  }
});

test('verified etymology prose does not expose raw component decompositions', () => {
  assert.match(facts.entries['都'].fixedOriginText, /邑.*者.*形声文字/);
  assert.match(facts.entries['悠'].fixedOriginText, /心.*攸.*形声文字/);
  assert.match(facts.entries['翔'].fixedOriginText, /羽.*羊.*形声文字/);
  assert.match(facts.entries['結'].fixedOriginText, /糸.*吉.*形声文字/);
  assert.match(facts.entries['孟'].fixedOriginText, /子.*皿.*形声文字/);
  assert.match(facts.entries['海'].fixedOriginText, /水（さんずい）.*每.*形声文字/);
  assert.doesNotMatch(facts.entries['都'].fixedOriginText, /日・邦・老|⿰/);
  assert.doesNotMatch(originSource, /字形には「\$\{visualComponents\.join\('・'\)\}」/);
  assert.match(originSource, /verificationStatus === 'component_only'\) return ''/);
});

test('priority batch has fixed prose backed by independent source domains', () => {
  assert.equal(PRIORITY_REVIEWED_KANJI.length, 50);
  for (const kanji of PRIORITY_REVIEWED_KANJI) {
    const entry = facts.entries[kanji];
    assert.ok(entry, `${kanji}: missing priority fact`);
    assert.equal(entry.verificationStatus, 'cross_checked', `${kanji}: not cross-checked`);
    assert.ok(entry.fixedOriginText?.length >= 40, `${kanji}: fixed origin is too short`);
    assert.doesNotMatch(
      entry.fixedOriginText,
      /字形には|分解情報|断定するものでは|component|undefined|�/i,
      `${kanji}: unsafe fallback prose`
    );
    const sourceDomains = new Set(entry.sources
      .filter((source) => source.kind !== 'visual_components')
      .map((source) => new URL(source.url).hostname.replace(/^www\./, '')));
    assert.ok(sourceDomains.size >= 2, `${kanji}: requires two independent source domains`);
  }
});

test('structured etymology overrides generated prose and participates in cache validation', () => {
  assert.match(originSource, /function buildStructuredEtymologyText/);
  assert.match(originSource, /structuredOriginText \|\| \(isLikelyTruncatedSection/);
  assert.match(originSource, /buildStructuredEtymologyHint\(kanji, etymologyFact\)/);
  assert.match(originSource, /KANJI_ETYMOLOGY_FACTS_URL/);
});

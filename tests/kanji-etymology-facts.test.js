const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const facts = require('../public/data/kanji_etymology_facts.json');
const master = require('../public/data/kanji_data.json');
const sourceIndex = require('../scripts/data/kanji_etymology_source_index.json');
const autoVerified = require('../scripts/data/kanji_etymology_reviews/auto_verified.json');
const sourceGrounded = require('../scripts/data/kanji_etymology_reviews/ai_source_grounded.json');
const manualCompletion = require('../scripts/data/kanji_etymology_reviews/manual_completion.json');
const masterByKanji = new Map(master.map((row) => [row['漢字'], row]));
const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);

const ALLOWED_TYPES = new Set(['象形', '指事', '会意', '形声', '会意形声', '仮借']);
const ALLOWED_STATUSES = new Set(['source_grounded', 'cross_checked']);
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
    assert.ok(entry.sources.length > 0, `${kanji}: source evidence is required`);
    entry.sources.forEach((source) => assert.match(source.url, /^https:\/\//));
    assert.ok(entry.fixedOriginText?.length >= 35 && entry.fixedOriginText.length <= 150, `${kanji}: invalid fixed prose`);
    assert.doesNotMatch(
      entry.fixedOriginText.replace(`「${kanji}」`, ''),
      /[\u{20000}-\u{2FA1F}]/u,
      `${kanji}: unsupported extension glyph in published prose`
    );
    Object.keys(entry).forEach((key) => assert.ok(!BANNED_PROSE_KEYS.has(key), `${kanji}: prose field ${key}`));
  }
});

test('independent etymology domains count as a cross-check after source deduplication', () => {
  const entry = facts.entries['丹'];
  const domains = new Set(entry.sources
    .filter((source) => source.kind !== 'visual_components')
    .map((source) => new URL(source.url).hostname.replace(/^www\./, '')));
  assert.ok(domains.size >= 2);
  assert.equal(entry.verificationStatus, 'cross_checked');
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

test('full source index covers all kanji and automatic reviews fail closed', () => {
  assert.equal(sourceIndex.schemaVersion, 3);
  assert.equal(Object.keys(sourceIndex.entries).length, 3000);
  assert.deepEqual(sourceIndex.failures, []);
  assert.ok(Object.keys(autoVerified).length >= 1400);

  for (const [kanji, review] of Object.entries(autoVerified)) {
    const sourceEntry = sourceIndex.entries[kanji];
    const fact = facts.entries[kanji];
    assert.ok([
      'source_template',
      'variant_inheritance',
      'source_grounded_variant_inheritance'
    ].includes(review.reviewMethod), `${kanji}: missing review method`);
    if (review.reviewMethod === 'source_template') {
      assert.equal(sourceEntry?.agreement?.status, 'matched', `${kanji}: source types disagree`);
      const hasSafePrimaryText = sourceEntry?.kanjipedia?.hasUnresolvedGlyph === false
        || sourceEntry?.kanjitisikiDetail?.status === 'ok';
      assert.equal(hasSafePrimaryText, true, `${kanji}: unresolved source glyph`);
      const formationType = review.formationTypes[0];
      const supportingSources = sourceEntry?.agreement?.sourcesByType?.[formationType] || [];
      const supportingDomains = new Set(supportingSources.map((source) => new URL(source.url).hostname));
      assert.ok(supportingDomains.size >= 2, `${kanji}: missing independent classification evidence`);
    } else {
      const row = masterByKanji.get(kanji) || {};
      const sourceFact = facts.entries[review.originSourceKanji];
      const inheritedSourceUrls = new Set((review.sources || []).map((source) => source.url));
      const standardSourceUrls = new Set((sourceFact?.sources || []).map((source) => source.url));
      const hasExplicitVariantMapping = row['標準字体'] === review.originSourceKanji
        && ['旧字体', '異体字', '別体'].includes(row['字形種別'])
        && review.fixedOriginText.startsWith(`「${kanji}」`)
        && inheritedSourceUrls.size > 0
        && [...inheritedSourceUrls].every((url) => standardSourceUrls.has(url));
      const safeInheritance = kanji.normalize('NFKC') === review.originSourceKanji
        || hasExplicitVariantMapping
        || (row['字形種別'] === '旧字体' && sourceFact?.fixedOriginText?.startsWith(`「${review.originSourceKanji}」の旧字`))
        || (row['字形種別'] === '旧字体' && sourceFact?.fixedOriginText?.startsWith(`「${review.originSourceKanji}」のもとになった旧字`))
        || sourceFact?.fixedOriginText?.includes(kanji);
      assert.ok(review.originSourceKanji, `${kanji}: missing inherited source kanji`);
      assert.ok(safeInheritance, `${kanji}: unsafe variant inheritance`);
    }
    assert.ok(review.fixedOriginText.length >= 40 && review.fixedOriginText.length <= 150, `${kanji}: invalid prose length`);
    assert.doesNotMatch(
      review.fixedOriginText,
      /画像部品|字形には|分解情報|意符|義符|声符|音符|undefined|�|(?:た|だ|る|いる|れる|せる)の形|の形の形/iu,
      `${kanji}: unsafe generated prose`
    );
    assert.doesNotMatch(
      review.fixedOriginText.replace(`「${kanji}」`, ''),
      /[\u{20000}-\u{2FA1F}]/u,
      `${kanji}: unsupported extension glyph in generated prose`
    );
    assert.equal(fact?.reviewMethod, review.reviewMethod, `${kanji}: review method was not propagated`);
    const expectedStatus = review.reviewMethod === 'source_grounded_variant_inheritance'
      ? 'source_grounded'
      : 'cross_checked';
    assert.equal(fact?.verificationStatus, expectedStatus, `${kanji}: generated fact has the wrong evidence status`);
    const domains = new Set(fact.sources
      .filter((source) => source.kind !== 'visual_components')
      .map((source) => new URL(source.url).hostname.replace(/^www\./, '')));
    const requiredDomains = review.reviewMethod === 'source_template' ? 2 : 1;
    assert.ok(domains.size >= requiredDomains, `${kanji}: requires ${requiredDomains} source domain(s)`);
  }
});

test('source-grounded reviews retain explicit evidence and propagate without weakening status', () => {
  const reviews = { ...sourceGrounded, ...manualCompletion };
  assert.ok(Object.keys(reviews).length >= 500);

  for (const [kanji, review] of Object.entries(reviews)) {
    const fact = facts.entries[kanji];
    assert.ok([
      'source_grounded_ai_review',
      'source_grounded_variant_inheritance',
      'manual_source_review'
    ].includes(review.reviewMethod), `${kanji}: invalid source-grounded review method`);
    assert.ok(review.fixedOriginText?.length >= 35 && review.fixedOriginText.length <= 150, `${kanji}: invalid prose length`);
    assert.doesNotMatch(
      review.fixedOriginText.replace(`「${kanji}」`, ''),
      /[\u{20000}-\u{2FA1F}]/u,
      `${kanji}: unsupported extension glyph in source-grounded prose`
    );
    assert.ok(Array.isArray(review.sources) && review.sources.length > 0, `${kanji}: missing source evidence`);
    review.sources.forEach((source) => assert.match(source.url, /^https:\/\//));
    assert.equal(fact?.reviewMethod, review.reviewMethod, `${kanji}: review method was not propagated`);
    assert.equal(fact?.verificationStatus, 'source_grounded', `${kanji}: invalid published status`);
    assert.equal(fact?.fixedOriginText, review.fixedOriginText, `${kanji}: published prose differs from review`);
  }
});

test('structured etymology overrides generated prose and participates in cache validation', () => {
  assert.match(originSource, /function buildStructuredEtymologyText/);
  assert.match(originSource, /structuredOriginText \|\| \(isLikelyTruncatedSection/);
  assert.match(originSource, /buildStructuredEtymologyHint\(kanji, etymologyFact\)/);
  assert.match(originSource, /KANJI_ETYMOLOGY_FACTS_URL/);
});

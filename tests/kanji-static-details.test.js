const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const master = require('../public/data/kanji_data.json');
const sourceCompounds = require('../public/data/kanji_compounds.json').entries;
const codexReviews = require('../scripts/data/kanji_static_codex_reviews.json').entries;

test('static kanji details cover the complete master list with reviewed facts', () => {
  const details = require('../public/data/kanji_static_details.json');
  assert.equal(details.schemaVersion, 1);
  assert.equal(Object.keys(details.entries).length, 3000);

  for (const row of master) {
    const kanji = row['漢字'];
    const entry = details.entries[kanji];
    assert.ok(entry, `${kanji}: missing static detail`);
    assert.ok(entry.meaningSummary, `${kanji}: missing summary meaning`);
    assert.ok(entry.meaningDetail, `${kanji}: missing detailed meaning`);
    assert.ok(entry.namingMeaning, `${kanji}: missing naming meaning`);
    assert.equal((entry.namingMeaning.match(/。/g) || []).length, 1, `${kanji}: naming meaning must be one factual sentence`);
    assert.doesNotMatch(entry.namingMeaning, /願う名づけ|人柄を願|人生を願|未来を願/, `${kanji}: naming meaning contains a composed wish`);
    assert.ok(entry.etymology?.text, `${kanji}: missing etymology`);
    assert.ok(['source_grounded', 'cross_checked'].includes(entry.etymology.reviewStatus), `${kanji}: invalid review status`);
    assert.ok(entry.nameUse?.category, `${kanji}: missing name-use category`);
    assert.ok(Array.isArray(entry.compounds) && entry.compounds.length <= 3, `${kanji}: invalid compounds`);

    const allowed = new Set([
      ...(sourceCompounds[kanji] || []),
      ...(sourceCompounds[row['標準字体']] || []),
    ].map((item) => `${item.word}|${item.reading}`));
    const reviewExplicitlySelectedCompounds = Array.isArray(codexReviews[kanji]?.compounds);
    if (allowed.size > 0 && !reviewExplicitlySelectedCompounds) {
      assert.ok(entry.compounds.length > 0, `${kanji}: verified compounds exist but none are published`);
    }
    for (const compound of entry.compounds) {
      assert.ok(allowed.has(`${compound.word}|${compound.reading}`), `${kanji}: unverified compound ${compound.word}`);
      assert.ok(compound.meaning, `${kanji}: missing Japanese meaning for ${compound.word}`);
      assert.match(compound.meaning, /[ぁ-んァ-ヶ一-龠]/u, `${kanji}: non-Japanese meaning for ${compound.word}`);
      assert.ok(['positive', 'neutral', 'negative'].includes(compound.tone), `${kanji}: invalid tone for ${compound.word}`);
    }
  }


  assert.ok(details.entries['福'].compounds.some((item) => item.word === '幸福'));
  assert.ok(details.entries['都'].compounds.some((item) => item.word === '古都'));
});

test('kanji detail runtime uses the bundled static dataset before legacy generation code', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'js', '08-origin.js'), 'utf8');
  assert.match(source, /const KANJI_STATIC_DETAILS_URL = '\/data\/kanji_static_details\.json/);
  assert.match(source, /const staticDetails = await loadKanjiStaticDetails\(\)/);
  assert.match(source, /【名づけでの意味】/);
  assert.match(source, /【名づけ利用】/);
});

test('Codex-reviewed kanji details override generated enrichment without mutating its source', () => {
  const builder = fs.readFileSync(path.join(root, 'scripts', 'build_static_kanji_details.js'), 'utf8');
  const reportBuilder = fs.readFileSync(path.join(root, 'scripts', 'generate_kanji_static_review_report.js'), 'utf8');
  const reviews = require('../scripts/data/kanji_static_codex_reviews.json');
  assert.equal(reviews.schemaVersion, 1);
  assert.equal(reviews.reviewer, 'codex-5.6sol');
  assert.equal(reviews.automatedAuditThrough, 3000);
  assert.equal(Object.keys(reviews.entries).length, 3000);
  for (const [kanji, review] of Object.entries(reviews.entries)) {
    assert.equal(review.status, 'reviewed', `${kanji}: review status`);
    assert.match(review.reviewedAt, /^\d{4}-\d{2}-\d{2}$/, `${kanji}: reviewedAt`);
  }
  assert.match(builder, /codexReviews\[kanji\]\?\.status === 'reviewed'/);
  assert.match(builder, /review\.namingMeaning \|\| enriched\.namingMeaning/);
  assert.match(builder, /review\.etymologyText \|\| etymology\.fixedOriginText/);
  assert.match(builder, /Array\.isArray\(review\.compounds\)/);
  assert.match(reportBuilder, /index < automatedAuditThrough/);
});

test('unfamiliar etymology components include an inline explanation', () => {
  const details = require('../public/data/kanji_static_details.json').entries;
  const componentRules = {
    '亼': /亼（しゅう）.*(?:「集」のもとの字|「集」の古字)|(?:「集」のもとの字|「集」の古字).*亼（しゅう）/,
    '宀': /宀（うかんむり）/,
    '卩': /卩（せつ）/,
    '彳': /彳（ぎょうにんべん）/,
    '辵': /辵（しんにょう）/,
    '艸': /艸（くさかんむり）/,
    '攴': /攴（ぼく）/,
    '廾': /廾（きょう）/,
    '邑': /邑（おおざと）/,
    '歹': /歹（がつへん）/,
  };

  for (const [kanji, entry] of Object.entries(details)) {
    if (!entry.etymology.formationTypes.includes('会意')) continue;
    for (const [component, explanationPattern] of Object.entries(componentRules)) {
      if (kanji !== component && entry.etymology.text.includes(component)) {
        assert.match(entry.etymology.text, explanationPattern, `${kanji}: ${component} needs an inline explanation`);
      }
    }
  }
});

test('ideographic explanations connect components to meaning without generic filler', () => {
  const details = require('../public/data/kanji_static_details.json').entries;
  const ideographicEntries = Object.entries(details)
    .filter(([, entry]) => entry.etymology.formationTypes.includes('会意'));

  assert.equal(ideographicEntries.length, 356);
  for (const [kanji, entry] of ideographicEntries) {
    assert.doesNotMatch(entry.etymology.text, /の意味を組み合わせた会意文字/, `${kanji}: generic ideographic explanation`);
    assert.doesNotMatch(entry.etymology.text, /画像部品|undefined|compound_slot/, `${kanji}: internal marker in etymology`);
    assert.ok(entry.etymology.text.length >= 35, `${kanji}: ideographic explanation is too short`);
  }

  assert.match(details['亙'].etymology.text, /舟/);
  assert.doesNotMatch(details['亙'].etymology.text, /「二」と「月」/);
  assert.match(details['丈'].etymology.text, /長い棒.*手/);
});

test('name-origin prompt uses fixed meanings and produces one editable origin draft', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'js', '08-origin.js'), 'utf8');
  assert.match(source, /kanjiStaticDetailsCache\?\.\[kanji\]\?\.namingMeaning/);
  assert.match(source, /wishは互換性維持用のため、必ず空文字にする/);
  assert.match(source, /この名前に込める願い/);
  assert.doesNotMatch(source, /renderNameOriginSection\('この名前の決め手'/);
});

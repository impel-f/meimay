const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const compounds = require('../public/data/kanji_compounds.json');
const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);
const HAN_WORD_PATTERN = /^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]{2,3}$/u;
const KANA_PATTERN = /^[\u3041-\u309Fー]+$/u;

test('JMdict compound database covers the complete 3000-kanji key set', () => {
  assert.equal(compounds.schemaVersion, 1);
  assert.equal(Object.keys(compounds.entries).length, 3000);
  assert.match(compounds.source.name, /JMdict/);
  assert.match(compounds.source.license, /CC BY-SA 4\.0/);

  let covered = 0;
  let total = 0;
  for (const [kanji, items] of Object.entries(compounds.entries)) {
    assert.equal(Array.from(kanji).length, 1);
    assert.ok(Array.isArray(items));
    if (items.length) covered += 1;
    const seen = new Set();
    for (const item of items) {
      assert.match(item.word, HAN_WORD_PATTERN, `${kanji}: invalid word ${item.word}`);
      assert.ok(item.word.includes(kanji), `${kanji}: word does not contain target`);
      assert.match(item.reading, KANA_PATTERN, `${kanji}: invalid reading ${item.reading}`);
      assert.ok(!seen.has(item.word), `${kanji}: duplicate ${item.word}`);
      assert.equal(Object.hasOwn(item, 'meaning'), false, `${kanji}: unsourced meaning must not be stored`);
      seen.add(item.word);
      total += 1;
    }
  }
  assert.ok(covered >= 2800, `covered only ${covered}`);
  assert.ok(total >= 15000, `stored only ${total} compounds`);
});

test('known kanji use verified database words and UI ignores AI compound prose', () => {
  assert.ok(compounds.entries['孟'].some((item) => item.word === '孟子'));
  assert.ok(compounds.entries['愛'].some((item) => ['恋愛', '博愛', '友愛'].includes(item.word)));
  assert.match(originSource, /const verifiedCompounds = buildStructuredCompoundText\(compoundItems\)/);
  assert.doesNotMatch(originSource, /formatRepresentativeIdiomContent\(aiSection, kanji, groundedSegments\)/);
});

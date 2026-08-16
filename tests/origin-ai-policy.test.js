const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);
const detailDataset = require('../public/data/kanji_detail_dataset.json');
const etymologyFacts = require('../public/data/kanji_etymology_facts.json');

function getOriginText(kanji) {
  return (detailDataset[kanji]?.sections || [])
    .find((section) => section.title === '成り立ち')?.text || '';
}

test('kanji prompt never asks AI to generate representative compounds', () => {
  assert.match(originSource, /熟語は検証済みデータベースから別途補完するため/);
  assert.match(originSource, /const KANJI_COMPOUNDS_URL/);
  assert.match(originSource, /function buildStructuredCompoundText/);
  assert.doesNotMatch(originSource, /Google検索を実行して国語辞典・漢和辞典の見出しとして確認/);
});

test('name origin output merges the family message and wish without duplicate sections', () => {
  assert.match(originSource, /キーは "decision", "wish", "sound", "check" の4つだけ/);
  assert.match(originSource, /家族に伝える願い/);
  assert.doesNotMatch(originSource, /キーは必ず "decision", "wish", "sound", "familyLine"/);
  assert.match(originSource, /decisionは35〜60字/);
  assert.match(originSource, /soundは25〜45字/);
  assert.match(originSource, /「選ばれます」のような受け身の説明口調を使わない/);
});

test('kanji details put naming meaning first and cap visible idioms', () => {
  assert.match(originSource, /KANJI_DETAIL_DISPLAY_SECTION_ORDER = \['意味の深掘り', '成り立ち'\]/);
  assert.match(originSource, /dedupeRepresentativeIdiomLines\(filtered\)\.slice\(0, 3\)/);
  assert.match(originSource, /元々の意味、名前に使うときのニュアンス、広がりを60〜100文字/);
});

test('Gemini generation requests require Firebase authentication headers', () => {
  assert.match(originSource, /getAuthenticatedAiRequestHeaders/);
  assert.doesNotMatch(originSource, /fetch\(getMeimayApiUrl\('\/api\/gemini'\), \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \}/);
});

test('unverified readings and origins fail closed instead of inventing a reason', () => {
  assert.match(originSource, /この漢字単独の読みとして、現在の収録データでは確認できません/);
  assert.match(originSource, /検証済みの字源情報がないため、成り立ちの説明は掲載していません/);
  assert.match(originSource, /熟語の頭文字に由来するという説明は絶対に書かない/);
  assert.match(originSource, /includes\(KANJI_ORIGIN_UNVERIFIED_TEXT\)/);
});

test('truncated kanji sections are repaired instead of cached', () => {
  assert.ok(originSource.includes('if (!/[。！？!?．.]$/.test(normalized)) return true;'));
  assert.match(originSource, /!sectionMap\.has\('代表的な熟語'\)/);
});

test('name origins reject common meaning expansions not present in source data', () => {
  assert.match(originSource, /健やか\|すこやか/);
  assert.match(originSource, /瑞々し\|みずみずし/);
  assert.match(originSource, /前向き\|前を向/);
  assert.match(originSource, /朗らか\|ほがらか/);
  assert.doesNotMatch(originSource, /人にやさしく、自分らしさを大切にしながら歩んでほしい/);
  assert.match(originSource, /combinedMeaning/);
});

test('known regression kanji retain the verified glyph components', () => {
  assert.match(getOriginText('舵'), /舟.*它/);
  assert.match(getOriginText('櫂'), /木.*翟/);
  assert.match(getOriginText('孟'), /子.*皿/);
  assert.equal(etymologyFacts.entries['舵'].phoneticComponent, '它');
  assert.equal(etymologyFacts.entries['櫂'].phoneticComponent, '翟');
  assert.equal(etymologyFacts.entries['孟'].phoneticComponent, '皿');
});

test('broken private-use glyphs are rejected by the grounded-origin quality gate', () => {
  assert.match(getOriginText('馬'), /[\uE000-\uF8FF]/u);
  assert.match(originSource, /hasBrokenGlyph/);
  assert.match(originSource, /originText\.length < 25/);
});

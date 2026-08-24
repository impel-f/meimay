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

test('kanji prompt lets AI rank only verified compounds and requires meanings', () => {
  assert.match(originSource, /熟語は検証済み候補にある語だけを使い、新しい熟語を生成しない/);
  assert.match(originSource, /肯定的な語、中立的な語、否定的な語の順/);
  assert.match(originSource, /各行の意味を省略しない/);
  assert.match(originSource, /必ず\$\{requiredIdiomsCount\}語/);
  assert.match(originSource, /熟語をそのまま繰り返すだけの説明は禁止/);
  assert.match(originSource, /最初の語義だけを簡潔に説明/);
  assert.match(originSource, /compactMeaning === `\$\{word\}すること`/);
  assert.match(originSource, /\.slice\(0, 1\)/);
  assert.match(originSource, /compactMeaning === word/);
  assert.match(originSource, /const KANJI_COMPOUNDS_URL/);
  assert.match(originSource, /function buildStructuredCompoundText/);
  assert.match(originSource, /function getRequiredRepresentativeIdiomCount/);
  assert.match(originSource, /idiomsCount >= normalizedRequiredIdiomsCount/);
  assert.match(originSource, /normalizedRequiredIdiomsCount === 0\s*\? idiomsMarkedNone/);
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
  assert.equal(etymologyFacts.entries['孟'].semanticComponent, '子');
  assert.match(etymologyFacts.entries['孟'].fixedOriginText, /子.*皿.*形声文字/);
  assert.equal(etymologyFacts.entries['都'].semanticComponent, '邑（おおざと）');
  assert.equal(etymologyFacts.entries['都'].phoneticComponent, '者');
  assert.match(etymologyFacts.entries['都'].fixedOriginText, /宮殿のある「みやこ」/);
  assert.equal(etymologyFacts.entries['音'].phoneticComponent, undefined);
  assert.match(etymologyFacts.entries['音'].fixedOriginText, /「言」と共通する古い字形/);
  assert.match(etymologyFacts.entries['音'].fixedOriginText, /会意・指事/);
  assert.doesNotMatch(getOriginText('音'), /声符は言|音を表す要素.*言/);
  assert.equal(etymologyFacts.entries['海'].semanticComponent, '水（さんずい）');
  assert.equal(etymologyFacts.entries['海'].phoneticComponent, '每');
  assert.match(etymologyFacts.entries['海'].fixedOriginText, /黒々と深い「うみ」/);
});

test('broken private-use glyphs are rejected by the grounded-origin quality gate', () => {
  assert.match(getOriginText('馬'), /[\uE000-\uF8FF]/u);
  assert.match(originSource, /hasBrokenGlyph/);
  assert.match(originSource, /originText\.length < 25/);
});

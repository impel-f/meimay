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
const staticDetails = require('../public/data/kanji_static_details.json').entries;

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

test('name origin AI writes only the editable wish draft from fixed kanji meanings', () => {
    assert.match(originSource, /キーは"originDraft"だけ/);
    assert.match(originSource, /この名前に込める願い/);
    assert.match(originSource, /const lengthGuide = givenNameLength <= 1 \? '50〜80字' : '65〜105字'/);
    assert.match(originSource, /意味から無理なく直接つながる理想像へ一段だけ広げて構いません/);
    assert.match(originSource, /植物の名であることだけから「健やか」「まっすぐ」「芯が強い」などの性質を作る/);
    assert.match(originSource, /漢字・植物・字の働きをそのまま人物へ置き換える比喩は使いません/);
    assert.match(originSource, /2文目はそこから直接つながる一つの願いを書きます/);
    assert.match(originSource, /「笑顔あふれる日々」「周りを照らす」など入力からさらに結果を足す表現/);
    assert.match(originSource, /「込めることができます」「願いが込められます」のような第三者視点にはしません/);
    assert.match(originSource, /NAME_ORIGIN_PROMPT_VERSION = 'name_origin_v33_20260831'/);
    assert.match(originSource, /const expectedKeys = \['originDraft'\]/);
    assert.match(originSource, /const nameIndex = originDraft\.indexOf\(givenName\)/);
    assert.match(originSource, /すべての語義を無理に詰め込みません/);
    assert.match(originSource, /2文目にはwishRoleがsemanticの字を明記/);
    assert.match(originSource, /名前由来の願いに反映されていない漢字があります/);
    assert.match(originSource, /nameSpecificContext/);
    assert.match(originSource, /verifiedCulturalReferences/);
    assert.match(originSource, /その漢字ならではの背景を優先/);
    assert.match(originSource, /花言葉はnameSpecificContextに明記されている場合だけ使用/);
    assert.match(originSource, /漢字や植物そのものを人物の比喩にしません/);
    assert.match(originSource, /NAME_ORIGIN_VERIFIED_WISH_BRIDGES/);
    assert.match(originSource, /NAME_ORIGIN_SEMANTIC_COMPOUNDS/);
    assert.match(originSource, /verifiedWishBridgeがある字は、その確認済みの一段連想を使えます/);
    assert.match(originSource, /「伊」に含まれる「尹」から「治める」を導くような説明は禁止します/);
    assert.match(originSource, /getNameOriginSoundText\(result\)/);
    assert.match(originSource, /const localCheck = getNameOriginLocalCheckText\(result\)/);
    assert.match(originSource, /function getNameOriginMeaningParts\(result = currentBuildResult\)/);
    assert.match(originSource, /part\?\._compoundOrigin && Array\.isArray\(part\.sourceParts\)/);
    assert.match(originSource, /const meaningParts = getNameOriginMeaningParts\(result\)/);
    assert.match(originSource, /const originDetails = meaningParts\.map/);
    assert.match(originSource, /return getNameOriginMeaningParts\(result\)/);
    assert.match(originSource, /parsed\.decision \|\| parsed\['この名前の決め手'\]/);
    assert.match(originSource, /parsed\.sound \|\| parsed\['呼んだときの印象'\]/);
    assert.doesNotMatch(originSource, /キーは "decision", "wish", "sound", "check" の4つだけ/);
    assert.doesNotMatch(originSource, /renderNameOriginSection\('この名前の決め手'/);
});

test('kana-only names do not render fake kanji meanings or reading warnings', () => {
    assert.match(originSource, /function isNameOriginKanjiText\(value\)/);
    assert.match(originSource, /if \(!kanji \|\| !isNameOriginKanjiText\(kanji\)\) return null/);
    assert.match(originSource, /filter\(\(\{ char \}\) => !!findNameOriginMasterItemByKanji\(char\)\)/);
    assert.match(originSource, /if \(chars\.length === 0\) return ''/);
});

test('kanji details put deep meaning first and cap visible idioms', () => {
    assert.match(originSource, /KANJI_DETAIL_DISPLAY_SECTION_ORDER = \['意味の深掘り', '成り立ち'\]/);
    assert.match(originSource, /'意味の深掘り': '🔎'/);
    assert.doesNotMatch(originSource, /KANJI_DETAIL_DISPLAY_SECTION_ORDER = \[[^\n]*名づけ利用/);
    assert.match(originSource, /dedupeRepresentativeIdiomLines\(filtered\)\.slice\(0, 3\)/);
    assert.match(originSource, /const staticDetails = await loadKanjiStaticDetails\(\)/);
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

test('name origins allow modest wishes while keeping dictionary facts grounded', () => {
  assert.match(originSource, /「温かな縁」「力強く歩む」「清らかな心」程度の親の願いは使用できます/);
  assert.match(originSource, /\['伊', '「これ・かれ」と人や物を指す働きから、一人ひとりの存在を大切にする'\]/);
  assert.match(originSource, /\['奈', 'もと果樹の名を表したことから、日々の歩みが実を結ぶ'\]/);
  assert.match(originSource, /\['亜', '「つぐ・次に位置する」という意味から、一歩ずつ次の段階へ進む'\]/);
  assert.doesNotMatch(originSource, /NAME_ORIGIN_WISH_OPTIONAL_KANJI/);
  assert.doesNotMatch(originSource, /NAME_ORIGIN_ALL_SUPPORT_WISH_BRIDGES/);
  assert.doesNotMatch(originSource, /const guardedExpansions/);
  assert.doesNotMatch(originSource, /人にやさしく、自分らしさを大切にしながら歩んでほしい/);
  assert.match(originSource, /漢字の辞書的な意味は入力された漢字データだけを事実として扱います/);
  assert.match(staticDetails['伊'].meaningDeepDive, /「これ・かれ」.*一人ひとりの存在/);
  assert.doesNotMatch(staticDetails['伊'].meaningDeepDive, /治める|正す/);
  assert.match(staticDetails['奈'].meaningDeepDive, /カラナシ.*実を結ぶ/);
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

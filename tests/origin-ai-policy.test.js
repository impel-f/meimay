const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const originSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', '08-origin.js'),
  'utf8'
);
const detailDataset = require('../public/data/kanji_detail_dataset.json');

function getOriginText(kanji) {
  return (detailDataset[kanji]?.sections || [])
    .find((section) => section.title === '成り立ち')?.text || '';
}

test('kanji prompt allows zero idioms and forbids filling the quota', () => {
  assert.match(originSource, /確認できるものだけ0〜5個/);
  assert.match(originSource, /0個でも正解です/);
  assert.doesNotMatch(originSource, /最低3個/);
});

test('unverified readings and origins fail closed instead of inventing a reason', () => {
  assert.match(originSource, /この漢字単独の読みとして、現在の収録データでは確認できません/);
  assert.match(originSource, /検証済みの字源情報がないため、成り立ちの説明は掲載していません/);
  assert.match(originSource, /熟語の頭文字に由来するという説明は絶対に書かない/);
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
});

test('known regression kanji retain the verified glyph components', () => {
  assert.match(getOriginText('舵'), /舟.*它/);
  assert.match(getOriginText('櫂'), /木.*翟/);
  assert.match(getOriginText('孟'), /子.*皿/);
});

test('broken private-use glyphs are rejected by the grounded-origin quality gate', () => {
  assert.match(getOriginText('馬'), /[\uE000-\uF8FF]/u);
  assert.match(originSource, /hasBrokenGlyph/);
  assert.match(originSource, /originText\.length < 25/);
});

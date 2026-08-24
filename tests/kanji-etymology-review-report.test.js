const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const reportPath = path.join(__dirname, '..', 'review', 'kanji-etymology-review.html');
const report = fs.readFileSync(reportPath, 'utf8');

test('etymology review report covers all 3000 kanji and exposes honest states', () => {
  assert.match(report, /"total":3000/);
  assert.match(report, /公開可能/);
  assert.match(report, /要追加確認/);
  assert.match(report, /未検証/);
  assert.match(report, /部品検索データは成り立ちの根拠に数えません/);
});

test('review report includes the verified Sea origin and no old component prose', () => {
  assert.match(report, /「海」の旧字は/);
  assert.match(report, /水（さんずい）/);
  assert.match(report, /音を表す「每」/);
  assert.doesNotMatch(report, /字形には「汁・母・毋・乞」/);
});

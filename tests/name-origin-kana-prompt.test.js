const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const originPath = path.join(__dirname, '..', 'public', 'js', '08-origin.js');
const originSource = fs.readFileSync(originPath, 'utf8');

function extractFunctions(functionNames) {
  const ast = acorn.parse(originSource, { ecmaVersion: 'latest', sourceType: 'script' });
  const names = new Set(functionNames);
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && names.has(node.id.name))
    .map((node) => originSource.slice(node.start, node.end));
  assert.equal(declarations.length, names.size, 'kana origin functions must remain discoverable');
  return declarations.join('\n');
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`
  const currentBuildResult = null;
  const kanjiStaticDetailsCache = {};
  const NAME_ORIGIN_VERIFIED_WISH_BRIDGES = new Map();
  function getNameOriginGivenName(result) { return String(result?.givenName || '').trim(); }
  function getNameOriginGivenReading(result) { return String(result?.givenReading || '').trim(); }
  function getNameOriginSoundProfile() { return { moraCount: 3 }; }
  function getNameOriginSoundText() {
    return '「たろう」は3拍で、輪郭のある子音から始まる読みです。';
  }
  function getNameOriginMeaningParts() { throw new Error('kana prompt must not read kanji meanings'); }
  function getNameOriginKanjiValue() { throw new Error('kana prompt must not read kanji values'); }
  function getNameOriginMeaning() { return '名前に込めたい印象を持つ漢字'; }
  function isNameOriginKanjiText() { return false; }
  ${extractFunctions([
    'isNameOriginKanaOnly',
    'getNameOriginKanaScriptLabel',
    'buildKanaNameOriginPrompt',
    'buildNameOriginPrompt'
  ])}
  globalThis.kanaOrigin = { buildNameOriginPrompt, isNameOriginKanaOnly };
`, sandbox, { filename: originPath });

test('hiragana names use a dedicated prompt without fake kanji data', () => {
  const prompt = sandbox.kanaOrigin.buildNameOriginPrompt({
    givenName: 'たろう',
    givenReading: 'たろう',
    combination: ['た', 'ろ', 'う'].map((char) => ({ '漢字': char }))
  });

  assert.match(prompt, /表記: ひらがな/);
  assert.match(prompt, /「ひらがな」という語を必ず入れ/);
  assert.match(prompt, /かなを一文字ずつ意味のある漢字・記号として扱わず/);
  assert.match(prompt, /現代日本語で一般に使われる一つの語として/);
  assert.match(prompt, /「ゆかり」なら縁やつながり/);
  assert.match(prompt, /同音の漢字を当てないと意味が成立しない場合/);
  assert.match(prompt, /確認済みの響き情報/);
  assert.doesNotMatch(prompt, /漢字データ:/);
  assert.doesNotMatch(prompt, /名前に込めたい印象を持つ漢字/);
});

test('katakana names use the same safe kana path', () => {
  assert.equal(sandbox.kanaOrigin.isNameOriginKanaOnly('ヒカリ'), true);
  const prompt = sandbox.kanaOrigin.buildNameOriginPrompt({
    givenName: 'ヒカリ',
    givenReading: 'ひかり'
  });
  assert.match(prompt, /表記: カタカナ/);
  assert.doesNotMatch(prompt, /漢字データ:/);
});

test('kanji names do not enter the kana-only path', () => {
  assert.equal(sandbox.kanaOrigin.isNameOriginKanaOnly('陽葵'), false);
});

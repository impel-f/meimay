const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const originPath = path.join(__dirname, '..', 'public', 'js', '08-origin.js');

function extractFunctions(filePath, functionNames) {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const names = new Set(functionNames);
  const declarations = ast.body
    .filter((node) => node.type === 'FunctionDeclaration' && names.has(node.id.name))
    .map((node) => source.slice(node.start, node.end));
  assert.equal(declarations.length, names.size, 'name sound functions must remain discoverable');
  return declarations.join('\n');
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`
  function normalizeNameOriginReadingValue(value) {
    return String(value || '').trim().replace(/\\s+/g, '');
  }
  function getNameOriginGivenReading(result) {
    return String(result?.givenReading || '');
  }
  ${extractFunctions(originPath, [
    'splitNameOriginSoundMoras',
    'getNameOriginSoundVowel',
    'getNameOriginSoundConsonantType',
    'getNameOriginSoundProfile',
    'getNameOriginSoundImpression',
    'getNameOriginSoundText'
  ])}
  globalThis.nameSound = {
    splitNameOriginSoundMoras,
    getNameOriginSoundProfile,
    getNameOriginSoundText
  };
`, sandbox, { filename: originPath });

const sound = sandbox.nameSound;

test('name sound analysis uses the complete mora sequence', () => {
  const taiyo = sound.getNameOriginSoundProfile('たいよう');
  assert.equal(taiyo.moraCount, 4);
  assert.equal(taiyo.firstType, 'obstruent');
  assert.equal(taiyo.backVowelShare, 0.75);

  const asuka = sound.getNameOriginSoundProfile('あすか');
  assert.equal(asuka.moraCount, 3);
  assert.equal(asuka.firstType, 'vowel');
  assert.equal(asuka.obstruentShare, 1);
});

test('name sound text explains observable features without personality claims', () => {
  assert.equal(
    sound.getNameOriginSoundText({ givenReading: 'たいよう' }),
    '「たいよう」は4拍で、輪郭のある子音から始まる読みです。丸みとのびやかさを感じやすい響きです。'
  );
  assert.equal(
    sound.getNameOriginSoundText({ givenReading: 'あすか' }),
    '「あすか」は3拍で、母音から始まり、輪郭のある子音が続く読みです。のびやかさと歯切れのよさを感じやすい響きです。'
  );
});

test('name sound analysis is deterministic and normalizes katakana', () => {
  const hiragana = sound.getNameOriginSoundText({ givenReading: 'ゆうき' });
  assert.equal(hiragana, sound.getNameOriginSoundText({ givenReading: 'ユウキ' }));
  assert.doesNotMatch(hiragana, /性格|男性|女性|優しい子|責任感/);
});

test('short, long, and nasal-ending readings receive distinct descriptions', () => {
  assert.match(sound.getNameOriginSoundText({ givenReading: 'がく' }), /短く、歯切れのよさと輪郭/);
  assert.match(sound.getNameOriginSoundText({ givenReading: 'けんたろう' }), /音の連なり/);
  assert.match(sound.getNameOriginSoundText({ givenReading: 'じゅん' }), /まとまりと余韻/);
});

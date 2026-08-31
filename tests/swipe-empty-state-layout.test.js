const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'main.css'), 'utf8');
const renderSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', '05-ui-render.js'), 'utf8');

test('swipe completion options preserve label and count space on narrow phones', () => {
  assert.match(renderSource, /swipe-empty-state-option-head/);
  assert.match(renderSource, /swipe-empty-state-option-label/);
  assert.match(renderSource, /swipe-empty-state-count/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /\.swipe-empty-state-count[\s\S]*?min-width:\s*52px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*?\.swipe-empty-state-panel[\s\S]*?100vw - 28px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*?\.swipe-empty-state-count[\s\S]*?min-width:\s*48px/);
});

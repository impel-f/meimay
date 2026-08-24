const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const scripts = [
  'scripts/generate_kanji_static_enrichment.js',
  'scripts/generate_source_grounded_kanji_etymologies.js',
];

function runWithoutAiCredentials(script, args, extraEnv = {}) {
  const env = { ...process.env };
  delete env.GOOGLE_API_KEY;
  delete env.GEMINI_API_KEY;
  delete env.MEIMAY_ALLOW_BULK_GEMINI;
  Object.assign(env, extraEnv);
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}

for (const script of scripts) {
  test(`${script} blocks unapproved all-item Gemini runs`, () => {
    const result = runWithoutAiCredentials(script, ['--all']);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Bulk Gemini generation is locked/);
  });

  test(`${script} blocks unapproved runs over 30 items`, () => {
    const result = runWithoutAiCredentials(script, ['--max-items', '31']);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Bulk Gemini generation is locked/);
  });

  test(`${script} requires per-run confirmation even when bulk env is set`, () => {
    const result = runWithoutAiCredentials(script, ['--all'], {
      MEIMAY_ALLOW_BULK_GEMINI: '1',
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Bulk Gemini generation is locked/);
  });
}

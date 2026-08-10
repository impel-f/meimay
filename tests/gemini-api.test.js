const assert = require('node:assert/strict');
const test = require('node:test');

const geminiHandler = require('../api/gemini');

const {
  MODEL_PRIORITY_GROUPS,
  buildGenerationConfig,
  generateWithFallback,
} = geminiHandler._test;

test('Gemini uses only current GA Flash models in priority order', () => {
  assert.deepEqual(
    MODEL_PRIORITY_GROUPS.flatMap((group) => group.candidates),
    [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]
  );
});

test('Gemini generation config keeps the server timeout without legacy sampling overrides', () => {
  assert.deepEqual(buildGenerationConfig(), {
    maxOutputTokens: 2048,
    httpOptions: {
      timeout: 12_000,
    },
  });
});

test('Gemini falls back to the next GA model and records each attempt', async () => {
  const requestedModels = [];
  const ai = {
    models: {
      async generateContent(request) {
        requestedModels.push(request.model);
        if (request.model === 'gemini-3.6-flash') {
          const error = new Error('temporary failure');
          error.status = 503;
          throw error;
        }
        return { text: '生成結果' };
      },
    },
  };

  const result = await generateWithFallback(ai, 'テスト');

  assert.equal(result.text, '生成結果');
  assert.equal(result.modelName, 'gemini-3.5-flash');
  assert.deepEqual(requestedModels, [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ]);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].ok, false);
  assert.equal(result.attempts[1].ok, true);
});

test('Gemini rejects empty model responses and continues fallback', async () => {
  const ai = {
    models: {
      async generateContent(request) {
        return request.model === 'gemini-3.6-flash'
          ? { text: '   ' }
          : { text: '有効な結果' };
      },
    },
  };

  const result = await generateWithFallback(ai, 'テスト');

  assert.equal(result.modelName, 'gemini-3.5-flash');
  assert.equal(result.text, '有効な結果');
  assert.match(result.attempts[0].error, /Empty response/);
});

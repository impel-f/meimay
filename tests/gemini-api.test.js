const assert = require('node:assert/strict');
const test = require('node:test');

const geminiHandler = require('../api/gemini');

const {
  MODEL_PRIORITY_GROUPS,
  PRIMARY_MODEL_NAME,
  MODEL_CACHE_VERSION,
  buildGenerationConfig,
  generateWithFallback,
} = geminiHandler._test;

test('Gemini uses only current GA Flash models in priority order', () => {
  assert.deepEqual(
    MODEL_PRIORITY_GROUPS.flatMap((group) => group.candidates),
    [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]
  );
});

test('Gemini metadata exposes the primary model cache generation', async () => {
  const req = { method: 'GET' };
  let statusCode = 0;
  let payload = null;
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return body;
    },
    end() {},
  };

  await geminiHandler(req, res);

  assert.equal(statusCode, 200);
  assert.equal(payload.primary_model, PRIMARY_MODEL_NAME);
  assert.equal(payload.model_cache_version, MODEL_CACHE_VERSION);
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
        if (request.model === 'gemini-3.7-flash') {
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
  assert.equal(result.modelName, 'gemini-3.6-flash');
  assert.deepEqual(requestedModels, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
  ]);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].ok, false);
  assert.equal(result.attempts[1].ok, true);
});

test('Gemini rejects empty model responses and continues fallback', async () => {
  const ai = {
    models: {
      async generateContent(request) {
        return request.model === 'gemini-3.7-flash'
          ? { text: '   ' }
          : { text: '有効な結果' };
      },
    },
  };

  const result = await generateWithFallback(ai, 'テスト');

  assert.equal(result.modelName, 'gemini-3.6-flash');
  assert.equal(result.text, '有効な結果');
  assert.match(result.attempts[0].error, /Empty response/);
});

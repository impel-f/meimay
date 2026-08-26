const assert = require('node:assert/strict');
const test = require('node:test');

const geminiHandler = require('../api/gemini');
const {
  buildModelCacheVersion,
} = require('../api/_lib/gemini-models');

const {
  MODEL_PRIORITY_GROUPS,
  PRIMARY_MODEL_NAME,
  MODEL_CACHE_VERSION,
  buildGenerationConfig,
  extractGroundedTextSegments,
  generateWithFallback,
  buildRateLimitUpdate,
  validateGenerationPayload,
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

test('kanji fact checks use low-temperature Google Search grounding', () => {
  assert.deepEqual(buildGenerationConfig('kanjiFact'), {
    maxOutputTokens: 4096,
    httpOptions: {
      timeout: 12_000,
    },
    temperature: 0.1,
    tools: [{ googleSearch: {} }],
  });
});

test('name origins use low thinking and a one-field JSON schema without web grounding', () => {
  assert.deepEqual(buildGenerationConfig('nameOrigin'), {
    maxOutputTokens: 1024,
    httpOptions: {
      timeout: 12_000,
    },
    thinkingConfig: { thinkingLevel: 'LOW' },
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: 'object',
      properties: {
        originDraft: {
          type: 'string',
          description: '固定された漢字の意味だけを使った、70〜110字の名づけ由来文案',
        },
      },
      required: ['originDraft'],
      additionalProperties: false,
    },
  });
});

test('only cited Google Search response segments are exposed as grounded', () => {
  assert.deepEqual(extractGroundedTextSegments({
    groundingSupports: [
      { groundingChunkIndices: [0], segment: { text: '・操舵（そうだ）：舵を操作すること。' } },
      { groundingChunkIndices: [], segment: { text: '根拠なし' } },
      { groundingChunkIndices: [1], segment: {} },
    ],
  }), ['・操舵（そうだ）：舵を操作すること。']);
});

test('grounded fragments expand to their complete output line', () => {
  const responseText = '【代表的な熟語】\n・孟春（もうしゅん）：春の初め。陰暦正月の異称。';
  assert.deepEqual(extractGroundedTextSegments({
    groundingSupports: [
      { groundingChunkIndices: [0], segment: { text: '陰暦正月の異称' } },
    ],
  }, responseText), ['・孟春（もうしゅん）：春の初め。陰暦正月の異称。']);
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
  assert.equal(buildModelCacheVersion(result.modelName), 'gemini_model_gemini-3.6-flash');
});

test('Gemini generation accepts only bounded app task payloads', () => {
  assert.deepEqual(validateGenerationPayload({ prompt: ' テスト ', taskType: 'nameOrigin' }), {
    prompt: 'テスト',
    taskType: 'nameOrigin',
  });
  assert.throws(() => validateGenerationPayload({ prompt: 'テスト', taskType: 'freePrompt' }), /Unsupported/);
  assert.throws(() => validateGenerationPayload({ prompt: 'a'.repeat(16_001), taskType: 'kanjiFact' }), /allowed length/);
});

test('Gemini abuse counters reset by minute and JST date', () => {
  const now = new Date('2026-08-16T03:04:05.000Z');
  const first = buildRateLimitUpdate({}, now);
  assert.equal(first.minuteCount, 1);
  assert.equal(first.dailyCount, 1);
  assert.equal(first.dateKey, '2026-08-16');

  const next = buildRateLimitUpdate(first, new Date('2026-08-16T03:04:40.000Z'));
  assert.equal(next.minuteCount, 2);
  assert.equal(next.dailyCount, 2);

  const nextMinute = buildRateLimitUpdate(next, new Date('2026-08-16T03:05:00.000Z'));
  assert.equal(nextMinute.minuteCount, 1);
  assert.equal(nextMinute.dailyCount, 3);
});

test('Gemini abuse counters cap requests before costly model generation', () => {
  const now = new Date('2026-08-16T03:04:05.000Z');
  assert.throws(() => buildRateLimitUpdate({
    minuteKey: '2026-08-16T03:04',
    minuteCount: 5,
    dateKey: '2026-08-16',
    dailyCount: 5,
  }, now), /limit exceeded/);
  assert.throws(() => buildRateLimitUpdate({
    minuteKey: '2026-08-16T03:03',
    minuteCount: 0,
    dateKey: '2026-08-16',
    dailyCount: 30,
  }, now), /limit exceeded/);
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

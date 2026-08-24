const fs = require('node:fs');
const path = require('node:path');
const { GoogleGenAI } = require('@google/genai');
const { MODEL_PRIORITY_GROUPS } = require('../api/_lib/gemini-models');

const ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const AUTO_PATH = path.join(__dirname, 'data', 'kanji_etymology_reviews', 'auto_verified.json');
const OUTPUT_PATH = path.join(__dirname, 'data', 'kanji_etymology_reviews', 'ai_source_grounded.json');
const OVERRIDES_PATH = path.join(__dirname, 'data', 'kanji_etymology_overrides.json');
const REVIEW_DIR = path.join(__dirname, 'data', 'kanji_etymology_reviews');
const SOURCE_CACHE_DIR = path.join(ROOT, '.cache', 'meimay-data', 'etymology-sources', 'kanjipedia');
const DETAIL_SOURCE_CACHE_DIR = path.join(ROOT, '.cache', 'meimay-data', 'etymology-sources', 'kanjitisiki-detail');
const RESULT_CACHE_DIR = path.join(ROOT, '.cache', 'meimay-data', 'etymology-sources', 'grounded-reviews');
const BATCH_SIZE = 12;
const DEFAULT_MAX_ITEMS = 30;
const FORBIDDEN_PATTERN = /画像部品|undefined|�|字形には|分解情報|断定でき|推測|おそらく|AI|漢字ペディア|意符|義符|声符|音符|誤り変わった|音を表す(?:要素|部分|部品|文字)(?!「)|[\u{20000}-\u{2FA1F}]/u;

function getRunOptions(argv = process.argv.slice(2)) {
  const maxIndex = argv.indexOf('--max-items');
  const parsedMax = maxIndex >= 0 ? Number(argv[maxIndex + 1]) : DEFAULT_MAX_ITEMS;
  if (!Number.isInteger(parsedMax) || parsedMax < 1) {
    throw new Error('--max-items must be a positive integer');
  }
  const runAll = argv.includes('--all');
  const bulkAllowed = process.env.MEIMAY_ALLOW_BULK_GEMINI === '1' && argv.includes('--confirm-cost');
  if ((runAll || parsedMax > DEFAULT_MAX_ITEMS) && !bulkAllowed) {
    throw new Error('Bulk Gemini generation is locked. After explicit cost approval, set MEIMAY_ALLOW_BULK_GEMINI=1 and pass --confirm-cost for this run.');
  }
  return { runAll, maxItems: parsedMax };
}

function readJson(filePath, fallback = {}) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cacheKey(kanji) {
  return Array.from(kanji).map((char) => char.codePointAt(0).toString(16)).join('-');
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function loadReservedEntries() {
  const reserved = {
    ...readJson(OVERRIDES_PATH),
  };
  const autoEntries = readJson(AUTO_PATH);
  for (const [kanji, entry] of Object.entries(autoEntries)) {
    if (!validateText(kanji, entry.fixedOriginText)) reserved[kanji] = entry;
  }
  for (const fileName of fs.readdirSync(REVIEW_DIR).filter((name) => name.endsWith('.json'))) {
    if (fileName === path.basename(AUTO_PATH) || fileName === path.basename(OUTPUT_PATH)) continue;
    Object.assign(reserved, readJson(path.join(REVIEW_DIR, fileName)));
  }
  return reserved;
}

function validateText(kanji, text) {
  const normalized = clean(text);
  if (!new RegExp(`^「${kanji}」(?:は、|の|には)`, 'u').test(normalized)) {
    return '対象漢字で始まっていません';
  }
  if (normalized.length < 35 || normalized.length > 150) return `文字数が範囲外です: ${normalized.length}`;
  const proseWithoutTarget = normalized.replace(`「${kanji}」`, '');
  if (FORBIDDEN_PATTERN.test(proseWithoutTarget)) return '禁止表現が含まれています';
  if (!/[。]$/u.test(normalized)) return '句点で終わっていません';
  return '';
}

function extractJson(text) {
  const normalized = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(normalized);
}

async function generateWithFallback(ai, contents, config) {
  let lastError;
  for (const group of MODEL_PRIORITY_GROUPS) {
    for (const model of group.candidates) {
      try {
        const response = await ai.models.generateContent({ model, contents, config });
        if (!response.text?.trim()) throw new Error('Empty response');
        return { text: response.text, model };
      } catch (error) {
        lastError = error;
        console.warn(`${model}: ${error.message}`);
      }
    }
  }
  throw lastError || new Error('No Gemini model succeeded');
}

function buildDraftPrompt(items) {
  return `あなたは漢字辞典の校閲者です。次の出典本文だけを根拠に、各漢字の「成り立ち」表示文を作成してください。

厳守事項:
- 出典本文にない部品・字形・説・意味を絶対に追加しない。
- 出典に「一説」「異説」などがあれば、断定せず複数説があることを残す。
- 判読不能な画像文字は推測せず、その部品名を使わない範囲で説明する。
- 「意符」「義符」「声符」「音符」などの辞書用語は使わず、「意味に関わる」「音を表す」と自然に言い換える。
- 部品が判読不能なときは「意符と音符」のような穴のある構成説明を捨て、出典にある字義の生まれ方だけを書く。
- 「音を表す部品（セン）」のように音だけで部品名を代用しない。「音を表す」の直後には必ず実際の漢字を「」で示し、示せなければ構成説明を丸ごと省く。
- 1件40〜150文字、です・ます調、必ず「『対象漢字』は、」ではなく「「対象漢字」は、」で始める。
- 出典名、URL、AI、検証作業には触れない。
- CJK統合漢字拡張領域の難字は出力しない。原文に含まれる場合は、その部品名を省いて意味が変わらない日本語に言い換える。
- 意味は入力の「意味」にある範囲だけを短く添える。
- JSON配列だけを返す。形式は [{"kanji":"字","fixedOriginText":"本文"}]。

入力:
${JSON.stringify(items)}`;
}

function buildReviewPrompt(items) {
  return `あなたは漢字字源データの厳格な校閲者です。出典本文と候補文を1件ずつ照合してください。

判定基準:
- 出典にない部品名、形成分類、由来、意味を足していれば不合格。
- 出典の異説や不確実性を消して断定していれば不合格。
- 出典の内容を読みやすいです・ます調に言い換えただけなら合格。
- 不合格なら出典の範囲内だけで40〜150文字に修正する。
- JSON配列だけを返す。形式は [{"kanji":"字","approved":true,"correctedText":"","issue":""}]。

入力:
${JSON.stringify(items)}`;
}

async function processBatch(ai, items) {
  const config = {
    temperature: 0,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
  };
  const draftResponse = await generateWithFallback(ai, buildDraftPrompt(items), config);
  const drafts = extractJson(draftResponse.text);
  const draftsByKanji = new Map(drafts.map((item) => [clean(item.kanji), clean(item.fixedOriginText)]));
  const reviewItems = items.map((item) => ({
    ...item,
    candidate: draftsByKanji.get(item.kanji) || '',
  }));
  const reviewResponse = await generateWithFallback(ai, buildReviewPrompt(reviewItems), config);
  const reviews = extractJson(reviewResponse.text);
  const reviewsByKanji = new Map(reviews.map((item) => [clean(item.kanji), item]));

  return items.map((item) => {
    const draft = draftsByKanji.get(item.kanji) || '';
    const review = reviewsByKanji.get(item.kanji) || {};
    let finalText = clean(review.approved ? draft : review.correctedText);
    let validationError = validateText(item.kanji, finalText);
    if (validationError && !validateText(item.kanji, draft)) {
      finalText = draft;
      validationError = '';
    }
    return {
      ...item,
      draft,
      finalText,
      approved: Boolean(review.approved || review.correctedText),
      issue: clean(review.issue),
      validationError,
      draftModel: draftResponse.model,
      reviewModel: reviewResponse.model,
    };
  });
}

async function main() {
  const runOptions = getRunOptions();
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required');
  const ai = new GoogleGenAI({ apiKey });
  const master = readJson(MASTER_PATH, []);
  const reserved = loadReservedEntries();
  const previousEntries = readJson(OUTPUT_PATH);
  const existing = Object.fromEntries(Object.entries(previousEntries)
    .filter(([kanji, entry]) => !reserved[kanji] && !validateText(kanji, entry.fixedOriginText)));
  const pending = [];

  for (const row of master) {
    const kanji = clean(row['漢字']);
    if (!kanji || reserved[kanji] || existing[kanji]) continue;
    const primarySource = readJson(path.join(SOURCE_CACHE_DIR, `${cacheKey(kanji)}.json`));
    const detailSource = readJson(path.join(DETAIL_SOURCE_CACHE_DIR, `${cacheKey(kanji)}.json`));
    const source = clean(primarySource.originText) ? primarySource : detailSource;
    const sourceName = source === primarySource ? '漢字ペディア' : '漢字辞典オンライン';
    const originText = clean(source.originText);
    if (!originText) continue;
    const cached = readJson(path.join(RESULT_CACHE_DIR, `${cacheKey(kanji)}.json`), null);
    const cachedValidationError = cached?.finalText ? validateText(kanji, cached.finalText) : '';
    if (cached?.approved && !cachedValidationError && cached.finalText) {
      existing[kanji] = {
        formationTypes: source.formationTypes || [],
        fixedOriginText: cached.finalText,
        reviewMethod: 'source_grounded_ai_review',
        sources: [{ name: sourceName, url: source.url, kind: 'etymology' }],
      };
      continue;
    }
    pending.push({
      kanji,
      formationTypes: source.formationTypes || [],
      sourceText: originText,
      meaning: clean(row['意味']),
      sourceUrl: source.url,
      sourceName,
    });
  }

  const selectedPending = runOptions.runAll ? pending : pending.slice(0, runOptions.maxItems);
  const plannedBatches = Math.ceil(selectedPending.length / BATCH_SIZE);
  console.log(JSON.stringify({
    pending: pending.length,
    selected: selectedPending.length,
    batchSize: BATCH_SIZE,
    minimumGeminiRequests: plannedBatches * 2,
    note: pending.length > selectedPending.length
      ? 'Only the selected subset will run. Bulk generation requires explicit approval.'
      : 'All pending items are selected.',
  }, null, 2));
  for (let offset = 0; offset < selectedPending.length; offset += BATCH_SIZE) {
    const batch = selectedPending.slice(offset, offset + BATCH_SIZE);
    const results = await processBatch(ai, batch);
    for (const result of results) {
      writeJson(path.join(RESULT_CACHE_DIR, `${cacheKey(result.kanji)}.json`), result);
      if (!result.approved || result.validationError) {
        console.warn(`${result.kanji}: ${result.validationError || result.issue || 'review rejected'}`);
        continue;
      }
      existing[result.kanji] = {
        formationTypes: result.formationTypes,
        fixedOriginText: result.finalText,
        reviewMethod: 'source_grounded_ai_review',
        sources: [{ name: result.sourceName, url: result.sourceUrl, kind: 'etymology' }],
      };
    }
    writeJson(OUTPUT_PATH, existing);
    console.log(`Reviewed ${Math.min(offset + BATCH_SIZE, selectedPending.length)}/${selectedPending.length}; accepted ${Object.keys(existing).length}`);
  }

  writeJson(OUTPUT_PATH, existing);
  console.log(JSON.stringify({ accepted: Object.keys(existing).length, pending: pending.length, selected: selectedPending.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

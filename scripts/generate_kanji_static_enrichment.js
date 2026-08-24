const fs = require('node:fs');
const path = require('node:path');
const { GoogleGenAI } = require('@google/genai');
const { MODEL_PRIORITY_GROUPS } = require('../api/_lib/gemini-models');

const ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const MEANINGS_PATH = path.join(ROOT, 'public', 'data', 'kanji_meaning_details.json');
const COMPOUNDS_PATH = path.join(ROOT, 'public', 'data', 'kanji_compounds.json');
const OUTPUT_PATH = path.join(__dirname, 'data', 'kanji_static_enrichment.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'meimay-data', 'kanji-static-enrichment');
const BATCH_SIZE = 30;
const CONCURRENCY = 6;
const MAX_COMPOUND_CANDIDATES = 24;
const ENRICHMENT_VERSION = 2;
const ALLOWED_TONES = new Set(['positive', 'neutral', 'negative']);

function readJson(filePath, fallback = {}) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cachePathForKanji(kanji) {
  return path.join(CACHE_DIR, `${kanji.codePointAt(0).toString(16)}.json`);
}

function parseJson(text) {
  const normalized = String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(normalized);
}

async function generateWithFallback(ai, contents) {
  let lastError;
  for (const group of MODEL_PRIORITY_GROUPS) {
    for (const model of group.candidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            temperature: 0,
            maxOutputTokens: 32768,
            responseMimeType: 'application/json',
          },
        });
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

async function generateJsonWithRetry(ai, contents, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await generateWithFallback(ai, contents);
      return { ...response, data: parseJson(response.text) };
    } catch (error) {
      lastError = error;
      console.warn(`JSON generation retry ${attempt + 1}/${attempts}: ${error.message}`);
    }
  }
  throw lastError || new Error('JSON generation failed');
}

function getAllowedCompounds(item) {
  const allowed = new Map();
  for (const candidate of item.compoundCandidates || []) {
    allowed.set(`${clean(candidate.word)}|${clean(candidate.reading)}`, candidate);
  }
  return allowed;
}

function sanitizeGeneratedEntry(source, candidate) {
  const allowedByWord = new Map();
  for (const item of source.compoundCandidates || []) {
    if (!allowedByWord.has(clean(item.word))) allowedByWord.set(clean(item.word), item);
  }
  const seen = new Set();
  const compounds = [];
  for (const item of Array.isArray(candidate?.compounds) ? candidate.compounds : []) {
    const sourceItem = allowedByWord.get(clean(item.word));
    if (!sourceItem || seen.has(sourceItem.word)) continue;
    seen.add(sourceItem.word);
    compounds.push({
      word: sourceItem.word,
      reading: sourceItem.reading,
      meaning: clean(item.meaning),
      tone: ALLOWED_TONES.has(clean(item.tone)) ? clean(item.tone) : 'neutral',
    });
    if (compounds.length >= 3) break;
  }
  return {
    kanji: source.kanji,
    namingMeaning: source.inappropriate
      ? (/。$/.test(source.summary) ? source.summary : `${source.summary}。`)
      : clean(candidate?.namingMeaning),
    compounds,
  };
}

function validateEntry(source, candidate) {
  const kanji = clean(source.kanji);
  if (clean(candidate?.kanji) !== kanji) return `${kanji}: target mismatch`;

  const namingMeaning = clean(candidate.namingMeaning);
  const minimumLength = source.inappropriate ? 2 : 18;
  if (namingMeaning.length < minimumLength || namingMeaning.length > 90) {
    return `${kanji}: invalid namingMeaning length ${namingMeaning.length}`;
  }
  if (!/[。]$/.test(namingMeaning)) return `${kanji}: namingMeaning must end with a period`;
  if (/誰からも|愛される|恵まれる|運命|成功する|幸せになる|スケール|未来に(?:成功|活躍|飛躍)|羽ばたく|存在にな|才能を発揮/.test(namingMeaning)) {
    return `${kanji}: namingMeaning contains an unsupported assertion: ${namingMeaning}`;
  }
  const sourceMeaning = `${source.summary} ${source.meaning}`.replace(/[「」『』]/g, '');
  const comparisons = namingMeaning.matchAll(/[「『]?([^「」『』、。]{1,12})[」』]?のよう[なに]/g);
  for (const comparison of comparisons) {
    const comparedWord = clean(comparison[1]).split(/[やはがをにへと]/).filter(Boolean).pop() || '';
    if (comparedWord && !sourceMeaning.includes(comparedWord)) {
      return `${kanji}: namingMeaning adds an unsupported comparison ${comparedWord}: ${namingMeaning}`;
    }
  }

  const compounds = Array.isArray(candidate.compounds) ? candidate.compounds : [];
  if (compounds.length > 3) return `${kanji}: too many compounds`;
  const allowed = getAllowedCompounds(source);
  if (allowed.size > 0 && compounds.length === 0) return `${kanji}: compounds are available but none were selected`;
  const seen = new Set();
  for (const compound of compounds) {
    const word = clean(compound.word);
    const reading = clean(compound.reading);
    const key = `${word}|${reading}`;
    const meaning = clean(compound.meaning);
    if (!allowed.has(key)) return `${kanji}: unverified compound ${key}`;
    if (seen.has(word)) return `${kanji}: duplicate compound ${word}`;
    if (meaning.length < 2 || meaning.length > 60) return `${kanji}: invalid meaning for ${word}`;
    if (!/[ぁ-んァ-ヶ一-龠]/u.test(meaning)) return `${kanji}: non-Japanese meaning for ${word}`;
    if (!ALLOWED_TONES.has(clean(compound.tone))) return `${kanji}: invalid tone for ${word}`;
    seen.add(word);
  }
  return '';
}

function normalizeEntry(source, candidate, metadata = {}) {
  const allowed = getAllowedCompounds(source);
  return {
    namingMeaning: clean(candidate.namingMeaning),
    compounds: (Array.isArray(candidate.compounds) ? candidate.compounds : []).map((compound) => {
      const word = clean(compound.word);
      const reading = clean(compound.reading);
      const sourceCandidate = allowed.get(`${word}|${reading}`) || {};
      return {
        word,
        reading,
        meaning: clean(compound.meaning).replace(/[。]+$/, ''),
        tone: clean(compound.tone),
        common: sourceCandidate.common === true,
      };
    }),
    generation: {
      version: ENRICHMENT_VERSION,
      model: clean(metadata.model),
      reviewModel: clean(metadata.reviewModel),
      status: 'ai_reviewed',
    },
  };
}

function buildDraftPrompt(items) {
  return `あなたは赤ちゃんの名づけ向け漢字辞典を作る編集者です。入力にある事実だけを使い、公開前の固定データ案を作ってください。

厳守事項:
- JSON配列だけを返す。
- 各要素は {"kanji":"字","namingMeaning":"本文。","compounds":[{"word":"熟語","reading":"よみ","meaning":"日本語の意味","tone":"positive|neutral|negative"}]}。
- namingMeaningは18〜90字、です・ます調ではなく辞典として自然な文体で、句点で終える。
- namingMeaningは入力のmeaningとsummaryだけを根拠に、字義とそこから直接導ける控えめな願いを説明する。
- namingMeaningは原則として「〜を表す。〜という意味から、〜を願う名づけに用いられる。」の粒度にする。
- 「〜のように」という比喩、入力にない人物像、愛される・恵まれる・成功する・幸せになる等の結果、自然物の性質の補完は禁止する。
- 漢字本来の否定的・中立的な意味を隠すために、入力にない肯定的な象徴を作らない。
- compoundsは入力のcompoundCandidatesにあるwordとreadingを一字も変えず、最大3語を選ぶ。候補にない語を作らない。
- 熟語は一般性と分かりやすさを最優先し、同程度ならpositive、neutral、negativeの順にする。
- 固有名詞、極端に専門的・古風な語は、他に候補がある場合は避ける。
- meaningは入力の英語glossの範囲だけを自然な日本語で4〜60字にする。複数語義を勝手に混ぜない。
- 候補がない場合はcompoundsを空配列にする。数を満たすために不自然な語を選ばない。

入力:
${JSON.stringify(items)}`;
}

function buildReviewPrompt(items) {
  return `あなたは漢字辞典の厳格な校閲者です。sourceとdraftを照合し、事実外の連想、誤訳、不自然な熟語選択を修正してください。

厳守事項:
- sourceにない意味・象徴・熟語を追加しない。
- 熟語のwordとreadingはsource.compoundCandidatesの完全一致だけを許可する。
- 一般性を優先し、肯定的・中立的な語を先にする。ただし意味を美化しない。
- namingMeaningは18〜90字で、source.meaningとsource.summaryの範囲だけを使う。比喩、入力にない人物像、将来の結果を削除する。
- JSON配列だけを返す。形式はdraftと同じにする。

入力:
${JSON.stringify(items)}`;
}

function buildRepairPrompt(items) {
  return `漢字辞典の固定データ候補が自動検査で不合格になりました。sourceだけを根拠に、errorを解消してください。

厳守事項:
- namingMeaningは18〜90字。比喩、人物像、成功・幸福・人気など入力にない結果を追加しない。
- compoundsはsource.compoundCandidatesにあるwordだけを最大3語使う。word以外の候補を作らない。
- meaningは対応するglossの範囲だけを日本語にする。
- JSON配列だけを返す。形式は {"kanji":"字","namingMeaning":"本文。","compounds":[{"word":"熟語","reading":"よみ","meaning":"意味","tone":"positive|neutral|negative"}]}。

入力:
${JSON.stringify(items)}`;
}

async function processBatch(ai, sources) {
  const draftResponse = await generateJsonWithRetry(ai, buildDraftPrompt(sources));
  const drafts = draftResponse.data;
  const draftByKanji = new Map(drafts.map((entry) => [clean(entry.kanji), entry]));
  const reviewInput = sources.map((source) => ({
    source,
    draft: draftByKanji.get(source.kanji) || {},
  }));
  const reviewResponse = await generateJsonWithRetry(ai, buildReviewPrompt(reviewInput));
  const reviews = reviewResponse.data;
  const reviewByKanji = new Map(reviews.map((entry) => [clean(entry.kanji), entry]));

  const selectedByKanji = new Map();
  const repairInput = [];
  for (const source of sources) {
    const draft = sanitizeGeneratedEntry(source, draftByKanji.get(source.kanji) || {});
    const reviewed = sanitizeGeneratedEntry(source, reviewByKanji.get(source.kanji) || draft);
    const reviewedError = validateEntry(source, reviewed);
    const draftError = validateEntry(source, draft);
    const selected = reviewedError && !draftError ? draft : reviewed;
    const error = validateEntry(source, selected);
    if (error) repairInput.push({ source, candidate: selected, error });
    else selectedByKanji.set(source.kanji, selected);
  }

  let repairModel = '';
  if (repairInput.length > 0) {
    const repairResponse = await generateJsonWithRetry(ai, buildRepairPrompt(repairInput));
    repairModel = repairResponse.model;
    const repairs = repairResponse.data;
    const repairByKanji = new Map(repairs.map((entry) => [clean(entry.kanji), entry]));
    for (const item of repairInput) {
      selectedByKanji.set(
        item.source.kanji,
        sanitizeGeneratedEntry(item.source, repairByKanji.get(item.source.kanji) || {})
      );
    }
  }

  return sources.map((source) => {
    const accepted = selectedByKanji.get(source.kanji) || {};
    const error = validateEntry(source, accepted);
    if (error) throw new Error(error);
    return {
      kanji: source.kanji,
      entry: normalizeEntry(source, accepted, {
        model: draftResponse.model,
        reviewModel: repairModel || reviewResponse.model,
      }),
    };
  });
}

function buildSources() {
  const master = readJson(MASTER_PATH, []);
  const meaningDetails = readJson(MEANINGS_PATH, {});
  const compoundData = readJson(COMPOUNDS_PATH, { entries: {} });
  return master.map((row) => {
    const kanji = clean(row['漢字']);
    const detail = meaningDetails[kanji]?.meaning || row['意味'];
    return {
      kanji,
      summary: clean(row['意味']),
      meaning: clean(detail),
      inappropriate: Number(row['不適切フラグ']) === 1,
      compoundCandidates: (compoundData.entries?.[kanji] || [])
        .slice(0, MAX_COMPOUND_CANDIDATES)
        .map((item) => ({
          word: clean(item.word),
          reading: clean(item.reading),
          common: item.common === true,
          gloss: clean(item.glosses?.[0]),
        }))
        .filter((item) => item.word && item.reading && item.gloss),
    };
  });
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required');
  const ai = new GoogleGenAI({ apiKey });
  const sources = buildSources();
  const output = readJson(OUTPUT_PATH, {});
  const pending = [];

  for (const source of sources) {
    const cached = readJson(cachePathForKanji(source.kanji), null);
    const current = cached?.entry || output[source.kanji];
    const validationError = current?.generation?.version === ENRICHMENT_VERSION ? validateEntry(source, {
      kanji: source.kanji,
      namingMeaning: current.namingMeaning,
      compounds: current.compounds,
    }) : 'missing';
    if (!validationError) {
      output[source.kanji] = current;
      continue;
    }
    pending.push(source);
  }

  console.log(`Pending static enrichment: ${pending.length}`);
  const batches = [];
  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    batches.push(pending.slice(offset, offset + BATCH_SIZE));
  }
  for (let offset = 0; offset < batches.length; offset += CONCURRENCY) {
    const wave = batches.slice(offset, offset + CONCURRENCY);
    const waveResults = await Promise.all(wave.map((batch) => processBatch(ai, batch)));
    for (const results of waveResults) {
      for (const result of results) {
        output[result.kanji] = result.entry;
        writeJson(cachePathForKanji(result.kanji), result);
      }
    }
    writeJson(OUTPUT_PATH, output);
    const generated = Math.min((offset + wave.length) * BATCH_SIZE, pending.length);
    console.log(`Generated ${generated}/${pending.length}`);
  }

  writeJson(OUTPUT_PATH, output);
  console.log(JSON.stringify({ entries: Object.keys(output).length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

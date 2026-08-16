const fs = require("fs");
const path = require("path");
const vm = require("vm");

const geminiHandler = require("./gemini");

const SMOKE_TOKEN = "8d38b390-f351-4af3-9ee9-1da30dc6fe7d";

function readPromptBuilders() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "public", "js", "08-origin.js"),
    "utf8"
  );

  const between = (start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);
    if (startIndex < 0 || endIndex < 0) {
      throw new Error(`Prompt builder not found: ${start}`);
    }
    return source.slice(startIndex, endIndex);
  };

  const context = {
    currentBuildResult: null,
    getNameOriginGivenName: (result) => result.givenName || "",
    getNameOriginGivenReading: (result) => result.givenReading || "",
    getNameOriginSurnameValue: (result) => result.surname || "",
    getNameOriginSurnameReading: (result) => result.surnameYomi || "",
    getNameOriginCheckMaterials: (result) => result.checkMaterials || {},
    getNameOriginCombination: (result) => result.combination || [],
    getNameOriginKanjiValue: (part) => part.kanji || "",
    getNameOriginMeaning: (part) => part.meaning || "",
  };

  vm.createContext(context);
  vm.runInContext(
    between("function buildNameOriginPrompt", "async function generateOrigin"),
    context
  );
  vm.runInContext(
    between("function buildKanjiDetailPrompt", "function buildKanjiReadingPrompt"),
    context
  );
  vm.runInContext(
    between("function buildKanjiReadingPrompt", "function isMeaningSectionTooShallow"),
    context
  );
  return context;
}

function createPrompt(testId) {
  const builders = readPromptBuilders();
  const groundedHints = {
    rudder: {
      promptContext:
        "検証済みメモ: 「舵」は形声字として扱い、漢字構成は「舟」と「它」です。右側のつくりは「朶」でも「巴」でもありません。成り立ちの説明はこの検証済み情報から逸脱しないでください。",
    },
    oar: {
      promptContext:
        "検証済みメモ: 「櫂」は形声字として扱い、漢字構成は「木」と「翟」です。右側のつくりは「會」ではありません。成り立ちの説明はこの検証済み情報から逸脱しないでください。",
    },
  };

  const tests = {
    kanji_rudder: () =>
      builders.buildKanjiDetailPrompt(
        "舵",
        "タ ダ かじ",
        "かじ。船の舵。方向を決める。",
        "かじ。船の進行方向を操作するもの。",
        groundedHints.rudder
      ),
    kanji_oar: () =>
      builders.buildKanjiDetailPrompt(
        "櫂",
        "トウ かい かじ こずえ",
        "かい。船を漕ぐ道具。",
        "かい。かじ。船をすすめる道具。また、かいで船をすすめる。",
        groundedHints.oar
      ),
    kanji_meng: () =>
      builders.buildKanjiDetailPrompt(
        "孟",
        "ボウ マン モウ はじめ たけし",
        "はじめ。長男。大きい。",
        "かしら。兄弟の最年長者。季節や時代のはじめ。大きい。勇ましい。",
        null
      ),
    kanji_moe: () =>
      builders.buildKanjiDetailPrompt(
        "萌",
        "ホウ ボウ モウ もえる もえ",
        "もえる。芽生える。きざし。",
        "芽が出る。物事が起こり始める。きざし。民衆。",
        null
      ),
    reading_yu: () => builders.buildKanjiReadingPrompt("百", "ゆ"),
    reading_ki: () => builders.buildKanjiReadingPrompt("葵", "き"),
    name_yuki: () =>
      builders.buildNameOriginPrompt({
        givenName: "悠葵",
        givenReading: "ゆうき",
        surname: "正岡",
        surnameYomi: "まさおか",
        combination: [
          { kanji: "悠", meaning: "はるか。ゆったりとしている。どこまでも長く続く。" },
          { kanji: "葵", meaning: "あおい科の植物。" },
        ],
        checkMaterials: { readingClarity: "まれに読み違いがある可能性" },
      }),
    name_taichi: () =>
      builders.buildNameOriginPrompt({
        givenName: "泰知",
        givenReading: "たいち",
        surname: "正岡",
        surnameYomi: "まさおか",
        combination: [
          { kanji: "泰", meaning: "やすらか。おだやか。落ち着いている。" },
          { kanji: "知", meaning: "知る。理解する。知恵。" },
        ],
        checkMaterials: { readingClarity: "誰でも読める" },
      }),
    name_shinta: () =>
      builders.buildNameOriginPrompt({
        givenName: "心太",
        givenReading: "しんた",
        surname: "正岡",
        surnameYomi: "まさおか",
        combination: [
          { kanji: "心", meaning: "こころ。気持ち。思いやり。" },
          { kanji: "太", meaning: "大きい。豊か。たくましい。" },
        ],
        checkMaterials: { readingClarity: "まれに読み違いがある可能性" },
      }),
  };

  if (!tests[testId]) return null;
  return tests[testId]();
}

module.exports = async (req, res) => {
  if (req.method !== "GET" || req.query?.token !== SMOKE_TOKEN) {
    return res.status(404).json({ error: "Not found" });
  }

  const testId = String(req.query?.id || "");
  const prompt = createPrompt(testId);
  if (!prompt) return res.status(400).json({ error: "Unknown test" });

  let statusCode = 500;
  let payload = null;
  const fakeResponse = {
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

  await geminiHandler({ method: "POST", body: { prompt } }, fakeResponse);
  return res.status(statusCode).json({ testId, ...payload });
};

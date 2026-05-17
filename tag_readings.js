const XLSX = require('xlsx');

// ===== Axis 1: モーラカウント =====
function countMora(reading) {
  // 拗音の小文字（結合用）はカウントしない
  const combiningSmall = new Set(['ぁ','ぃ','ぅ','ぇ','ぉ','ゃ','ゅ','ょ','ゎ']);
  let count = 0;
  for (const c of reading) {
    if (!combiningSmall.has(c)) count++;
  }
  return count;
}

// ===== Axis 2: 先頭音タグ =====
function getFirstSoundTag(reading) {
  const first = reading[0];
  // #ふんわり → は行・や行（癒し・ゆったり）
  if ('はひふへほやゆよ'.includes(first)) return '#ふんわり';
  // #なごやか → な行（親しみ・愛されキャラ）
  if ('なにぬねの'.includes(first)) return '#なごやか';
  // #あたたかい → ま行（包容力・頼られキャラ）
  if ('まみむめも'.includes(first)) return '#あたたかい';
  // #クール → か行（ドライ・瞬発力）
  if ('かきくけこ'.includes(first)) return '#クール';
  // #爽やか → さ行（清潔感・スマート）
  if ('さしすせそ'.includes(first)) return '#爽やか';
  // #力強い → た行（パワフル・粘り強い）
  if ('たちつてと'.includes(first)) return '#力強い';
  if ('らりるれろ'.includes(first)) return '#華やか';
  if ('あお'.includes(first)) return '#のびのび';
  if (first === 'い') return '#ひたむき';
  if ('うえ'.includes(first)) return '#繊細';
  if ('がぎぐげごだぢづでど'.includes(first)) return '#存在感';
  if ('ざじずぜぞばびぶべぼぱぴぷぺぽわ'.includes(first)) return '#はつらつ';
  return '#不明';
}

// ===== Axis 3: 止め字・時代感 =====
const STOP_ENDING_RULES = [
  ['じゅうろう', '#止め字ろう'],
  ['いちろう', '#止め字ろう'],
  ['ごろう', '#止め字ろう'],
  ['たろう', '#止め字ろう'],
  ['じろう', '#止め字ろう'],
  ['さぶろう', '#止め字ろう'],
  ['しろう', '#止め字ろう'],
  ['ろう', '#止め字ろう'],
  ['のすけ', '#止め字すけ'],
  ['すけ', '#止め字すけ'],
  ['ぞう', '#止め字ぞう'],
  ['ひこ', '#止め字ひこ'],
  ['きち', '#止め字きち'],
  ['いち', '#止め字いち'],
  ['へい', '#止め字へい'],
  ['せい', '#止め字せい'],
  ['しん', '#止め字しん'],
  ['と', '#止め字と'],
  ['ま', '#止め字ま'],
  ['た', '#止め字た'],
  ['や', '#止め字や'],
  ['ご', '#止め字ご'],
  ['じ', '#止め字じ'],
  ['き', '#止め字き'],
  ['か', '#止め字か'],
  ['り', '#止め字り'],
  ['な', '#止め字な'],
  ['ら', '#止め字ら'],
  ['は', '#止め字は'],
  ['ね', '#止め字ね'],
  ['の', '#止め字の'],
  ['ほ', '#止め字ほ'],
  ['こ', '#止め字こ'],
  ['よ', '#止め字よ'],
  ['ん', '#止め字ん'],
  ['お', '#止め字お'],
  ['う', '#止め字う'],
];

const CLASSIC_MALE_ENDINGS = new Set([
  'ろう', 'すけ', 'ぞう', 'ひこ', 'きち', 'いち', 'えもん', 'べえ',
]);
const STRONG_RETRO_MALE_ENDINGS = new Set([
  'たろう', 'じろう', 'さぶろう', 'しろう', 'のすけ', 'ぞう', 'ひこ', 'えもん', 'べえ',
]);
const CLASSIC_FEMALE_ENDINGS = new Set(['こ', 'よ']);
const RETRO_MODERN_READINGS = new Set([
  'りこ', 'にこ', 'ここ', 'みこ', 'あこ', 'なこ', 'ひなこ', 'まこ', 'のこ',
]);

// ===== Axis 4: 自然モチーフ =====
// 「自然語」は前後一致で広がりすぎるため、検索タグとしては強いモチーフだけに絞る。
const NATURAL_EXACT = new Set([
  'あお', 'あおい', 'あき', 'あさ', 'あめ', 'いずみ', 'うみ', 'かえで', 'かすみ',
  'かぜ', 'くるみ', 'さくら', 'しぶき', 'すみれ', 'そら', 'つき', 'つばめ',
  'なぎ', 'なつ', 'なみ', 'にじ', 'はな', 'はる', 'ひかり', 'ふゆ', 'ほし',
  'ほたる', 'みず', 'みなと', 'もみじ', 'もも', 'ゆき',
]);
const NATURAL_COMPOUND_STEMS = [
  'あお', 'あさ', 'うみ', 'かえで', 'さくら', 'そら', 'つき', 'なぎ', 'なつ',
  'はな', 'はる', 'ひかり', 'ふゆ', 'みず', 'みなと', 'もも',
];

// ===== Axis 5: 国際風ホワイトリスト（完全一致）=====
const INTERNATIONAL = new Set([
  'あいら', 'あんな', 'あんじゅ', 'ありさ', 'ありす', 'えま', 'えみり',
  'えりあ', 'えりか', 'えりさ', 'えりん', 'えれな', 'かれん', 'きあら',
  'さら', 'せれな', 'そふぃあ', 'のあ', 'まりあ', 'まりえ', 'まりな',
  'まりん', 'みあ', 'らいあ', 'らら', 'りあ', 'りお', 'りな', 'りり',
  'りりあ', 'るい', 'るか', 'るな', 'れお', 'れな', 'れみ',
]);

function getStopEndingTag(reading) {
  const match = STOP_ENDING_RULES.find(([ending]) => reading.endsWith(ending));
  return match ? match[1] : '';
}

function endsWithAny(reading, endings) {
  return [...endings].some((ending) => reading.endsWith(ending));
}

function isClassicReading(reading, gender) {
  if (gender === 'male') {
    if (endsWithAny(reading, CLASSIC_MALE_ENDINGS)) return true;
    return reading.endsWith('お') && countMora(reading) >= 4;
  }
  if (gender === 'female') {
    return endsWithAny(reading, CLASSIC_FEMALE_ENDINGS);
  }
  return false;
}

function isStrongRetroReading(reading, gender) {
  if (gender === 'male') return endsWithAny(reading, STRONG_RETRO_MALE_ENDINGS);
  if (gender === 'female') {
    if (!endsWithAny(reading, CLASSIC_FEMALE_ENDINGS)) return false;
    return !RETRO_MODERN_READINGS.has(reading);
  }
  return false;
}

function isModernReading(reading, gender, mora) {
  if (isClassicReading(reading, gender)) return false;
  if (mora <= 2 && !reading.endsWith('よ') && !reading.endsWith('こ')) return true;
  if (gender === 'male') {
    return ['と', 'ま', 'た', 'や'].some((ending) => reading.endsWith(ending));
  }
  if (gender === 'female') {
    return ['な', 'ら', 'の', 'ね', 'は'].some((ending) => reading.endsWith(ending));
  }
  return ['と', 'な', 'ら', 'あ', 'お', 'く'].some((ending) => reading.endsWith(ending));
}

function hasNaturalMotif(reading) {
  if (NATURAL_EXACT.has(reading)) return true;
  const mora = countMora(reading);
  return mora <= 4 && NATURAL_COMPOUND_STEMS.some((stem) =>
    reading.startsWith(stem) || reading.endsWith(stem)
  );
}

// ===== メインタグ付けロジック =====
function getTags(reading, gender, neutralFlag) {
  if (!reading || typeof reading !== 'string') return '';
  const tags = [];
  const mora = countMora(reading);

  // ── Axis 1: 長さ ──
  if (mora <= 2) tags.push('#ショート');
  else if (mora >= 5) tags.push('#ロング');

  // ── Axis 2: 先頭音 ──
  tags.push(getFirstSoundTag(reading));

  // ── Axis 3: 止め字・時代感 ──
  const stopTag = getStopEndingTag(reading);
  if (stopTag) tags.push(stopTag);

  if (isClassicReading(reading, gender)) tags.push('#クラシック');
  if (isStrongRetroReading(reading, gender)) tags.push('#レトロ');
  if (RETRO_MODERN_READINGS.has(reading)) tags.push('#レトロモダン');
  if (isModernReading(reading, gender, mora)) tags.push('#今風');

  // ── Axis 4: 自然モチーフ（広すぎる自然語タグは使わない）──
  if (hasNaturalMotif(reading)) tags.push('#自然モチーフ');

  // ── Axis 5: 国際風（完全一致）──
  if (INTERNATIONAL.has(reading)) tags.push('#国際風');

  // ── Axis 6: 中性的 ──
  if (neutralFlag && String(neutralFlag).trim().length > 0) tags.push('#中性的');

  return tags.join(' ');
}

// ===== 処理実行 =====
const INPUT  = '読み方リスト_精緻化済.xlsx';
const OUTPUT = '読み方リスト_タグ付き.xlsx';

const wb    = XLSX.readFile(INPUT);
const wbOut = XLSX.utils.book_new();

let totalProcessed = 0;
const tagStats = {};

for (const sheetName of wb.SheetNames) {
  const gender = sheetName.startsWith('male') ? 'male' : 'female';
  const ws   = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // ヘッダーにtagsを追加
  data[0] = [...data[0], 'tags'];

  for (let i = 1; i < data.length; i++) {
    const row     = data[i];
    const reading = row[0];
    const neutral = row[4];
    const tagStr  = getTags(reading, gender, neutral);
    data[i] = [...row, tagStr];

    // 統計
    if (tagStr) {
      tagStr.split(' ').forEach(t => {
        tagStats[t] = (tagStats[t] || 0) + 1;
      });
      totalProcessed++;
    }
  }

  const wsOut = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wbOut, wsOut, sheetName);
}

XLSX.writeFile(wbOut, OUTPUT);

console.log(`\n✅ 完了: ${OUTPUT}`);
console.log(`処理件数: ${totalProcessed.toLocaleString()} 件\n`);
console.log('── タグ分布 ──');
Object.entries(tagStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([tag, count]) => {
    console.log(`  ${tag.padEnd(12)} ${count.toLocaleString()} 件`);
  });

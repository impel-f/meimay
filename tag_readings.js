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

// ===== Axis 4: 自然語ホワイトリスト（前方一致 or 後方一致）=====
// ※ しお・ゆう・たけ は除外（誤ヒット多のため）
// ※ 中間一致を廃止し、前方一致(startsWith) or 後方一致(endsWith) のみ
const SHIZEN_GO = [
  // 天体・空
  'そら', 'つき', 'ほし', 'ひかり', 'かぜ', 'ゆき', 'にじ', 'きり', 'かすみ', 'あめ',
  // 水・海
  'うみ', 'なみ', 'みず', 'いずみ', 'みなと', 'しぶき',
  // 植物
  'はな', 'さくら', 'もも', 'うめ', 'ふじ', 'あおい', 'すみれ', 'くるみ', 'かえで',
  'もみじ', 'まつ', 'かつら',
  // 動物・虫
  'ほたる', 'つばめ',
  // 季節・時間
  'はる', 'なつ', 'あき', 'ふゆ', 'あさ',
  // 地形
  'もり', 'やま', 'いわ', 'みね',
  // その他
  'なぎ',
];

// ===== Axis 5: 海外風ホワイトリスト（完全一致）=====
const KAIGAI_FU = new Set([
  // 明確な洋名
  'えま', 'えみり', 'るか', 'りあ', 'あんな', 'のあ', 'れお', 'ありす', 'まりあ',
  'るな', 'らら', 'えれな', 'りりあ', 'おりびあ', 'そふぃあ', 'あめりあ',
  'えみりあ', 'まりん', 'えりん', 'あいら', 'きあら', 'えりあ',
  'あんじゅ', 'らいあ', 'りり',
  // 和洋どちらともOK
  'えりか', 'りな', 'るい', 'まりえ', 'れみ', 'りお', 'みあ', 'えりさ', 'ありさ', 'まりな', 'せれな',
]);

// ===== Axis 3: レトロ語尾 =====
const MALE_RETRO_ENDINGS   = ['たろう','じろう','さぶろう','しろう','のすけ','すけ','ぞう','ひこ','えもん','べえ'];
const FEMALE_RETRO_ENDINGS = ['こ','よ'];

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

  // ── Axis 3: 時代感 ──
  let isRetro = false;
  if (gender === 'male') {
    for (const e of MALE_RETRO_ENDINGS) {
      if (reading.endsWith(e)) { isRetro = true; break; }
    }
    // 〜お かつ 4拍以上（としお、まさお等）
    if (!isRetro && reading.endsWith('お') && mora >= 4) isRetro = true;
  }
  if (gender === 'female') {
    for (const e of FEMALE_RETRO_ENDINGS) {
      if (reading.endsWith(e)) { isRetro = true; break; }
    }
  }

  let isModern = false;
  if (!isRetro) {
    if (mora <= 2) isModern = true;
    if (gender === 'male'   && reading.endsWith('と')) isModern = true;
    if (gender === 'female' && (reading.endsWith('な') || reading.endsWith('ら'))) isModern = true;
  }

  if (isRetro)       tags.push('#レトロ');
  else if (isModern) tags.push('#今風');

  // ── Axis 4: 自然語（前方一致 or 後方一致）──
  if (SHIZEN_GO.some(w => reading.startsWith(w) || reading.endsWith(w))) tags.push('#自然語');

  // ── Axis 5: 海外風（完全一致）──
  if (KAIGAI_FU.has(reading)) tags.push('#海外風');

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

/**
 * split_nanori.js
 *
 * KanjiDic2 (kanjidic2-en-*.json) と読み出現頻度を組み合わせて
 * 各漢字の 名乗り_メジャー / 名乗り_マイナー を分割する。
 *
 * 判定ロジック（OR条件でどれか1つでも当てはまればメジャー）:
 *   1. KD2 nanori に含まれる読み
 *   2. KD2 ja_on (カタカナ→ひらがな) に含まれる読み
 *   3. KD2 ja_kun (送り仮名除去・全体両方) に含まれる読み
 *   4. 全データ中で FREQ_THRESHOLD 字以上の漢字に使われる読み（頻出名前パーツ）
 *
 * 前処理:
 *   - （なし）、(なし) 等のプレースホルダーは読みとして除外
 *
 * Usage:
 *   node scripts/split_nanori.js [/path/to/kanjidic2-en-*.json]
 *   ※ 引数省略時は /tmp/kanjidic2-en-3.6.2.json を使用
 *
 * 出典: KANJIDIC2 (CC BY-SA 4.0) - https://www.edrdg.org/kanjidic/kanjd2index.html
 */

var fs   = require('fs');
var path = require('path');

var KD2_PATH  = process.argv[2] || '/tmp/kanjidic2-en-3.6.2.json';
var DATA_PATH = path.join(__dirname, '../public/data/kanji_data.json');

// 頻出読みの閾値: この数以上の漢字で使われる読みはメジャーとみなす
var FREQ_THRESHOLD = 5;

// 読みとして無効なプレースホルダーやローマ字
function isPlaceholder(r) {
  if (!r) return true;
  if (/[（(]/.test(r)) return true;
  if (r === '-') return true;
  // ローマ字（ASCII英字のみ）
  if (/^[a-zA-Z, ]+$/.test(r)) return true;
  return false;
}

// ── ユーティリティ ────────────────────────────────────────────
function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, function(m) {
    return String.fromCharCode(m.charCodeAt(0) - 0x60);
  });
}

// ── KD2 読みマップ構築 ────────────────────────────────────────
console.log('KD2 読み込み中...');
var kd2 = JSON.parse(fs.readFileSync(KD2_PATH, 'utf8'));

// kanji → Set<読み> (nanori + on + kun)
var kd2ReadMap = {};

kd2.characters.forEach(function(c) {
  if (!c.readingMeaning) return;
  var reads = new Set();

  // nanori（名乗り読み）
  (c.readingMeaning.nanori || []).forEach(function(r) {
    reads.add(r);
  });

  // ja_on / ja_kun
  (c.readingMeaning.groups || []).forEach(function(g) {
    (g.readings || []).forEach(function(r) {
      if (r.type === 'ja_on') {
        reads.add(katakanaToHiragana(r.value));
      } else if (r.type === 'ja_kun') {
        var raw = katakanaToHiragana(r.value);
        // 全体（ドット除去）: かけ.る → かける
        reads.add(raw.replace(/\./g, '').replace(/-/g, ''));
        // ステム（ドット以降除去）: かけ.る → かけ
        var stem = raw.replace(/[.\-].*$/, '').replace(/\s/g, '');
        if (stem) reads.add(stem);
      }
    });
  });

  kd2ReadMap[c.literal] = reads;
});

console.log('KD2 収録漢字数:', Object.keys(kd2ReadMap).length);

// ── kanji_data.json 読み込み ──────────────────────────────────
console.log('kanji_data.json 読み込み中...');
var data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// ── 読み出現頻度マップ構築 ────────────────────────────────────
// 伝統名のり フィールドから全読みの出現頻度を集計
var readingFreq = {};

data.forEach(function(entry) {
  var src = entry['伝統名のり'] || entry['名乗り_メジャー'] || '';
  var reads = src.split(/[、,，\s]+/)
    .map(function(r){ return r.trim(); })
    .filter(function(r){ return r && !isPlaceholder(r); });

  reads.forEach(function(r) {
    readingFreq[r] = (readingFreq[r] || 0) + 1;
  });
});

// 頻出読みセット（FREQ_THRESHOLD 以上）
var freqMajorSet = new Set(
  Object.keys(readingFreq).filter(function(r) {
    return readingFreq[r] >= FREQ_THRESHOLD;
  })
);
console.log('頻出読み(' + FREQ_THRESHOLD + '字以上):', freqMajorSet.size, '種類');

// ── 分割処理 ──────────────────────────────────────────────────
var stats = {
  total: 0,
  moved: 0,
  movedCount: 0,
  noKD2: 0,
};

data.forEach(function(entry) {
  var kanji = entry['漢字'];
  var majorStr = entry['名乗り_メジャー'] || '';
  if (!majorStr.trim()) return;

  stats.total++;

  // プレースホルダー除去 + 読み分割
  var readings = majorStr.split('、')
    .map(function(r){ return r.trim(); })
    .filter(function(r){ return r && !isPlaceholder(r); });

  // CJK互換漢字（FA00-FAFF等）はNFKC正規化して標準コードポイントに変換
  var kanjiNorm = kanji.normalize('NFKC');
  var kd2Reads = kd2ReadMap[kanjiNorm] || kd2ReadMap[kanji];

  var major = [];
  var minor = [];

  readings.forEach(function(r) {
    var inKD2 = kd2Reads && kd2Reads.has(r);
    var isFreq = freqMajorSet.has(r);

    if (inKD2 || isFreq) {
      major.push(r);
    } else {
      minor.push(r);
    }
  });

  entry['名乗り_メジャー'] = major.join('、');
  entry['名乗り_マイナー'] = minor.join('、');

  if (minor.length > 0) {
    stats.moved++;
    stats.movedCount += minor.length;
  }
});

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

// ── サマリー ─────────────────────────────────────────────────
console.log('\n=== 完了 ===');
console.log('処理エントリ数   :', stats.total);
console.log('マイナー分類あり :', stats.moved, '漢字');
console.log('マイナー読み合計 :', stats.movedCount, '件');

var withBoth = data.filter(function(e){
  return (e['名乗り_メジャー']||'').trim() && (e['名乗り_マイナー']||'').trim();
});
var majorOnly = data.filter(function(e){
  return (e['名乗り_メジャー']||'').trim() && !(e['名乗り_マイナー']||'').trim();
});
var minorOnly = data.filter(function(e){
  return !(e['名乗り_メジャー']||'').trim() && (e['名乗り_マイナー']||'').trim();
});
console.log('\nメジャー+マイナー両あり :', withBoth.length, '漢字');
console.log('メジャーのみ             :', majorOnly.length, '漢字');
console.log('マイナーのみ（要確認）   :', minorOnly.length, '漢字');

console.log('\n--- サンプル確認 ---');
['一', '愛', '花', '翔', '陽', '海', '山', '丁', '工', '才'].forEach(function(k) {
  var e = data.find(function(d){ return d['漢字'] === k; });
  if (e) {
    console.log(k, '\n  メジャー:', e['名乗り_メジャー'] || '(なし)');
    console.log('  マイナー:', e['名乗り_マイナー'] || '(なし)');
  }
});

// マイナーのみ漢字サンプル
if (minorOnly.length > 0) {
  console.log('\n--- マイナーのみになった漢字サンプル ---');
  minorOnly.slice(0, 5).forEach(function(e) {
    console.log(e['漢字'], ':', e['名乗り_マイナー']);
  });
}

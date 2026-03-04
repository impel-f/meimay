const XLSX = require('xlsx');

const SEIKEI  = '読み方リスト_整形済.xlsx';
const TAGGED  = '読み方リスト_タグ付き.xlsx';
const OUTPUT  = '読み方リスト_タグ付き.xlsx'; // 上書き

const wbSeikei = XLSX.readFile(SEIKEI);
const wbTagged = XLSX.readFile(TAGGED);
const wbOut    = XLSX.utils.book_new();

// 整形済から 読み → 名前例 のマップを作成
function buildMap(wb, sheetName) {
  const map = {};
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }).slice(1);
  for (const r of rows) {
    if (r[0]) map[String(r[0])] = r[3] != null ? String(r[3]) : '';
  }
  return map;
}

let fixed = 0;
let noMatch = 0;

for (const sheetName of wbTagged.SheetNames) {
  const seikeiMap = buildMap(wbSeikei, sheetName);
  const rows = XLSX.utils.sheet_to_json(wbTagged.Sheets[sheetName], { header: 1 });

  for (let i = 1; i < rows.length; i++) {
    const reading = String(rows[i][0] || '');
    if (!reading) continue;

    const current  = String(rows[i][3] || '');
    const seikei   = seikeiMap[reading];

    if (seikei === undefined) {
      // 整形済に存在しない読み → そのまま
      noMatch++;
      continue;
    }

    // 漢字内容（スペース除去）が一致するか確認
    const currentKanji = current.replace(/ /g, '');
    const seikeiKanji  = seikei.replace(/ /g, '');

    if (currentKanji === seikeiKanji && current !== seikei) {
      // 内容同じでスペース位置だけ違う → 整形済で上書き
      rows[i][3] = seikei;
      fixed++;
    } else if (currentKanji !== seikeiKanji && seikei.length > 0) {
      // 内容も違う → 整形済を優先（整形済の方が信頼性高い）
      rows[i][3] = seikei;
      fixed++;
    }
    // current === seikei の場合はすでに正しいのでスキップ
  }

  const wsOut = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wbOut, wsOut, sheetName);
}

XLSX.writeFile(wbOut, OUTPUT);

console.log('完了:', OUTPUT);
console.log('修正件数:', fixed, '件');
console.log('整形済に存在しない読み:', noMatch, '件');

const XLSX = require('xlsx');

const wbP = XLSX.readFile('読み方リスト_精緻化済.xlsx');
const wbS = XLSX.readFile('読み方リスト_整形済.xlsx');
const wbT = XLSX.readFile('読み方リスト_タグ付き.xlsx');
const wbOut = XLSX.utils.book_new();

// 読み → 名前例 マップを作る
function buildMap(wb, sheet) {
  const map = {};
  XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 }).slice(1).forEach(r => {
    if (r[0]) map[String(r[0])] = String(r[3] || '');
  });
  return map;
}

// 正しいchunkSizeで先頭2件取得
function getTop2(kanjiStr, chunkSize) {
  const result = [];
  for (let i = 0; i < kanjiStr.length && result.length < 2; i += chunkSize) {
    const chunk = kanjiStr.slice(i, i + chunkSize);
    if (chunk.length === chunkSize) result.push(chunk);
  }
  return result.join(' ');
}

let fixed = 0;

for (const sheet of wbT.SheetNames) {
  const mapP = buildMap(wbP, sheet); // 精緻化済
  const mapS = buildMap(wbS, sheet); // 整形済

  const rows = XLSX.utils.sheet_to_json(wbT.Sheets[sheet], { header: 1 });

  for (let i = 1; i < rows.length; i++) {
    const reading = String(rows[i][0] || '');
    if (!reading) continue;

    const rawP = mapP[reading] || '';
    const rawS = mapS[reading] || '';

    // スペースを除いた純粋な漢字列（精緻化済ベース）
    const kanjiStr = rawP.replace(/ /g, '');
    if (!kanjiStr) continue;

    // 整形済のトークン
    const tokensS = rawS.split(' ').filter(t => t.length > 0);
    // 精緻化済の最初の2トークン
    const tokensP = rawP.split(' ').filter(t => t.length > 0);

    const firstS  = tokensS[0] || '';
    const secondS = tokensS[1] || '';
    const firstP  = tokensP[0] || '';
    const secondP = tokensP[1] || '';

    let top2 = rows[i][3]; // デフォルト：現状維持

    if (firstS.length === 1) {
      // ① 整形済が1字始まり → 単漢字読み、整形済がそのまま正しい
      top2 = tokensS.slice(0, 2).join(' ');

    } else if (firstS.length === 2 && firstP.length === 1 && secondP.length === 1) {
      // ② 整形済が2字だが精緻化済が1字スタート → 単漢字名を2字に誤連結
      // 精緻化済の単漢字トークンを先頭から2つ取る
      const singles = tokensP.filter(t => t.length === 1);
      top2 = singles.slice(0, 2).join(' ');

    } else if (firstS.length === 2 && firstP.length === 1 && secondP.length >= 2) {
      // ③ 整形済が2字、精緻化済が混在 → 2字名として整形済を使う
      top2 = tokensS.slice(0, 2).join(' ');

    } else if (firstS.length >= 2) {
      // ④ 整形済が2字以上 → chunkSizeを推定して再分割
      // 精緻化済の全漢字数 ÷ 整形済のトークン数で1名あたりの漢字数を推定
      const estimatedChunk = Math.round(kanjiStr.length / tokensS.length);
      const chunkSize = Math.max(1, Math.min(4, estimatedChunk));
      top2 = getTop2(kanjiStr, chunkSize);
    }

    if (top2 !== String(rows[i][3])) {
      rows[i][3] = top2;
      fixed++;
    }
  }

  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(rows), sheet);
}

XLSX.writeFile(wbOut, '読み方リスト_タグ付き.xlsx');
console.log('完了: 読み方リスト_タグ付き.xlsx');
console.log('修正件数:', fixed, '件');

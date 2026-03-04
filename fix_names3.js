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

// モーラカウント（拗音小文字はカウントしない）
function countMora(reading) {
  const combiningSmall = new Set(['ぁ','ぃ','ぅ','ぇ','ぉ','ゃ','ゅ','ょ','ゎ']);
  let count = 0;
  for (const c of reading) {
    if (!combiningSmall.has(c)) count++;
  }
  return count;
}

let fixed = 0;
const fixLog = [];

for (const sheet of wbT.SheetNames) {
  const mapP = buildMap(wbP, sheet);
  const mapS = buildMap(wbS, sheet);
  const isFemale = sheet.startsWith('female');

  const rows = XLSX.utils.sheet_to_json(wbT.Sheets[sheet], { header: 1 });

  for (let i = 1; i < rows.length; i++) {
    const current = String(rows[i][3] || '');

    // 「x y」形式（1字 + 1字）のみ対象
    const curTok = current.split(' ').filter(t => t.length > 0);
    if (curTok.length !== 2 || curTok[0].length !== 1 || curTok[1].length !== 1) continue;

    const reading = String(rows[i][0] || '');
    if (!reading) continue;

    const rawP = mapP[reading] || '';
    const rawS = mapS[reading] || '';

    const tokensP = rawP.split(' ').filter(t => t.length > 0);
    const tokensS = rawS.split(' ').filter(t => t.length > 0);

    const firstP  = tokensP[0] || '';
    const secondP = tokensP[1] || '';
    const firstS  = tokensS[0] || '';

    // case② の条件: 整形済が2字始まり、精緻化済の先頭2つが1字ずつ
    if (firstS.length !== 2 || firstP.length !== 1 || secondP.length !== 1) continue;

    // 精緻化済で最初の2字以上トークンの位置を探す
    const pos2 = tokensP.findIndex(t => t.length >= 2);
    const mora = countMora(reading);

    let newTop2 = current; // デフォルト：変更なし

    if (pos2 === -1) {
      // 精緻化済が全て1字 → 1字名（さとし, まこと など）→ そのまま
      newTop2 = current;

    } else if (pos2 === 2) {
      // 精緻化済: [A(1), B(1), C(2+), ...] パターン
      // A+B が第1名、C が第2名（2字名オフセットバグ修正）
      // 女性: mora>=3 で適用（女性3拍以上は単字名がほぼない）
      // 男性: mora>=4 で適用（4拍以上なら単字名は考えにくい）
      const applyFix = isFemale ? (mora >= 3) : (mora >= 4);
      if (applyFix) {
        const name1 = tokensP[0] + tokensP[1];
        const name2 = tokensP[2];
        newTop2 = name1 + ' ' + name2;
      } else {
        newTop2 = current; // 短い読み（2拍以下男性など）は1字名のままにする
      }

    } else if (pos2 >= 3 && isFemale) {
      // 女性: 先頭2字以上のトークンより前に3個以上の1字トークンがある場合
      // 多字名（3字名など）またはさらに複雑なケース
      // 整形済の先頭2トークンを使用（2字固定チャンクだが「x y」よりまし）
      if (tokensS.length >= 2) {
        newTop2 = tokensS.slice(0, 2).join(' ');
      } else if (tokensS.length === 1) {
        newTop2 = tokensS[0];
      } else {
        newTop2 = current;
      }

    } else {
      // 男性 pos2>=3: 1字名のままにする（博 弘, 陸 理 など）
      newTop2 = current;
    }

    if (newTop2 !== current) {
      fixLog.push(`  ${sheet} row${i}: ${reading} [${current}] → [${newTop2}]  (pos2=${pos2}, mora=${mora})`);
      rows[i][3] = newTop2;
      fixed++;
    }
  }

  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(rows), sheet);
}

XLSX.writeFile(wbOut, '読み方リスト_タグ付き.xlsx');
console.log('完了: 読み方リスト_タグ付き.xlsx');
console.log('修正件数:', fixed, '件');
console.log('\n── サンプル修正ログ（先頭30件）──');
fixLog.slice(0, 30).forEach(l => console.log(l));

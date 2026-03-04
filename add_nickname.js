const XLSX = require('xlsx');

// 先頭2モーラを抽出してニックネームとする
// 拗音の小文字（ゃゅょぁぃぅぇぉゎ）は単独でモーラを作らない
function getNickname(reading) {
  const combiningSmall = new Set(['ぁ','ぃ','ぅ','ぇ','ぉ','ゃ','ゅ','ょ','ゎ']);
  let mora = 0;
  let i = 0;
  while (i < reading.length && mora < 2) {
    if (!combiningSmall.has(reading[i])) mora++;
    i++;
  }
  return reading.slice(0, i);
}

const wb = XLSX.readFile('C:\\Users\\8mits\\Documents\\meimay-C\\読み方リスト_タグ付き.xlsx');
const wbOut = XLSX.utils.book_new();

let total = 0;
const samples = [];

for (const sheet of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 });

  // ヘッダー行にあだな列を追加
  if (rows[0]) rows[0].push('あだな');

  for (let i = 1; i < rows.length; i++) {
    const reading = String(rows[i][0] || '');
    const nick = reading ? getNickname(reading) : '';
    rows[i].push(nick);
    total++;
    if (samples.length < 20) samples.push(`${reading} → ${nick}`);
  }

  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(rows), sheet);
}

XLSX.writeFile(wbOut, 'C:\\Users\\8mits\\Documents\\meimay-C\\読み方リスト_タグ付き.xlsx');
console.log('完了: あだな列を追加しました（' + total + '件）\n');
console.log('── サンプル（male冒頭20件）──');
samples.forEach(s => console.log(' ' + s));

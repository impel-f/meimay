const XLSX = require('xlsx');

const FILE = '読み方リスト_タグ付き.xlsx';
const wb   = XLSX.readFile(FILE);
const wbOut = XLSX.utils.book_new();

let trimmed = 0;

for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

  for (let i = 1; i < rows.length; i++) {
    const raw = String(rows[i][3] || '');
    if (!raw) continue;

    // スペースで分割して先頭2トークンだけ残す
    const tokens = raw.split(' ').filter(t => t.length > 0);
    const top2   = tokens.slice(0, 2).join(' ');

    if (top2 !== raw) trimmed++;
    rows[i][3] = top2;
  }

  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(rows), sheetName);
}

XLSX.writeFile(wbOut, FILE);
console.log('完了:', FILE);
console.log('名前例を2件に絞った行数:', trimmed);

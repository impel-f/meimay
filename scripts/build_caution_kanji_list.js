const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const CSV_PATH = path.join(ROOT, 'kanji_caution_list.csv');
const XLSX_PATH = path.join(ROOT, 'kanji_caution_list.xlsx');

const KANJI = '\u6f22\u5b57';
const STROKES = '\u753b\u6570';
const JOYO = '\u5e38\u7528\u6f22\u5b57';
const ON = '\u97f3';
const KUN = '\u8a13';
const NANORI = '\u4f1d\u7d71\u540d\u306e\u308a';
const MEANING = '\u610f\u5473';
const CLASS = '\u5206\u985e';
const SCORE = '\u304a\u3059\u3059\u3081\u5ea6';
const MALE_SCORE = '\u7537\u306e\u304a\u3059\u3059\u3081\u5ea6';
const FEMALE_SCORE = '\u5973\u306e\u304a\u3059\u3059\u3081\u5ea6';
const FLAG = '\u4e0d\u9069\u5207\u30d5\u30e9\u30b0';

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isCautionFlag(value) {
  return !!(value && value !== '0' && value !== 0 && value !== false && value !== 'false' && value !== 'FALSE');
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (value === 0) return '';
  return value;
}

function buildRows(data) {
  return data
    .filter((row) => isCautionFlag(row[FLAG]))
    .map((row) => ({
      '漢字': normalizeCell(row[KANJI]),
      '画数': normalizeCell(row[STROKES]),
      '常用漢字': row[JOYO] === true ? '常用' : '',
      '音': normalizeCell(row[ON]),
      '訓': normalizeCell(row[KUN]),
      '伝統名のり': normalizeCell(row[NANORI]),
      '分類': normalizeCell(row[CLASS]),
      '意味': normalizeCell(row[MEANING]),
      '総合スコア': normalizeCell(row[SCORE]),
      '男スコア': normalizeCell(row[MALE_SCORE]),
      '女スコア': normalizeCell(row[FEMALE_SCORE]),
      '判定': '要注意',
      '見直しメモ': '',
    }))
    .sort((a, b) => String(a['漢字']).localeCompare(String(b['漢字']), 'ja'));
}

function writeCsv(rows, filePath) {
  const headers = Object.keys(rows[0] || {});
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function writeWorkbook(rows, filePath) {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    { key: 'source', value: path.relative(ROOT, SOURCE_PATH) },
    { key: 'caution_count', value: rows.length },
    { key: 'generated_at', value: new Date().toISOString() },
  ];

  appendSheet(workbook, 'caution_list', rows);
  appendSheet(workbook, 'summary', summaryRows);
  XLSX.writeFile(workbook, filePath);
}

function appendSheet(workbook, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const sample = rows[0] || {};
  sheet['!cols'] = Object.keys(sample).map((key) => ({
    wch: Math.min(Math.max(String(key).length + 4, 14), 40),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function main() {
  const source = loadJson(SOURCE_PATH);
  const rows = buildRows(source);

  writeCsv(rows, CSV_PATH);
  writeWorkbook(rows, XLSX_PATH);

  console.log(`Wrote ${rows.length} caution kanji to ${CSV_PATH}`);
  console.log(`Wrote caution kanji workbook to ${XLSX_PATH}`);
}

main();

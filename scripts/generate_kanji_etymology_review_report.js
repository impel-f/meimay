const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const FACTS_PATH = path.join(ROOT, 'public', 'data', 'kanji_etymology_facts.json');
const OUTPUT_DIR = path.join(ROOT, 'review');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'kanji-etymology-review.html');

const master = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
const facts = JSON.parse(fs.readFileSync(FACTS_PATH, 'utf8')).entries || {};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getReviewState(entry) {
  if (entry?.verificationStatus === 'cross_checked' && entry?.fixedOriginText) {
    return {
      id: 'reviewed',
      label: '公開可能',
      detail: '2系統以上で照合し、表示文を確定済み'
    };
  }
  if (
    entry?.verificationStatus === 'cross_checked'
    && Array.isArray(entry?.formationTypes)
    && entry.formationTypes.length
    && entry?.semanticComponent
    && entry?.phoneticComponent
  ) {
    return {
      id: 'reviewed-structured',
      label: '公開可能（構造化）',
      detail: '2系統以上で構成を照合済み。固定文は未作成'
    };
  }
  if (entry?.verificationStatus === 'single_source') {
    return {
      id: 'needs-cross-check',
      label: '要追加確認',
      detail: '1系統の字源情報のみ確認済み'
    };
  }
  return {
    id: 'unreviewed',
    label: '未検証',
    detail: '部品検索用データのみ。成り立ちとしては使用禁止'
  };
}

function buildOriginText(kanji, entry) {
  if (entry?.fixedOriginText) return entry.fixedOriginText;
  if (
    entry?.verificationStatus === 'cross_checked'
    && entry?.formationTypes?.length === 1
    && entry.formationTypes[0] === '形声'
    && entry.semanticComponent
    && entry.phoneticComponent
  ) {
    return `「${kanji}」は、意味を表す「${entry.semanticComponent}」と、音を表す「${entry.phoneticComponent}」を組み合わせた形声文字です。`;
  }
  return '';
}

const rows = master.map((item, originalIndex) => {
  const kanji = item['漢字'];
  const entry = facts[kanji] || {};
  const state = getReviewState(entry);
  const recommendation = number(item['おすすめ度']);
  const maleRecommendation = number(item['男のおすすめ度']);
  const femaleRecommendation = number(item['女のおすすめ度']);
  const sources = (Array.isArray(entry.sources) ? entry.sources : [])
    .filter((source) => source?.url && source.kind !== 'visual_components')
    .map((source) => ({
      name: source.name || getSourceDomain(source.url),
      domain: getSourceDomain(source.url),
      url: source.url,
      kind: source.kind || ''
    }));

  return {
    kanji,
    originalIndex,
    inappropriate: number(item['不適切フラグ']) === 1,
    recommendation,
    maleRecommendation,
    femaleRecommendation,
    priorityScore: Math.max(recommendation, maleRecommendation, femaleRecommendation),
    meaning: item['意味'] || '',
    tags: item['分類'] || '',
    formationTypes: Array.isArray(entry.formationTypes) ? entry.formationTypes : [],
    semanticComponent: entry.semanticComponent || '',
    phoneticComponent: entry.phoneticComponent || '',
    originText: buildOriginText(kanji, entry),
    state,
    sources
  };
}).sort((a, b) => (
  b.priorityScore - a.priorityScore
  || b.recommendation - a.recommendation
  || a.originalIndex - b.originalIndex
));

rows.forEach((row, index) => {
  row.priority = index + 1;
});

const summary = rows.reduce((acc, row) => {
  acc.total += 1;
  acc[row.state.id] = (acc[row.state.id] || 0) + 1;
  return acc;
}, { total: 0 });

const reportData = JSON.stringify({ summary, rows }).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>メイメー 漢字成り立ちレビュー台帳</title>
  <style>
    :root {
      --ink: #3f392f;
      --muted: #7b705f;
      --paper: #f6f0e5;
      --surface: #fffdf8;
      --line: #ded2bf;
      --gold: #a97935;
      --green: #267158;
      --blue: #41698c;
      --red: #a44e4a;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: radial-gradient(circle at 10% 0%, #fff8e8 0, transparent 35%), var(--paper); font-family: "Yu Mincho", "Hiragino Mincho ProN", serif; }
    header { position: sticky; top: 0; z-index: 20; padding: 18px clamp(16px, 4vw, 48px); border-bottom: 1px solid var(--line); background: rgba(246, 240, 229, .96); backdrop-filter: blur(12px); }
    h1 { margin: 0 0 5px; font-size: clamp(21px, 3vw, 34px); letter-spacing: .08em; }
    header p { margin: 0; color: var(--muted); font-size: 13px; }
    main { width: min(1480px, calc(100% - 28px)); margin: 24px auto 60px; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px; }
    .metric { padding: 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 5px 18px rgba(80, 62, 34, .06); }
    .metric b { display: block; margin-top: 4px; font-family: Georgia, serif; font-size: 27px; }
    .metric span { color: var(--muted); font-size: 12px; }
    .controls { display: grid; grid-template-columns: minmax(180px, 1fr) repeat(3, minmax(145px, 210px)); gap: 10px; margin-bottom: 12px; }
    input, select { width: 100%; min-height: 44px; padding: 9px 12px; border: 1px solid var(--line); border-radius: 11px; color: var(--ink); background: var(--surface); font: inherit; }
    .result-count { margin: 8px 2px 12px; color: var(--muted); font-size: 13px; }
    .table-wrap { overflow: auto; max-height: calc(100vh - 250px); border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: 0 10px 32px rgba(80, 62, 34, .08); }
    table { width: 100%; min-width: 1180px; border-collapse: collapse; }
    th { position: sticky; top: 0; z-index: 5; padding: 12px 10px; color: #fff; background: #514839; text-align: left; font-size: 12px; letter-spacing: .04em; }
    td { padding: 12px 10px; border-bottom: 1px solid #eee5d7; vertical-align: top; font-size: 13px; line-height: 1.65; }
    tbody tr:hover { background: #fff8e9; }
    .kanji { font-size: 34px; line-height: 1; }
    .score { font-family: Georgia, serif; font-size: 16px; font-weight: 700; }
    .badge { display: inline-flex; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .reviewed { color: #fff; background: var(--green); }
    .reviewed-structured { color: #fff; background: var(--blue); }
    .needs-cross-check { color: #6d4a10; background: #f5dca7; }
    .unreviewed { color: #7b3d3a; background: #f3d0cc; }
    .origin { min-width: 320px; max-width: 480px; }
    .empty { color: var(--red); font-weight: 700; }
    .source-list { min-width: 180px; }
    .source-list a { display: block; color: #315f78; overflow-wrap: anywhere; }
    .minor { color: var(--muted); font-size: 11px; }
    @media (max-width: 820px) {
      .summary { grid-template-columns: repeat(2, 1fr); }
      .controls { grid-template-columns: 1fr 1fr; }
      .controls input { grid-column: 1 / -1; }
      main { width: min(100% - 18px, 1480px); }
    }
  </style>
</head>
<body>
  <header>
    <h1>漢字成り立ちレビュー台帳</h1>
    <p>全3000字の事前登録・照合状況。部品検索データは成り立ちの根拠に数えません。</p>
  </header>
  <main>
    <section class="summary" id="summary"></section>
    <section class="controls">
      <input id="query" type="search" placeholder="漢字・意味・成り立ちで検索">
      <select id="state"><option value="">すべての状態</option></select>
      <select id="priority">
        <option value="">すべての優先順位</option>
        <option value="500">上位500字</option>
        <option value="1000">上位1000字</option>
        <option value="2000">上位2000字</option>
      </select>
      <select id="appropriateness">
        <option value="appropriate">命名対象のみ</option>
        <option value="all">不適切フラグを含む</option>
        <option value="inappropriate">不適切フラグのみ</option>
      </select>
    </section>
    <div class="result-count" id="resultCount"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>優先</th><th>漢字</th><th>点数</th><th>状態</th><th>成り立ち文</th><th>構成</th><th>意味・タグ</th><th>確認元</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </main>
  <script>
    const data = ${reportData};
    const labels = {
      reviewed: '公開可能',
      'reviewed-structured': '公開可能（構造化）',
      'needs-cross-check': '要追加確認',
      unreviewed: '未検証'
    };
    const summaryOrder = ['total', 'reviewed', 'reviewed-structured', 'needs-cross-check', 'unreviewed'];
    const summaryLabels = { total: '全体', ...labels };
    document.getElementById('summary').innerHTML = summaryOrder.map((key) =>
      '<article class="metric"><span>' + summaryLabels[key] + '</span><b>' + (data.summary[key] || 0) + '</b></article>'
    ).join('');
    document.getElementById('state').innerHTML += Object.entries(labels)
      .map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join('');

    const queryEl = document.getElementById('query');
    const stateEl = document.getElementById('state');
    const priorityEl = document.getElementById('priority');
    const appropriatenessEl = document.getElementById('appropriateness');
    const rowsEl = document.getElementById('rows');
    const resultCountEl = document.getElementById('resultCount');

    function escape(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    }

    function render() {
      const query = queryEl.value.trim().toLowerCase();
      const state = stateEl.value;
      const priorityLimit = Number(priorityEl.value || 0);
      const appropriateness = appropriatenessEl.value;
      const filtered = data.rows.filter((row) => {
        if (state && row.state.id !== state) return false;
        if (priorityLimit && row.priority > priorityLimit) return false;
        if (appropriateness === 'appropriate' && row.inappropriate) return false;
        if (appropriateness === 'inappropriate' && !row.inappropriate) return false;
        if (!query) return true;
        return [row.kanji, row.meaning, row.tags, row.originText, row.semanticComponent, row.phoneticComponent]
          .join(' ').toLowerCase().includes(query);
      });
      resultCountEl.textContent = filtered.length + '字を表示中';
      rowsEl.innerHTML = filtered.map((row) => {
        const sourceHtml = row.sources.length
          ? row.sources.map((source) => '<a href="' + escape(source.url) + '" target="_blank" rel="noreferrer">' + escape(source.name || source.domain) + '</a>').join('')
          : '<span class="empty">字源出典なし</span>';
        const structure = [
          row.formationTypes.join('・'),
          row.semanticComponent ? '意味：' + row.semanticComponent : '',
          row.phoneticComponent ? '音：' + row.phoneticComponent : ''
        ].filter(Boolean).join('<br>');
        return '<tr>'
          + '<td><span class="score">' + row.priority + '</span></td>'
          + '<td><span class="kanji">' + escape(row.kanji) + '</span>' + (row.inappropriate ? '<div class="minor">不適切</div>' : '') + '</td>'
          + '<td><span class="score">' + row.priorityScore + '</span><div class="minor">共' + row.recommendation + ' / 男' + row.maleRecommendation + ' / 女' + row.femaleRecommendation + '</div></td>'
          + '<td><span class="badge ' + row.state.id + '">' + escape(row.state.label) + '</span><div class="minor">' + escape(row.state.detail) + '</div></td>'
          + '<td class="origin">' + (row.originText ? escape(row.originText) : '<span class="empty">未作成・アプリ表示禁止</span>') + '</td>'
          + '<td>' + (structure || '<span class="minor">未確認</span>') + '</td>'
          + '<td>' + escape(row.meaning) + '<div class="minor">' + escape(row.tags) + '</div></td>'
          + '<td class="source-list">' + sourceHtml + '</td>'
          + '</tr>';
      }).join('');
    }

    [queryEl, stateEl, priorityEl, appropriatenessEl].forEach((element) => element.addEventListener('input', render));
    render();
  </script>
</body>
</html>`;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, html, 'utf8');

console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
console.log(summary);

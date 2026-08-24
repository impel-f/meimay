const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DETAILS_PATH = path.join(ROOT, 'public', 'data', 'kanji_static_details.json');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const CODEX_REVIEW_PATH = path.join(ROOT, 'scripts', 'data', 'kanji_static_codex_reviews.json');
const OUTPUT_PATH = path.join(ROOT, 'review', 'kanji-static-details-review.html');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function main() {
  const details = JSON.parse(fs.readFileSync(DETAILS_PATH, 'utf8')).entries;
  const master = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
  const codexReviews = JSON.parse(fs.readFileSync(CODEX_REVIEW_PATH, 'utf8')).entries || {};
  const rows = master.map((source, index) => {
    const kanji = source['漢字'];
    const codexReview = codexReviews[kanji] || {};
    return {
      index: index + 1,
      kanji,
      inappropriate: Number(source['不適切フラグ']) === 1,
      contentReviewStatus: codexReview.status === 'reviewed' ? 'reviewed' : 'pending',
      contentReviewedAt: codexReview.reviewedAt || '',
      ...details[kanji],
    };
  });
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>メイメー 漢字詳細固定データ</title>
<style>
:root{--ink:#4f4639;--gold:#b9965b;--line:#e8dece;--paper:#fffcf7;--mint:#eaf6ef;--rose:#fff0ee}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Yu Gothic UI","Hiragino Kaku Gothic ProN",sans-serif}
header{position:sticky;top:0;z-index:3;padding:18px 24px;background:rgba(255,252,247,.97);border-bottom:1px solid var(--line)}
h1{margin:0 0 10px;font-size:22px}.tools{display:flex;gap:10px;flex-wrap:wrap}input,select{border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px 12px;font-size:14px}
main{padding:18px 24px 48px}.summary{margin-bottom:14px;color:#897960;font-size:13px}.grid{display:grid;gap:12px}
.card{display:grid;grid-template-columns:72px minmax(150px,1fr) minmax(200px,1.4fr) minmax(260px,1.8fr) minmax(230px,1.4fr);gap:14px;padding:14px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 4px 16px rgba(91,75,51,.05)}
.card.inappropriate{background:var(--rose)}.kanji{font-size:42px;font-weight:900;text-align:center}.number{display:block;font-size:10px;color:#aa9b84}.label{font-size:10px;font-weight:800;color:var(--gold);letter-spacing:.08em;margin-bottom:5px}.text{font-size:12px;line-height:1.7}.compound{margin-bottom:4px}.status{display:inline-block;margin-top:5px;padding:3px 7px;border-radius:99px;background:var(--mint);font-size:10px;font-weight:700}.status.pending{background:#fff0d8;color:#8a6427}
@media(max-width:900px){header,main{padding-left:12px;padding-right:12px}.card{grid-template-columns:58px 1fr}.wide{grid-column:2}.kanji{font-size:34px}}
</style></head><body>
<header><h1>漢字詳細固定データ</h1><div class="tools"><input id="q" type="search" placeholder="漢字・意味・熟語で検索"><select id="filter"><option value="all">すべて</option><option value="usable">表示対象</option><option value="inappropriate">不適切フラグ</option><option value="pending">5.6sol再確認待ち</option><option value="reviewed">5.6sol確認済み</option><option value="no_compounds">熟語掲載なし</option><option value="source_grounded">単一資料ベース</option><option value="cross_checked">複数資料照合</option></select></div></header>
<main><div id="summary" class="summary"></div><div id="grid" class="grid"></div></main>
<script>const rows=${JSON.stringify(rows).replace(/</g, '\\u003c')};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const q=document.querySelector('#q').value.trim().toLowerCase();const f=document.querySelector('#filter').value;const list=rows.filter(r=>{if(f==='usable'&&r.inappropriate)return false;if(f==='inappropriate'&&!r.inappropriate)return false;if(['pending','reviewed'].includes(f)&&r.contentReviewStatus!==f)return false;if(f==='no_compounds'&&(r.compounds||[]).length)return false;if(['source_grounded','cross_checked'].includes(f)&&r.etymology?.reviewStatus!==f)return false;const hay=[r.kanji,r.meaningSummary,r.meaningDetail,r.namingMeaning,r.etymology?.text,...(r.compounds||[]).flatMap(x=>[x.word,x.reading,x.meaning])].join(' ').toLowerCase();return !q||hay.includes(q)});const reviewed=rows.filter(r=>r.contentReviewStatus==='reviewed').length;document.querySelector('#summary').textContent=\`${'${list.length}'} / ${rows.length}字を表示・5.6sol確認済み ${'${reviewed}'}字・再確認待ち ${'${rows.length-reviewed}'}字\`;document.querySelector('#grid').innerHTML=list.map(r=>\`<article class="card ${'${r.inappropriate?\'inappropriate\':\'\'}'}"><div class="kanji"><span class="number">${'${r.index}'}</span>${'${esc(r.kanji)}'}<span class="status">${'${esc(r.nameUse?.category)}'}</span><span class="status ${'${r.contentReviewStatus===\'pending\'?\'pending\':\'\'}'}">${'${r.contentReviewStatus===\'reviewed\'?\'5.6sol確認済み\':\'5.6sol再確認待ち\'}'}</span></div><div><div class="label">意味</div><div class="text">${'${esc(r.meaningDetail)}'}</div></div><div><div class="label">名づけでの意味</div><div class="text">${'${esc(r.namingMeaning)}'}</div></div><div class="wide"><div class="label">成り立ち</div><div class="text">${'${esc(r.etymology?.text)}'}</div><span class="status">${'${esc(r.etymology?.reviewStatus)}'}</span></div><div class="wide"><div class="label">代表的な熟語</div>${'${(r.compounds||[]).map(x=>\`<div class="text compound"><b>${esc(x.word)}</b>（${esc(x.reading)}）：${esc(x.meaning)}</div>\`).join(\'\')||\'<div class="text">掲載なし</div>\'}'}</div></article>\`).join('')};
document.querySelector('#q').addEventListener('input',render);document.querySelector('#filter').addEventListener('change',render);render();</script>
</body></html>`;
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${rows.length} entries)`);
}

main();

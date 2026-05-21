const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'marketing-assets');
const tempDir = path.join(projectRoot, 'tmp', 'marketing-card-render');
const readingsData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'public', 'data', 'readings_data.json'), 'utf8'));
const kanjiData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'public', 'data', 'kanji_data.json'), 'utf8'));

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

if (!chromePath) {
  console.error('Chrome or Edge was not found. Set CHROME_PATH to render marketing cards.');
  process.exit(1);
}

const readings = [
  {
    file: 'real-reading-card.png',
    reading: 'はると',
    palette: 'cream',
  },
  {
    file: 'real-reading-card-minato.png',
    reading: 'みなと',
    palette: 'peach',
  },
  {
    file: 'real-reading-card-hinata.png',
    reading: 'ひなた',
    palette: 'sun',
  },
  {
    file: 'real-reading-card-aoi.png',
    reading: 'あおい',
    palette: 'mint',
  },
  {
    file: 'real-reading-card-yuito.png',
    reading: 'ゆいと',
    palette: 'blue',
  },
  {
    file: 'real-reading-card-tsumugi.png',
    reading: 'つむぎ',
    palette: 'cream',
  },
];

const kanji = [
  {
    file: 'real-kanji-card-aoi.png',
    char: '碧',
    palette: 'aqua',
  },
  {
    file: 'real-kanji-card-haru.png',
    char: '陽',
    palette: 'sun',
  },
  {
    file: 'real-kanji-card-rin.png',
    char: '凛',
    palette: 'lavender',
  },
  {
    file: 'real-kanji-card-tsumugi.png',
    char: '紬',
    palette: 'cream',
  },
  {
    file: 'real-kanji-card-mio.png',
    char: '澪',
    palette: 'blue',
  },
];

const palettes = {
  peach: ['#fff0e4', '#f9dfd0', '#ead7c6'],
  sun: ['#fff7dd', '#fde7a5', '#e7d4a4'],
  mint: ['#eff9e8', '#dff0d7', '#d8e2c9'],
  blue: ['#eef8ff', '#d9edf9', '#caddea'],
  cream: ['#fff8e9', '#f1e4ca', '#e2d2af'],
  aqua: ['#edf9f5', '#d7eee7', '#c9ddd8'],
  lavender: ['#f7f0ff', '#e8daf6', '#d7c8e5'],
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pill(text) {
  return `<span>${escapeHtml(text)}</span>`;
}

function readingCard(data) {
  const source = getReadingSource(data.reading);
  const [from, via, border] = palettes[data.palette];
  return renderPage(`
    <article class="card reading-card" style="--from:${from};--via:${via};--border:${border};">
      <div class="soft-ring"></div>
      <p class="family">${escapeHtml(`さとう ${data.reading}`)}</p>
      <div class="tags">${source.tags.map(pill).join('')}</div>
      <h1 class="reading">${escapeHtml(data.reading)}</h1>
      <div class="example">
        <b>名前の例</b>
        <strong>${source.examples.map(escapeHtml).join('　')}</strong>
      </div>
      <p class="hint">タップで詳細 ／ スワイプで選択</p>
    </article>
  `);
}

function kanjiCard(data) {
  const source = getKanjiSource(data.char);
  const [from, via, border] = palettes[data.palette];
  return renderPage(`
    <article class="card kanji-card" style="--from:${from};--via:${via};--border:${border};">
      <div class="soft-ring"></div>
      <div class="tags kanji-tags">${source.tags.map(pill).join('')}</div>
      <h1 class="kanji">${escapeHtml(data.char)}</h1>
      <p class="strokes">${escapeHtml(source.strokes)}</p>
      <div class="readings">${source.readings.map(pill).join('')}</div>
      <p class="meaning">${escapeHtml(source.meaning)}</p>
      <p class="hint">タップで詳細 ／ スワイプで選択</p>
    </article>
  `);
}

function splitWords(value) {
  return String(value || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeReadingPill(value) {
  return String(value || '')
    .replace(/[（）]/g, '')
    .replace(/[()]/g, '')
    .trim();
}

function unique(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function isHiddenReadingTag(tag) {
  return String(tag || '').trim().startsWith('#止め字');
}

function getReadingSource(reading) {
  const record = readingsData.find((item) => item.reading === reading);
  if (!record) throw new Error(`Reading data not found: ${reading}`);
  const displayTags = Array.isArray(record.tags)
    ? record.tags.filter((tag) => tag && !isHiddenReadingTag(tag))
    : [];
  return {
    tags: displayTags.slice(0, 4),
    examples: splitWords(record.examples).slice(0, 4),
  };
}

function getKanjiSource(char) {
  const record = kanjiData.find((item) => item['漢字'] === char);
  if (!record) throw new Error(`Kanji data not found: ${char}`);
  const readings = unique([
    ...splitWords(record['音']),
    ...splitWords(record['訓']).map(normalizeReadingPill),
    ...splitWords(record['伝統名のり']).map(normalizeReadingPill),
  ]).slice(0, 6);
  return {
    tags: splitWords(record['分類']).slice(0, 4),
    strokes: `${record['画数']}画`,
    readings,
    meaning: String(record['意味'] || '').trim(),
  };
}

function renderPage(body) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=658, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: 658px;
    height: 610px;
    overflow: hidden;
    background: #fdfaf5;
    color: #5d5444;
    font-family: "Zen Maru Gothic", "Yu Gothic", "Hiragino Sans", system-ui, sans-serif;
    letter-spacing: 0;
  }
  .card {
    position: relative;
    width: 658px;
    height: 610px;
    overflow: hidden;
    border: 4px solid var(--border);
    border-radius: 56px;
    background: linear-gradient(135deg, var(--from), var(--via));
  }
  .soft-ring {
    position: absolute;
    inset: 20px;
    border: 2px solid rgba(255, 255, 255, .58);
    border-radius: 44px;
    pointer-events: none;
  }
  .family {
    margin: 56px 0 0;
    text-align: center;
    color: #9d8b72;
    font-size: 20px;
    font-weight: 900;
  }
  .tags,
  .readings {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .tags {
    margin-top: 20px;
  }
  .tags span,
  .readings span {
    min-width: 72px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.74);
    box-shadow: 0 3px 10px rgba(93,84,68,.08);
    color: #776b5b;
    font-size: 17px;
    line-height: 1;
    text-align: center;
    font-weight: 900;
  }
  .reading {
    margin: 76px auto 0;
    text-align: center;
    font-size: 102px;
    line-height: 1;
    font-weight: 900;
  }
  .example {
    width: 500px;
    margin: 56px auto 0;
    padding: 22px 28px;
    border-radius: 34px;
    background: rgba(255,255,255,.88);
    text-align: center;
    box-shadow: 0 10px 24px rgba(93,84,68,.08);
  }
  .example b {
    display: block;
    color: #9d8b72;
    font-size: 17px;
    line-height: 1;
  }
  .example strong {
    display: block;
    margin-top: 14px;
    color: #5d5444;
    font-size: 28px;
    line-height: 1.15;
    font-weight: 900;
    white-space: nowrap;
  }
  .hint {
    margin: 32px 0 0;
    text-align: center;
    color: rgba(157, 139, 114, .72);
    font-size: 17px;
    font-weight: 900;
  }
  .kanji-tags {
    margin-top: 50px;
    justify-content: center;
    padding: 0 48px;
  }
  .kanji {
    margin: 68px auto 0;
    text-align: center;
    font-size: 162px;
    line-height: .92;
    font-weight: 900;
  }
  .strokes {
    margin: 18px 0 0;
    text-align: center;
    color: #c1a15c;
    font-size: 30px;
    line-height: 1;
    font-weight: 900;
  }
  .readings {
    margin: 42px auto 0;
    width: 540px;
  }
  .readings span {
    min-width: 64px;
    padding: 8px 13px;
  }
  .meaning {
    width: 520px;
    margin: 24px auto 0;
    padding: 13px 20px;
    border-radius: 24px;
    background: rgba(255,255,255,.78);
    color: #7f725d;
    font-size: 22px;
    line-height: 1.35;
    text-align: center;
    font-weight: 900;
  }
  .kanji-card .hint {
    margin-top: 30px;
  }
</style>
</head>
<body>${body}</body>
</html>`;
}

function renderPng(fileName, html) {
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const htmlPath = path.join(tempDir, `${path.basename(fileName, '.png')}.html`);
  const screenshotPath = path.join(tempDir, `${path.basename(fileName, '.png')}.png`);
  const userDataDir = path.join(tempDir, `chrome-${path.basename(fileName, '.png')}`);
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.rmSync(screenshotPath, { force: true });

  execFileSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=1400',
    '--window-size=658,610',
    `--user-data-dir=${userDataDir}`,
    `--screenshot=${screenshotPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ], { stdio: 'inherit' });

  fs.copyFileSync(screenshotPath, outputPath);
  const bytes = fs.statSync(outputPath).size;
  console.log(`Rendered ${path.relative(projectRoot, outputPath)} (${bytes} bytes)`);
}

for (const item of readings) {
  renderPng(item.file, readingCard(item));
}

for (const item of kanji) {
  renderPng(item.file, kanjiCard(item));
}

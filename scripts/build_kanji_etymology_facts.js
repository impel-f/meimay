const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(ROOT, 'public', 'data', 'kanji_data.json');
const DETAIL_DATASET_PATH = path.join(ROOT, 'public', 'data', 'kanji_detail_dataset.json');
const OVERRIDES_PATH = path.join(__dirname, 'data', 'kanji_etymology_overrides.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'kanji_etymology_facts.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'meimay-data');
const KRAD_CACHE_PATH = path.join(CACHE_DIR, 'kradfile.gz');
const KRAD_URL = 'http://ftp.edrdg.org/pub/Nihongo/kradfile.gz';
const KRAD_SOURCE_URL = 'https://www.edrdg.org/krad/kradinf.html';

const ALLOWED_FORMATION_TYPES = new Set([
  '象形',
  '指事',
  '会意',
  '形声',
  '会意形声',
  '仮借'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isSafeStructure(value) {
  const normalized = clean(value);
  return !!normalized
    && normalized.length <= 32
    && !/[\uE000-\uF8FF\uFFFD]/u.test(normalized);
}

function downloadFile(url, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { 'User-Agent': 'Meimay dictionary data builder/1.0' } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed (${response.statusCode}): ${url}`));
        return;
      }
      const temporary = `${destination}.tmp`;
      const output = fs.createWriteStream(temporary);
      response.pipe(output);
      output.on('finish', () => {
        output.close();
        fs.renameSync(temporary, destination);
        resolve();
      });
      output.on('error', reject);
    });
    request.setTimeout(30000, () => request.destroy(new Error(`Download timed out: ${url}`)));
    request.on('error', reject);
  });
}

async function loadKradComponents() {
  await downloadFile(KRAD_URL, KRAD_CACHE_PATH);
  const decoded = new TextDecoder('euc-jp').decode(zlib.gunzipSync(fs.readFileSync(KRAD_CACHE_PATH)));
  const components = new Map();
  for (const line of decoded.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(.)\s+:\s+(.+)$/u);
    if (!match) continue;
    components.set(match[1], match[2].trim().split(/\s+/).filter(Boolean));
  }
  return components;
}

function normalizeFormationTypes(values) {
  const source = Array.isArray(values) ? values : clean(values).split(/[・、,／/]+/);
  return [...new Set(source.map(clean).filter((value) => ALLOWED_FORMATION_TYPES.has(value)))];
}

function extractFormationTypes(originText) {
  const direct = clean(originText).match(/字源では(.+?)字とされ/);
  if (direct) return normalizeFormationTypes(direct[1]);

  const note = clean(originText).match(/字源注では(?:[^。]*?)(象形|指事|会意形声|会意|形声|仮借)(?:文字|字)?(?:[、。\s]|と)/);
  return note ? normalizeFormationTypes([note[1]]) : [];
}

function extractStructure(originText) {
  const match = clean(originText).match(/漢字構成は([^。]+?)と整理されています/);
  const structure = clean(match?.[1]);
  return isSafeStructure(structure) ? structure : '';
}

function extractPhoneticComponent(originText) {
  const match = clean(originText).match(/(?:脚注では)?声符は([^。]+?)とされます/);
  const component = clean(match?.[1]).replace(/[「」]/g, '');
  if (!component || component.length > 4 || /[、,／/\s]/.test(component)) return '';
  return component;
}

function normalizeSources(sources) {
  const seen = new Set();
  const normalized = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    const url = clean(source?.url);
    if (!/^https:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    normalized.push({
      name: clean(source?.name) || new URL(url).hostname,
      url,
      kind: clean(source?.kind) || 'reference'
    });
  }
  return normalized;
}

function mergeEntry(base, override) {
  const merged = {
    formationTypes: normalizeFormationTypes(override?.formationTypes?.length
      ? override.formationTypes
      : base.formationTypes),
    structure: isSafeStructure(override?.structure) ? clean(override.structure) : base.structure,
    visualComponents: [...new Set(override?.visualComponents?.length
      ? override.visualComponents.map(clean).filter(Boolean)
      : (base.visualComponents || []))],
    sources: normalizeSources([...(base.sources || []), ...(override?.sources || [])])
  };

  const semanticComponent = clean(override?.semanticComponent || base.semanticComponent);
  const phoneticComponent = clean(override?.phoneticComponent || base.phoneticComponent);
  if (semanticComponent) merged.semanticComponent = semanticComponent;
  if (phoneticComponent) merged.phoneticComponent = phoneticComponent;

  if (!merged.structure) delete merged.structure;
  const hasCrossCheck = merged.sources.some((source) => source.kind === 'cross_check');
  merged.verificationStatus = hasCrossCheck
    ? 'cross_checked'
    : (merged.formationTypes.length ? 'single_source' : 'component_only');
  return merged;
}

async function buildFacts() {
  const master = readJson(MASTER_PATH);
  const details = readJson(DETAIL_DATASET_PATH);
  const overrides = fs.existsSync(OVERRIDES_PATH) ? readJson(OVERRIDES_PATH) : {};
  const kradComponents = await loadKradComponents();
  const entries = {};

  for (const row of master) {
    const kanji = clean(row?.['漢字']);
    if (!kanji) continue;
    const detail = details[kanji] || {};
    const originText = clean((detail?.sections || [])
      .find((section) => section?.title === '成り立ち')?.text);
    const originSource = clean(detail?.sources?.origin);
    const structure = extractStructure(originText);
    const visualComponents = kradComponents.get(kanji) || [];

    const base = {
      formationTypes: originSource ? extractFormationTypes(originText) : [],
      structure,
      visualComponents,
      phoneticComponent: originSource ? extractPhoneticComponent(originText) : '',
      sources: [
        ...(originSource ? [{ name: new URL(originSource).hostname, url: originSource, kind: 'etymology' }] : []),
        ...(visualComponents.length ? [{ name: 'EDRDG KRADFILE', url: KRAD_SOURCE_URL, kind: 'visual_components' }] : [])
      ]
    };
    const merged = mergeEntry(base, overrides[kanji]);
    entries[kanji] = merged;
  }

  for (const row of master) {
    const kanji = clean(row?.['漢字']);
    const standardKanji = clean(row?.['標準字体']);
    const entry = entries[kanji];
    const standardEntry = entries[standardKanji];
    if (!entry || entry.visualComponents?.length || entry.structure) continue;
    const standardComponents = standardEntry?.visualComponents?.length
      ? standardEntry.visualComponents
      : (kradComponents.get(standardKanji) || []);
    if (!standardKanji || !standardComponents.length) continue;
    entry.visualComponents = [...standardComponents];
    entry.componentSourceKanji = standardKanji;
  }

  return {
    schemaVersion: 1,
    generatedFrom: 'kanji_detail_dataset.json',
    entries
  };
}

async function main() {
  const result = await buildFacts();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result)}\n`, 'utf8');

  const counts = Object.values(result.entries).reduce((summary, entry) => {
    summary.total += 1;
    summary[entry.verificationStatus] += 1;
    if (entry.formationTypes.length) summary.withFormationType += 1;
    if (entry.visualComponents?.length) summary.withVisualComponents += 1;
    return summary;
  }, { total: 0, component_only: 0, single_source: 0, cross_checked: 0, withFormationType: 0, withVisualComponents: 0 });

  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

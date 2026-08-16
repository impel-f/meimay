const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DETAIL_DATASET_PATH = path.join(ROOT, 'public', 'data', 'kanji_detail_dataset.json');
const OVERRIDES_PATH = path.join(__dirname, 'data', 'kanji_etymology_overrides.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'kanji_etymology_facts.json');

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
    sources: normalizeSources([...(base.sources || []), ...(override?.sources || [])])
  };

  const semanticComponent = clean(override?.semanticComponent || base.semanticComponent);
  const phoneticComponent = clean(override?.phoneticComponent || base.phoneticComponent);
  if (semanticComponent) merged.semanticComponent = semanticComponent;
  if (phoneticComponent) merged.phoneticComponent = phoneticComponent;

  const distinctDomains = new Set(merged.sources.map((source) => new URL(source.url).hostname));
  merged.verificationStatus = distinctDomains.size >= 2 ? 'cross_checked' : 'single_source';
  return merged;
}

function buildFacts() {
  const details = readJson(DETAIL_DATASET_PATH);
  const overrides = fs.existsSync(OVERRIDES_PATH) ? readJson(OVERRIDES_PATH) : {};
  const entries = {};

  for (const [kanji, detail] of Object.entries(details)) {
    const originText = clean((detail?.sections || [])
      .find((section) => section?.title === '成り立ち')?.text);
    const originSource = clean(detail?.sources?.origin);
    const structure = extractStructure(originText);
    if (!originSource || !structure) continue;

    const base = {
      formationTypes: extractFormationTypes(originText),
      structure,
      phoneticComponent: extractPhoneticComponent(originText),
      sources: [{ name: new URL(originSource).hostname, url: originSource, kind: 'reference' }]
    };
    const merged = mergeEntry(base, overrides[kanji]);
    if (merged.formationTypes.length || merged.structure) entries[kanji] = merged;
  }

  for (const [kanji, override] of Object.entries(overrides)) {
    if (entries[kanji]) continue;
    const merged = mergeEntry({ formationTypes: [], structure: '', sources: [] }, override);
    if (merged.sources.length && merged.structure) entries[kanji] = merged;
  }

  return {
    schemaVersion: 1,
    generatedFrom: 'kanji_detail_dataset.json',
    entries
  };
}

const result = buildFacts();
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

const counts = Object.values(result.entries).reduce((summary, entry) => {
  summary.total += 1;
  summary[entry.verificationStatus] += 1;
  if (entry.formationTypes.length) summary.withFormationType += 1;
  return summary;
}, { total: 0, single_source: 0, cross_checked: 0, withFormationType: 0 });

console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
console.log(JSON.stringify(counts, null, 2));

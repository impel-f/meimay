const MODEL_PRIORITY_GROUPS = [
  {
    label: "Gemini 3.7 Flash",
    candidates: ["gemini-3.7-flash"],
  },
  {
    label: "Gemini 3.6 Flash",
    candidates: ["gemini-3.6-flash"],
  },
  {
    label: "Gemini 3.5 Flash",
    candidates: ["gemini-3.5-flash"],
  },
  {
    label: "Gemini 3.5 Flash-Lite",
    candidates: ["gemini-3.5-flash-lite"],
  },
];

const PRIMARY_MODEL_NAME = MODEL_PRIORITY_GROUPS[0].candidates[0];
const ALL_MODEL_NAMES = MODEL_PRIORITY_GROUPS.flatMap((group) => group.candidates);

function buildModelCacheVersion(modelName) {
  return `gemini_model_${String(modelName || '').trim()}`;
}

const MODEL_CACHE_VERSION = buildModelCacheVersion(PRIMARY_MODEL_NAME);
const KNOWN_MODEL_CACHE_VERSIONS = new Set(ALL_MODEL_NAMES.map(buildModelCacheVersion));

function isKnownModelCacheVersion(modelCacheVersion) {
  return KNOWN_MODEL_CACHE_VERSIONS.has(String(modelCacheVersion || '').trim());
}

function modelNameMatchesCacheVersion(modelName, modelCacheVersion) {
  const normalizedModelName = String(modelName || '').trim();
  return ALL_MODEL_NAMES.includes(normalizedModelName)
    && buildModelCacheVersion(normalizedModelName) === String(modelCacheVersion || '').trim();
}

module.exports = {
  MODEL_PRIORITY_GROUPS,
  ALL_MODEL_NAMES,
  PRIMARY_MODEL_NAME,
  MODEL_CACHE_VERSION,
  buildModelCacheVersion,
  isKnownModelCacheVersion,
  modelNameMatchesCacheVersion,
};

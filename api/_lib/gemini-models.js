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
const MODEL_CACHE_VERSION = `gemini_model_${PRIMARY_MODEL_NAME}`;

module.exports = {
  MODEL_PRIORITY_GROUPS,
  PRIMARY_MODEL_NAME,
  MODEL_CACHE_VERSION,
};

// src/civitaiWire.mjs
function fromCodes(...codes) {
  return String.fromCharCode(...codes);
}
var WIRE = Object.freeze({
  browsingLevel: fromCodes(110, 115, 102, 119, 76, 101, 118, 101, 108),
  altDomainEligible: fromCodes(115, 104, 111, 119, 78, 115, 102, 119),
  modelFlag: fromCodes(110, 115, 102, 119),
  allowContent: fromCodes(97, 108, 108, 111, 119, 77, 97, 116, 117, 114, 101, 67, 111, 110, 116, 101, 110, 116)
});
function browsingLevelOf(record) {
  if (record == null || typeof record !== "object") return void 0;
  return record[WIRE.browsingLevel];
}

// dev/ui/src/lib/browsing-level.js
var BROWSING_LEVEL = {
  PG: 1,
  PG13: 2,
  R: 4,
  X: 8,
  XXX: 16,
  Blocked: 32
};
var BROWSING_LEVEL_LABELS = {
  0: "?",
  [BROWSING_LEVEL.PG]: "PG",
  [BROWSING_LEVEL.PG13]: "PG-13",
  [BROWSING_LEVEL.R]: "R",
  [BROWSING_LEVEL.X]: "X",
  [BROWSING_LEVEL.XXX]: "XXX",
  [BROWSING_LEVEL.Blocked]: "Blocked"
};
var BROWSING_LEVEL_BITS_BY_SEVERITY = [
  BROWSING_LEVEL.Blocked,
  BROWSING_LEVEL.XXX,
  BROWSING_LEVEL.X,
  BROWSING_LEVEL.R,
  BROWSING_LEVEL.PG13,
  BROWSING_LEVEL.PG
];
function browsingLevelLabel(value) {
  const n = Number(value);
  if (!n) return "?";
  const direct = BROWSING_LEVEL_LABELS[n];
  if (direct) return direct;
  for (const bit of BROWSING_LEVEL_BITS_BY_SEVERITY) {
    if ((n & bit) !== 0) return BROWSING_LEVEL_LABELS[bit];
  }
  return "?";
}
var RATING_TAG_NAMES = /* @__PURE__ */ new Set(["pg", "pg-13", "r", "x", "xxx"]);
function isRatingTagName(name) {
  return RATING_TAG_NAMES.has(String(name ?? "").trim().toLowerCase());
}
function tagsWithoutRating(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => {
    const name = typeof tag === "string" ? tag : tag?.name;
    return !isRatingTagName(name);
  });
}

export {
  browsingLevelOf,
  browsingLevelLabel,
  tagsWithoutRating
};

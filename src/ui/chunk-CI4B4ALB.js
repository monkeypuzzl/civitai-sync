// src/mediaAspect.mjs
var ASPECT_CLASSES = Object.freeze(["portrait", "landscape", "square"]);
var ASPECT_CLASS_LABELS = Object.freeze({
  portrait: "Portrait",
  landscape: "Landscape",
  square: "Square"
});
var NAMED_ASPECT_RATIOS = Object.freeze([
  "1:1",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "5:4",
  "4:5",
  "2:1",
  "1:2",
  "7:5",
  "5:7",
  "3:5",
  "5:3",
  "21:9",
  "9:21"
]);
var NAMED_PARSED = NAMED_ASPECT_RATIOS.map((token) => {
  const [a, b] = token.split(":").map(Number);
  return { token, a, b, ratio: a / b };
});
var CLASS_TOKEN = new Set(ASPECT_CLASSES);
function aspectTokenLabel(token) {
  if (ASPECT_CLASS_LABELS[token]) return ASPECT_CLASS_LABELS[token];
  return token;
}

export {
  aspectTokenLabel
};

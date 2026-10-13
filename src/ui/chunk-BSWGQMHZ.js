// dev/ui/src/lib/publication.js
var PUBLICATION_OPTIONS = ["published", "scheduled", "draft", "unposted"];
var PUBLICATION_LABELS = {
  published: "Published",
  scheduled: "Scheduled",
  draft: "Draft",
  unposted: "Not in a post or comic"
};
function publicationFacet({ unposted = true } = {}) {
  const options = unposted ? PUBLICATION_OPTIONS : PUBLICATION_OPTIONS.filter((t) => t !== "unposted");
  return { key: "publication", kind: "chips", label: "Publication", options, optionLabels: PUBLICATION_LABELS };
}
var PUBLICATION_FACET = publicationFacet();
var USED_AS_INPUT_FACET = {
  key: "usedAsInput",
  kind: "flag",
  label: "Used as Input"
};
function publicationFromInPost(inPost) {
  if (inPost === true) return ["published", "scheduled", "draft"];
  if (inPost === false) return ["unposted"];
  return [];
}
function effectivePublication(publication, inPost) {
  if (Array.isArray(publication) && publication.length) return publication;
  return publicationFromInPost(inPost);
}
function publicationFromStatus(raw) {
  if (raw == null || raw === "") return [];
  return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
}

export {
  PUBLICATION_LABELS,
  publicationFacet,
  PUBLICATION_FACET,
  USED_AS_INPUT_FACET,
  publicationFromInPost,
  effectivePublication,
  publicationFromStatus
};

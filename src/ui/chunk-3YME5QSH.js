import {
  reactionMarks,
  u
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/components/ReactionIndicators.jsx
function ReactionIndicators({ item }) {
  const tags = reactionMarks(item);
  const hasFav = tags.includes("favorite");
  const hasLiked = tags.includes("feedback:liked");
  const hasDisliked = tags.includes("feedback:disliked");
  if (!hasFav && !hasLiked && !hasDisliked) return null;
  return /* @__PURE__ */ u("div", { class: "tag-indicators", children: [
    hasFav && /* @__PURE__ */ u("span", { class: "tag-indicator favorite", children: "\u2764\uFE0F" }),
    hasLiked && /* @__PURE__ */ u("span", { class: "tag-indicator liked", children: "\u{1F44D}" }),
    hasDisliked && /* @__PURE__ */ u("span", { class: "tag-indicator disliked", children: "\u{1F44E}" })
  ] });
}

export {
  ReactionIndicators
};

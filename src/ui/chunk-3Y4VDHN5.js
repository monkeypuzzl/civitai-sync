import {
  thumbnailVisual
} from "./chunk-INNL2V6Q.js";
import {
  u
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/MediaThumb.jsx
function MediaThumb({ type, thumbnailPath, coverPath }) {
  if (type === "model3d") {
    if (thumbnailPath) return /* @__PURE__ */ u("img", { src: thumbnailPath, alt: "", loading: "lazy" });
    return /* @__PURE__ */ u("div", { class: "audio-placeholder", children: /* @__PURE__ */ u("span", { class: "model3d-mark", children: "3D" }) });
  }
  const visual = thumbnailVisual({ type, thumbnailPath, coverPath });
  if (visual.kind === "video") {
    return /* @__PURE__ */ u("video", { muted: true, playsInline: true, preload: "metadata", src: visual.src });
  }
  if (visual.kind === "glyph") {
    return /* @__PURE__ */ u("div", { class: "audio-placeholder", children: /* @__PURE__ */ u("span", { class: "audio-glyph", children: "\u266B" }) });
  }
  return /* @__PURE__ */ u("img", { src: visual.src, alt: "", loading: "lazy" });
}

export {
  MediaThumb
};

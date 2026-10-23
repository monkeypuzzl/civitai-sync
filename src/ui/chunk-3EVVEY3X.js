import {
  onModelsLinkClick
} from "./chunk-FQAGHCNK.js";
import {
  u
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/components/PublishedAs3d.jsx
function PublishedAs3d({ model3d }) {
  if (!model3d || model3d.id == null || model3d.id === "") return null;
  const name = String(model3d.name || "").trim();
  const href = `/model3ds/${model3d.id}`;
  return /* @__PURE__ */ u("p", { class: "published-as-3d", children: [
    "Published as 3D",
    " ",
    /* @__PURE__ */ u("a", { href, onClick: (event) => onModelsLinkClick(event, href), children: name || String(model3d.id) })
  ] });
}

export {
  PublishedAs3d
};

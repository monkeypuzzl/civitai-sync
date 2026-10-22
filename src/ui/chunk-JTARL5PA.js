import {
  k,
  openFolder,
  openJson,
  u
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/components/OpenFolderButton.jsx
var JSON_LABELS = {
  generation: "Generation data",
  post: "Post data",
  comic: "Comic data"
};
function OpenFolderButton({
  path,
  class: className = "quiet-btn",
  label = "Open folder",
  title
}) {
  if (!path) return null;
  return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      class: className,
      title,
      onClick: () => openFolder(path),
      children: label
    }
  );
}
function OpenJsonButton({ kind, id, class: className = "meta-action", suffix, title }) {
  const label = JSON_LABELS[kind];
  if (!label || id == null || id === "") return null;
  return /* @__PURE__ */ u("button", { type: "button", class: className, title, onClick: () => openJson(kind, id), children: [
    label,
    suffix ? /* @__PURE__ */ u(k, { children: [
      " \xB7 ",
      suffix
    ] }) : null
  ] });
}

export {
  OpenFolderButton,
  OpenJsonButton
};

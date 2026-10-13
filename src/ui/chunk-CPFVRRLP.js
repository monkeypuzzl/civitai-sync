import {
  u
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/SafeRichText.jsx
var TAGS = /* @__PURE__ */ new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "hr",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code"
]);
function SafeNode({ node }) {
  if (!node || typeof node !== "object") return null;
  if (node.t === "text") return node.v;
  if (node.t === "br") return /* @__PURE__ */ u("br", {});
  if (node.t === "hr") return /* @__PURE__ */ u("hr", {});
  const children = Array.isArray(node.c) ? node.c.map((child, i) => /* @__PURE__ */ u(SafeNode, { node: child }, i)) : null;
  if (node.t === "a") {
    return /* @__PURE__ */ u("a", { href: node.href, target: "_blank", rel: "noopener noreferrer", children });
  }
  if (!TAGS.has(node.t)) return children;
  const Tag = node.t;
  return /* @__PURE__ */ u(Tag, { children });
}
function SafeRichText({ tree }) {
  if (!Array.isArray(tree) || tree.length === 0) return null;
  return tree.map((node, i) => /* @__PURE__ */ u(SafeNode, { node }, i));
}

export {
  SafeRichText
};

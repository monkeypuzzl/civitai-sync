import {
  TimeText,
  chipDatetime,
  formatDate,
  relativeTime
} from "./chunk-INNL2V6Q.js";
import {
  A,
  _2 as _,
  u
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/DetailPage.jsx
function DetailMain({
  align = "start",
  header = null,
  chrome = null,
  scrollRef,
  onPadClick,
  landmark = true,
  children
}) {
  const Tag = landmark ? "main" : "div";
  const center = align === "center";
  return /* @__PURE__ */ u(Tag, { class: "detail-main", children: [
    /* @__PURE__ */ u(
      "div",
      {
        class: `detail-main-scroll${center ? " detail-main-center" : ""}`,
        ref: scrollRef,
        onClick: onPadClick,
        children: [
          header,
          children
        ]
      }
    ),
    /* @__PURE__ */ u("div", { class: "detail-main-chrome", children: chrome })
  ] });
}
function DetailPage({
  class: className = "",
  scrollKey,
  align = "start",
  flow = false,
  header = null,
  sidebar = null,
  chrome = null,
  children
}) {
  const mainRef = A(null);
  const sideRef = A(null);
  _(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
    }
    if (mainRef.current) mainRef.current.scrollTop = 0;
    if (sideRef.current) sideRef.current.scrollTop = 0;
  }, [scrollKey]);
  const root = ["detail-page", flow ? "detail-page-flow" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ u("div", { class: root, children: /* @__PURE__ */ u("div", { class: "detail-columns", children: [
    /* @__PURE__ */ u(
      DetailMain,
      {
        align,
        header,
        chrome,
        scrollRef: mainRef,
        children
      }
    ),
    sidebar != null ? /* @__PURE__ */ u("aside", { class: "detail-sidebar", ref: sideRef, children: sidebar }) : null
  ] }) });
}

// dev/ui/src/components/EntityHeader.jsx
function EntityHeader({ title, label, date, chips }) {
  const heading = String(title || "").trim();
  const name = String(label || "").trim();
  const when = date ? formatDate(date) : "";
  const rel = date ? relativeTime(date) : "";
  const row = Array.isArray(chips) ? chips.filter(Boolean) : [];
  if (!heading && !name && !when && !row.length) return null;
  return /* @__PURE__ */ u("div", { class: "meta-section entity-header", children: /* @__PURE__ */ u("header", { children: [
    heading ? /* @__PURE__ */ u("h1", { class: "post-detail-title", children: heading }) : null,
    name ? /* @__PURE__ */ u("div", { class: "meta-label", children: name }) : null,
    when ? /* @__PURE__ */ u("div", { class: "post-detail-date", children: [
      /* @__PURE__ */ u(TimeText, { at: date, children: when }),
      rel ? /* @__PURE__ */ u("span", { class: "text-muted", children: [
        "\xB7",
        " ",
        /* @__PURE__ */ u(TimeText, { at: date, children: rel })
      ] }) : null
    ] }) : null,
    row.length > 0 ? /* @__PURE__ */ u("ul", { class: "meta-params entity-header-chips", children: row.map((chip, i) => {
      const text = chip && typeof chip === "object" ? chip.text : String(chip || "");
      const title2 = chip && typeof chip === "object" ? String(chip.title || "").trim() : "";
      const datetime = chipDatetime(text);
      return /* @__PURE__ */ u("li", { class: "param-chip", title: title2 || void 0, children: datetime ? /* @__PURE__ */ u(TimeText, { datetime, children: text }) : text }, `${text}:${i}`);
    }) }) : null
  ] }) });
}

export {
  DetailMain,
  DetailPage,
  EntityHeader
};
